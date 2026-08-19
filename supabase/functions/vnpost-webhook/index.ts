// =============================================================================
// VNPOST WEBHOOK - Supabase Edge Function (Deno)
// 
// Nhận thông báo cập nhật trạng thái đơn hàng tự động từ VNPost
// và đồng bộ trạng thái vào cơ sở dữ liệu Supabase của shop.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // Handle CORS Options preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // 1. Xác thực nguồn Webhook qua Token bảo mật gửi trong URL query params
    // Cấu hình URL Webhook trên VNPost: https://<ref>.supabase.co/functions/v1/vnpost-webhook?token=<token>
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return json({ error: 'Missing security token.' }, 401);
    }

    // Lấy shop_id tương ứng với vnpost_api_token
    const { data: flagData, error: flagErr } = await supabase
      .from('shop_feature_flags')
      .select('shop_id')
      .eq('vnpost_api_token', token)
      .maybeSingle();

    if (flagErr || !flagData) {
      return json({ error: 'Invalid verification token.' }, 403);
    }

    const shopId = flagData.shop_id;

    // 2. Parse payload từ VNPost
    const body = await req.json();
    const orderCode = body.OrderCode || body.orderCode || ''; // Mã đơn của shop
    const itemCode = body.ItemCode || body.itemCode || '';   // Mã vận đơn (Số hiệu bưu gửi) của VNPost
    const statusCode = String(body.StatusCode || body.statusCode || '');
    const statusName = body.StatusName || body.statusName || '';
    const statusDate = body.StatusDate || body.statusDate || new Date().toISOString();

    if (!orderCode && !itemCode) {
      return json({ error: 'Invalid payload: OrderCode or ItemCode is required.' }, 400);
    }

    // 3. Tìm đơn hàng khớp trong hệ thống
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', shopId)
      .or(`order_code.eq."${orderCode}",waybill_code.eq."${itemCode}"`)
      .maybeSingle();

    if (orderErr) {
      throw orderErr;
    }

    if (!order) {
      return json({ success: false, message: `No matching order found for OrderCode: ${orderCode} / ItemCode: ${itemCode}` }, 404);
    }

    // 4. Ánh xạ mã trạng thái VNPost sang trạng thái hệ thống
    // Các mã trạng thái VNPost phổ biến:
    //   - 70/80: Đang giao hàng / Trung chuyển
    //   - 90: Phát thành công / Đã giao hàng
    //   - 100: Chuyển hoàn / Trả lại người gửi
    //   - 50: Đang gom / Nhận gửi thành công
    let mappedStatus = order.status;
    if (['70', '80'].includes(statusCode)) {
      mappedStatus = 'delivering';
    } else if (statusCode === '90') {
      mappedStatus = 'delivered';
    } else if (statusCode === '100') {
      mappedStatus = 'returned';
    } else if (statusCode === '50') {
      mappedStatus = 'processing';
    }

    // 5. Cập nhật đơn hàng
    let resultObj = order.result || {};
    if (typeof resultObj === 'string') {
      try { resultObj = JSON.parse(resultObj); } catch(e) {}
    }

    // Gộp trạng thái mới vào JSON result
    resultObj.vnpost_webhook_logs = resultObj.vnpost_webhook_logs || [];
    resultObj.vnpost_webhook_logs.push({
      statusCode,
      statusName,
      statusDate,
      weight: body.Weight || 0,
      totalFee: body.TotalFee || 0,
      receivedAt: new Date().toISOString()
    });

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: mappedStatus,
        waybill_code: itemCode || order.waybill_code,
        result: resultObj,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateErr) throw updateErr;

    // 6. Ghi chép lịch sử đổi trạng thái vào order_events
    await supabase
      .from('order_events')
      .insert({
        order_id: String(order.id),
        shop_id: shopId,
        event: 'WEBHOOK_UPDATE',
        meta: JSON.stringify({
          carrier: 'vnpost',
          old_status: order.status,
          new_status: mappedStatus,
          statusCode,
          statusName,
          statusDate
        }),
        created_at: new Date().toISOString()
      });

    return json({ 
      success: true, 
      message: 'Order updated successfully.', 
      orderId: order.id,
      oldStatus: order.status,
      newStatus: mappedStatus 
    });

  } catch (err: any) {
    console.error('Webhook error:', err);
    return json({ error: err.message }, 500);
  }
});
