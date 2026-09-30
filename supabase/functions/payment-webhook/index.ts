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
const hmacSecret = (Deno.env.get('PAYMENT_WEBHOOK_HMAC_SECRET') || Deno.env.get('PAYMENT_WEBHOOK_SECRET') || '').trim();
const allowedOrigin = Deno.env.get('PAYMENT_WEBHOOK_ALLOWED_ORIGIN') || 'https://my.sepay.vn';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-timestamp, x-nonce, idempotency-key, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helpers for P0-4 HMAC hardening
function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return hexEncode(sig);
}

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
    if (!supabaseUrl || !serviceRoleKey || !hmacSecret) {
      console.error('[Payment Webhook] Missing required server secrets.');
      return json({ error: 'Webhook is not configured.' }, 503);
    }

    const rawBody = await req.text();
    let payload: any;
    try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch { return json({ error: 'Invalid JSON body' }, 400); }
    console.log('[Payment Webhook] Received transaction event.');

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const sigHeader = (req.headers.get('x-signature') || req.headers.get('X-Signature') || '').trim();
    const tsHeader = (req.headers.get('x-timestamp') || req.headers.get('X-Timestamp') || '').trim();
    const nonceHeader = (req.headers.get('x-nonce') || req.headers.get('X-Nonce') || '').trim();
    const idemHeader = (req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key') || req.headers.get('Idempotency-Key') || '').trim();

    if (!sigHeader) return json({ error: 'Missing X-Signature', code: 'MISSING_SIGNATURE' }, 401);
    if (!tsHeader || !nonceHeader) return json({ error: 'Missing X-Timestamp or X-Nonce', code: 'MISSING_TIMESTAMP_NONCE' }, 401);
    const tsNum = Number(tsHeader);
    if (!Number.isFinite(tsNum)) return json({ error: 'Invalid X-Timestamp', code: 'TIMESTAMP_INVALID' }, 401);
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - tsNum) > 300) {
      return json({ error: 'Timestamp expired', code: 'TIMESTAMP_EXPIRED', now: nowSec, provided: tsNum }, 401);
    }
    if (nonceHeader.length < 8 || nonceHeader.length > 128) return json({ error: 'Invalid nonce', code: 'NONCE_INVALID' }, 401);
    const expectedHex = await hmacHex(hmacSecret, `${tsHeader}.${nonceHeader}.${rawBody}`);
    const providedHex = sigHeader.replace(/^sha256=/i, '').trim().toLowerCase();
    if (!timingSafeEqual(providedHex, expectedHex.toLowerCase())) {
      return json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' }, 401);
    }
    const { error: nonceErr } = await supabase.from('webhook_nonces').insert({ nonce: nonceHeader, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (nonceErr) {
      const isDup = (nonceErr as any).code === '23505' || String(nonceErr.message || '').toLowerCase().includes('duplicate');
      if (isDup) return json({ error: 'Replay detected', code: 'REPLAY_DETECTED' }, 409);
      console.warn('[Webhook] nonce insert warn:', nonceErr);
    }

    // 2. Chuẩn hóa dữ liệu từ SePay / VietQR Gateway
    // SePay standard format: { id, gateway, transactionDate, accountNumber, transferType, transferAmount, accumulated, content, referenceCode }
    const amount = Number(payload.transferAmount || payload.amount || 0);
    const content = String(payload.content || payload.description || '').trim();
    // P0-4 idempotency: ưu tiên Idempotency-Key header nếu gateway gửi
    const headerTxn = idemHeader || String(payload.idempotency_key || '').trim();
    const transactionCode = String(headerTxn || payload.referenceCode || payload.id || payload.transaction_id || `TXN-${Date.now()}`);
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
      // Ghi nhận giao dịch treo (UNMATCHED) vào payment_transactions để Admin đối soát thủ công
      await supabase.from('payment_transactions').insert({
        transaction_code: transactionCode,
        transaction_id: transactionCode,
        amount,
        content,
        gateway: bankBrand,
        status: 'PENDING',
        reconciliation_status: 'unmatched',
        reconciliation_notes: 'Nội dung chuyển khoản không đúng cú pháp AUTOFILL <SHOP_CODE> <PLAN>',
        raw_payload: payload,
        raw_webhook_payload: payload
      }).catch((err: any) => console.warn('[Payment Webhook] Error persisting unmatched transaction:', err));

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

    // reuse supabase from above (đã tạo ở đầu hàm để check nonce)

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
      // Ghi nhận giao dịch chưa khớp Shop (UNMATCHED) để Admin đối soát và gán shop thủ công
      await supabase.from('payment_transactions').insert({
        transaction_code: transactionCode,
        transaction_id: transactionCode,
        amount,
        content,
        shop_code: rawShopIdentifier,
        gateway: bankBrand,
        status: 'PENDING',
        reconciliation_status: 'unmatched',
        reconciliation_notes: `Shop not found with identifier: ${rawShopIdentifier}`,
        raw_payload: payload,
        raw_webhook_payload: payload
      }).catch((err: any) => console.warn('[Payment Webhook] Error persisting unmatched transaction:', err));

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
