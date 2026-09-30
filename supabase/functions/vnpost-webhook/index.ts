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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed. Use GET or POST.' }, 405);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Hàm chuẩn hóa & tìm shop_id chính xác (hỗ trợ cả UUID, mã shop_code, hoặc shop_name)
    const resolveShop = async (rawId: string) => {
      const clean = String(rawId || '').trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      if (isUuid) {
        const { data: s } = await supabase.from('shops').select('id, name, shop_code').eq('id', clean).maybeSingle();
        return s || { id: clean, name: '', shop_code: '' };
      }
      if (clean) {
        const { data: byCode } = await supabase.from('shops').select('id, name, shop_code').ilike('shop_code', clean).maybeSingle();
        if (byCode) return byCode;

        const { data: byName } = await supabase.from('shops').select('id, name, shop_code').ilike('name', clean).maybeSingle();
        if (byName) return byName;
      }

      // Fallback: Tìm shop đầu tiên trong hệ thống nếu không có mã hợp lệ
      return clean ? { id: clean, name: '', shop_code: '' } : null;
    };

    const getBearerJwt = () => {
      const header = req.headers.get('authorization') || '';
      const match = header.match(/^Bearer\s+(.+)$/i);
      return match ? match[1].trim() : '';
    };

    const requireShopAccess = async (rawShopId: string, options: { managerOnly?: boolean } = {}) => {
      const jwt = getBearerJwt();
      if (!jwt) return { error: json({ error: 'Missing Authorization bearer token.' }, 401) };

      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      const userId = userData?.user?.id;
      if (userErr || !userId) return { error: json({ error: 'Invalid Authorization bearer token.' }, 401) };

      const shop = await resolveShop(rawShopId);
      const shopId = shop?.id;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(shopId || ''));
      if (!isUuid) return { error: json({ error: 'Cannot resolve valid shop UUID.' }, 400) };

      const { data: member } = await supabase
        .from('shop_members')
        .select('id, role, status, removed_at')
        .eq('shop_id', shopId)
        .eq('user_id', userId)
        .is('removed_at', null)
        .maybeSingle();

      const role = String(member?.role || '').toUpperCase();
      const isActiveMember = !!member && (!member.status || String(member.status).toLowerCase() === 'active');
      const isManager = ['OWNER', 'MANAGER', 'SHOP_OWNER', 'SHOP_MANAGER'].includes(role);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles(code)')
        .eq('user_id', userId);
      const isSystemAdmin = (roles || []).some((row: any) =>
        ['SYSTEM_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(String(row?.roles?.code || '').toUpperCase())
      );

      if (!isSystemAdmin && (!isActiveMember || (options.managerOnly && !isManager))) {
        return { error: json({ error: 'Forbidden for this shop.' }, 403) };
      }

      return { userId, shop, shopId };
    };

    // Hỗ trợ Action lưu cấu hình trực tiếp từ Options Extension (sử dụng service_role_key, không bị vướng RLS)
    if (body.action === 'save_config' || body.action === 'save_token') {
      const targetShopId = body.shopId || body.shop_id;
      const targetToken = (body.token || body.api_token || '').trim();
      const targetCustomerCode = (body.customerCode || body.customer_code || '').trim();

      if (!targetToken) {
        return json({ error: 'Missing token.' }, 400);
      }

      const access = await requireShopAccess(targetShopId, { managerOnly: true });
      if ('error' in access) return access.error;
      const canonicalShopId = access.shopId;
      const shop = access.shop;

      const { data: upsertData, error: upsertErr } = await supabase
        .from('shop_feature_flags')
        .upsert({
          shop_id: canonicalShopId,
          vnpost_customer_code: targetCustomerCode,
          vnpost_api_token: targetToken,
          updated_at: new Date().toISOString()
        }, { onConflict: 'shop_id' })
        .select();

      if (upsertErr) {
        return json({ error: upsertErr.message }, 500);
      }

      return json({
        success: true,
        message: 'Saved webhook configuration successfully.',
        shop_id: canonicalShopId,
        shop_name: shop?.name || '',
        shop_code: shop?.shop_code || '',
        data: upsertData
      });
    }

    // Hỗ trợ Action lấy cấu hình Webhook cho mọi tài khoản thành viên trong shop
    if (body.action === 'get_config' || body.action === 'load_config') {
      const targetShopId = body.shopId || body.shop_id || url.searchParams.get('shop_id');
      const access = await requireShopAccess(targetShopId);
      if ('error' in access) return access.error;
      const canonicalShopId = access.shopId;
      const shop = access.shop;

      let data = null;
      if (canonicalShopId) {
        const queryRes = await supabase
          .from('shop_feature_flags')
          .select('shop_id, vnpost_customer_code, vnpost_api_token, updated_at')
          .eq('shop_id', canonicalShopId)
          .maybeSingle();
        data = queryRes.data;
      }

      return json({
        success: true,
        shop_id: canonicalShopId,
        shop_name: shop?.name || '',
        shop_code: shop?.shop_code || '',
        data: data || { vnpost_customer_code: '', vnpost_api_token: '' }
      });
    }

    // Hỗ trợ Action lấy danh sách đơn hàng & logs nhận được từ VNPost để hiển thị bảng kiểm tra
    if (body.action === 'get_logs' || body.action === 'get_webhook_orders') {
      const targetShopId = body.shopId || body.shop_id || url.searchParams.get('shop_id');
      if (!targetShopId) {
        return json({ error: 'Missing shopId.' }, 400);
      }

      const access = await requireShopAccess(targetShopId);
      if ('error' in access) return access.error;
      const canonicalShopId = access.shopId;

      let query = supabase
        .from('submitted_orders')
        .select('id, order_code, tracking_code, customer_name, name, phone, status, shipping_fee, actual_weight, webhook_logs, updated_at, submitted_at, address, platform')
        .order('updated_at', { ascending: false })
        .limit(100);

      query = query.eq('shop_id', canonicalShopId);

      const { data: ordersData, error: ordersErr } = await query;

      if (ordersErr) {
        return json({ error: ordersErr.message }, 500);
      }

      const filtered = (ordersData || []).filter((o: any) => 
        (Array.isArray(o.webhook_logs) && o.webhook_logs.length > 0) ||
        (o.status && o.status !== 'submitted' && o.status !== 'pending') ||
        (o.tracking_code && o.tracking_code !== '-' && o.tracking_code !== '—')
      );

      return json({
        success: true,
        orders: filtered.length > 0 ? filtered : (ordersData || []).slice(0, 20)
      });
    }

    // Chỉ chấp nhận token qua HTTP Header, tuyệt đối KHÔNG chấp nhận qua Query Parameter URL
    const token = (
      req.headers.get('x-vnpost-token') ||
      req.headers.get('x-api-token') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      ''
    ).trim();
    
    if (!token || token.length < 16) {
      return json({ 
        error: 'Missing or invalid security token.',
        message: 'Yêu cầu Token bảo mật Webhook qua HTTP Header (x-vnpost-token hoặc Authorization Bearer). Token qua query parameter không được hỗ trợ vì rủi ro bảo mật.'
      }, 401);
    }

    // Lấy shop_id tương ứng với vnpost_api_token (TUYỆT ĐỐI KHÔNG dùng vnpost_customer_code làm secret)
    const { data: flagData, error: flagErr } = await supabase
      .from('shop_feature_flags')
      .select('shop_id, vnpost_api_token, vnpost_webhook_enabled')
      .eq('vnpost_api_token', token)
      .maybeSingle();

    if (flagErr || !flagData) {
      return json({ 
        error: 'Invalid verification token.',
        message: 'Mã Token bảo mật Webhook không hợp lệ hoặc chưa được đăng ký trong hệ thống.'
      }, 403);
    }

    if (flagData.vnpost_webhook_enabled === false) {
      return json({
        error: 'WEBHOOK_DISABLED',
        message: 'Tính năng VNPost Webhook đang tạm khóa cho cửa hàng này.'
      }, 403);
    }

    const shopId = flagData.shop_id;

    // Ghi nhận thời điểm nhận tín hiệu Webhook gần nhất từ hệ thống
    try {
      await supabase
        .from('shop_feature_flags')
        .update({ 
          last_webhook_received_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('shop_id', shopId);
    } catch (_) {}

    // Nếu là GET request: Xác nhận endpoint hoạt động và token hợp lệ
    if (req.method === 'GET') {
      return json({
        success: true,
        message: 'VNPost Webhook endpoint is active and verified.',
        shopId: shopId,
        carrier: 'vnpost',
        status: 'online'
      }, 200);
    }

    // 2. Parse payload từ VNPost (sử dụng body đã parse ở trên)
    const orderCode = body.OrderCode || body.orderCode || ''; // Mã đơn của shop
    const itemCode = body.ItemCode || body.itemCode || '';   // Mã vận đơn (Số hiệu bưu gửi) của VNPost
    const statusCode = String(body.StatusCode || body.statusCode || '');
    const statusName = body.StatusName || body.statusName || '';
    const statusDate = body.StatusDate || body.statusDate || new Date().toISOString();

    // Nếu VNPost gửi request ping kiểm tra kết nối từ trang quản trị my.vnpost.vn (không kèm đơn)
    if (!orderCode && !itemCode) {
      return json({ 
        success: true, 
        message: 'VNPost Webhook handshake successful. Connection verified.',
        shopId: shopId
      }, 200);
    }

    // 3. Tìm đơn hàng khớp trong hệ thống (chính là bảng submitted_orders, và bảng draft orders nếu có)
    let subQuery = supabase.from('submitted_orders').select('*').eq('shop_id', shopId);

    if (orderCode && itemCode) {
      subQuery = subQuery.or(`order_code.eq."${orderCode}",tracking_code.eq."${itemCode}"`);
    } else if (itemCode) {
      subQuery = subQuery.eq('tracking_code', itemCode);
    } else {
      subQuery = subQuery.eq('order_code', orderCode);
    }

    const { data: submittedOrder, error: subErr } = await subQuery.maybeSingle();
    if (subErr) console.warn('Query submitted_orders warning:', subErr);

    // Tìm trong bảng orders nếu có (bảng orders chỉ có cột order_code, không có waybill_code)
    let draftOrder: any = null;
    const lookupCode = orderCode || itemCode;
    if (lookupCode) {
      try {
        const { data: dOrder } = await supabase
          .from('orders')
          .select('id, status')
          .eq('shop_id', shopId)
          .eq('order_code', lookupCode)
          .maybeSingle();
        draftOrder = dOrder;
      } catch (_) {}
    }

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
    const currentStatus = submittedOrder ? submittedOrder.status : (draftOrder ? draftOrder.status : 'submitted');
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
      try {
        await supabase
          .from('orders')
          .update({
            status: mappedStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', draftOrder.id);
      } catch (dErr) {
        console.warn('Update orders warning:', dErr);
      }
    }

    // 6. Cập nhật bảng submitted_orders nếu tồn tại
    if (submittedOrder) {
      let logsArr: any[] = [];
      if (Array.isArray(submittedOrder.webhook_logs)) {
        logsArr = [...submittedOrder.webhook_logs];
      } else if (typeof submittedOrder.webhook_logs === 'string') {
        try { logsArr = JSON.parse(submittedOrder.webhook_logs || '[]'); } catch(e) {}
      } else if (submittedOrder.webhook_logs) {
        logsArr = [submittedOrder.webhook_logs];
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

    // 7. Ghi chép lịch sử đổi trạng thái vào order_events (nếu có bảng)
    try {
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
    } catch (_) {}

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
