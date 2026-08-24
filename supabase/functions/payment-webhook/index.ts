// =============================================================================
// PAYMENT WEBHOOK - Supabase Edge Function (Deno)
// 
// Tự động nhận Webhook biến động số dư từ SePay / VietQR Gateway,
// bóc tách mã cửa hàng & gói cước trong nội dung chuyển khoản,
// và gọi RPC process_vietqr_payment để tự động kích hoạt gói cước trong 3 giây.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const paymentApiKey = Deno.env.get('PAYMENT_WEBHOOK_API_KEY') || 'AUTOFILL_SECURE_PAYMENT_2026';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token') || '';

    // 1. Kiểm tra API Key bảo mật
    const isApiKeyValid = 
      authHeader.includes(paymentApiKey) ||
      authHeader === `Apikey ${paymentApiKey}` ||
      authHeader === `Bearer ${paymentApiKey}` ||
      tokenParam === paymentApiKey;

    if (!isApiKeyValid && paymentApiKey !== 'AUTOFILL_SECURE_PAYMENT_2026') {
      return json({ error: 'Unauthorized: Invalid payment API key' }, 401);
    }

    const payload = await req.json();
    console.log('[Payment Webhook] Received payload:', JSON.stringify(payload));

    // 2. Chuẩn hóa dữ liệu từ SePay / VietQR Gateway
    // SePay standard format: { id, gateway, transactionDate, accountNumber, transferType, transferAmount, accumulated, content, referenceCode }
    const amount = Number(payload.transferAmount || payload.amount || 0);
    const content = String(payload.content || payload.description || '').trim();
    const transactionCode = String(payload.referenceCode || payload.id || payload.transaction_id || `TXN-${Date.now()}`);
    const bankBrand = String(payload.gateway || payload.bankBrandName || 'VIETQR');
    const accountNumber = String(payload.accountNumber || '');

    if (amount <= 0 || !content) {
      return json({ error: 'Invalid transaction: Missing amount or content' }, 400);
    }

    // 3. Regex bóc tách mã Shop và Gói cước từ nội dung chuyển khoản
    // Cú pháp chuyển khoản chuẩn: "AUTOFILL <SHOP_ID_HOAC_MA_SHOP> <GOI_CUOC>"
    // Ví dụ: "AUTOFILL 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d PRO_MONTH" hoặc "AUTOFILL SHOP123 PRO_YEAR"
    const match = content.match(/AUTOFILL\s+([A-Za-z0-9\-_]+)(?:\s+([A-Za-z0-9_]+))?/i);
    if (!match) {
      console.warn('[Payment Webhook] Nội dung chuyển khoản không khớp cú pháp:', content);
      return json({ 
        success: false, 
        message: 'Nội dung chuyển khoản không đúng định dạng AUTOFILL <SHOP_CODE> <PLAN>' 
      }, 422);
    }

    const rawShopIdentifier = match[1];
    let rawPlanTier = match[2] ? match[2].toUpperCase() : 'PRO_MONTH';

    // Xác định số tháng đăng ký theo số tiền hoặc tên gói
    let durationMonths = 1;
    if (rawPlanTier.includes('YEAR') || amount >= 1000000) {
      rawPlanTier = 'PRO_YEAR';
      durationMonths = 12;
    } else if (rawPlanTier.includes('ENTERPRISE')) {
      rawPlanTier = 'ENTERPRISE';
      durationMonths = 1;
    } else {
      rawPlanTier = 'PRO_MONTH';
      durationMonths = 1;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 4. Tìm kiếm shop_id chính xác (hỗ trợ cả UUID và shop_code)
    let shopId: string | null = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawShopIdentifier);

    if (isUUID) {
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('id', rawShopIdentifier)
        .maybeSingle();
      if (shop) shopId = shop.id;
    }

    if (!shopId) {
      // Tìm theo shop_code
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .ilike('shop_code', rawShopIdentifier)
        .maybeSingle();
      if (shop) shopId = shop.id;
    }

    if (!shopId) {
      console.error('[Payment Webhook] Không tìm thấy shop với mã:', rawShopIdentifier);
      return json({ error: `Shop not found with identifier: ${rawShopIdentifier}` }, 404);
    }

    // 5. Kích hoạt giao dịch qua RPC Postgres
    const { data: rpcResult, error: rpcError } = await supabase.rpc('process_vietqr_payment', {
      p_shop_id: shopId,
      p_transaction_code: transactionCode,
      p_amount: amount,
      p_plan_tier: rawPlanTier,
      p_duration_months: durationMonths,
      p_raw_payload: payload
    });

    if (rpcError) {
      console.error('[Payment Webhook] RPC process_vietqr_payment failed:', rpcError);
      return json({ error: 'Database activation failed', details: rpcError }, 500);
    }

    console.log('[Payment Webhook] Successfully processed payment:', rpcResult);
    return json({
      success: true,
      message: 'Kích hoạt gói cước tự động thành công!',
      data: rpcResult
    });

  } catch (err: any) {
    console.error('[Payment Webhook] Unhandled error:', err);
    return json({ error: err.message || 'Internal server error' }, 500);
  }
});
