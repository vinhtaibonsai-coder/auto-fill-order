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

    // 3. Tìm đơn hàng khớp trong hệ thống (cả bảng orders và submitted_orders)
    const [ordersRes, submittedOrdersRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .or(`order_code.eq."${orderCode}",waybill_code.eq."${itemCode}"`)
        .maybeSingle(),
      supabase
        .from('submitted_orders')
        .select('*')
        .eq('shop_id', shopId)
        .or(`order_code.eq."${orderCode}",tracking_code.eq."${itemCode}"`)
        .maybeSingle()
    ]);

    if (ordersRes.error) throw ordersRes.error;
    if (submittedOrdersRes.error) throw submittedOrdersRes.error;

    const draftOrder = ordersRes.data;
    const submittedOrder = submittedOrdersRes.data;

    if (!draftOrder && !submittedOrder) {
      return json({ 
        success: false, 
        message: `No matching order found in orders or submitted_orders for OrderCode: ${orderCode} / ItemCode: ${itemCode}` 
      }, 404);
    }

    // 4. Ánh xạ mã trạng thái VNPost sang trạng thái hệ thống
    // Các mã trạng thái VNPost phổ biến:
    //   - 70/80: Đang giao hàng / Trung chuyển
    //   - 90: Phát thành công / Đã giao hàng
    //   - 100: Chuyển hoàn / Trả lại người gửi
    //   - 50: Đang gom / Nhận gửi thành công
    const currentStatus = draftOrder ? draftOrder.status : (submittedOrder ? submittedOrder.status : 'submitted');
    let mappedStatus = currentStatus;
    if (['70', '80'].includes(statusCode)) {
      mappedStatus = 'delivering';
    } else if (statusCode === '90') {
      mappedStatus = 'delivered';
    } else if (statusCode === '100') {
      mappedStatus = 'returned';
    } else if (statusCode === '50') {
      mappedStatus = 'processing';
    }

    // 5. Cập nhật bảng orders nếu tồn tại
    if (draftOrder) {
      let resultObj = draftOrder.result || {};
      if (typeof resultObj === 'string') {
        try { resultObj = JSON.parse(resultObj); } catch(e) {}
      }

      resultObj.vnpost_webhook_logs = resultObj.vnpost_webhook_logs || [];
      resultObj.vnpost_webhook_logs.push({
        statusCode,
        statusName,
        statusDate,
        weight: body.Weight || 0,
        totalFee: body.TotalFee || 0,
        receivedAt: new Date().toISOString()
      });

      const { error: updateDraftErr } = await supabase
        .from('orders')
        .update({
          status: mappedStatus,
          waybill_code: itemCode || draftOrder.waybill_code,
          result: resultObj,
          updated_at: new Date().toISOString()
        })
        .eq('id', draftOrder.id);

      if (updateDraftErr) throw updateDraftErr;
    }

    // 6. Cập nhật bảng submitted_orders nếu tồn tại
    if (submittedOrder) {
      let logsArr = [];
      if (Array.isArray(submittedOrder.webhook_logs)) {
        logsArr = submittedOrder.webhook_logs;
      } else if (typeof submittedOrder.webhook_logs === 'string') {
        try { logsArr = JSON.parse(submittedOrder.webhook_logs || '[]'); } catch(e) {}
      } else if (submittedOrder.webhook_logs) {
        logsArr = submittedOrder.webhook_logs;
      }

      logsArr.push({
        statusCode,
        statusName,
        statusDate,
        weight: body.Weight || 0,
        totalFee: body.TotalFee || 0,
        receivedAt: new Date().toISOString()
      });

      const { error: updateSubErr } = await supabase
        .from('submitted_orders')
        .update({
          status: mappedStatus,
          tracking_code: itemCode || submittedOrder.tracking_code,
          shipping_fee: body.TotalFee || submittedOrder.shipping_fee || 0,
          actual_weight: body.Weight || submittedOrder.actual_weight || 0,
          webhook_logs: logsArr,
          updated_at: new Date().toISOString()
        })
        .eq('id', submittedOrder.id);

      if (updateSubErr) throw updateSubErr;
    }

    // 7. Ghi chép lịch sử đổi trạng thái vào order_events
    await supabase
      .from('order_events')
      .insert({
        order_id: draftOrder ? String(draftOrder.id) : null,
        submitted_order_id: submittedOrder ? String(submittedOrder.id) : null,
        shop_id: shopId,
        event: 'WEBHOOK_UPDATE',
        status: mappedStatus,
        before_status: currentStatus,
        after_status: mappedStatus,
        meta: {
          carrier: 'vnpost',
          statusCode,
          statusName,
          statusDate,
          weight: body.Weight || 0,
          totalFee: body.TotalFee || 0
        },
        created_at: new Date().toISOString()
      });

    return json({ 
      success: true, 
      message: 'Order status synced successfully.', 
      draftOrderId: draftOrder ? draftOrder.id : null,
      submittedOrderId: submittedOrder ? submittedOrder.id : null,
      oldStatus: currentStatus,
      newStatus: mappedStatus 
    });

  } catch (err: any) {
    console.error('Webhook error:', err);
    return json({ error: err.message }, 500);
  }
});
