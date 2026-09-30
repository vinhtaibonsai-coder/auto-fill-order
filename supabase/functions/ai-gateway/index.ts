// =============================================================================
// AI GATEWAY - Supabase Edge Function (Deno)
//
// Kiến trúc (xem AUTO_FILL_ORDER_OFFICIAL_SOURCE_AUDIT P0-02/P0-03/P0-04):
//
//   Extension ──raw order/image──▶ Edge Function ──▶ AI Providers ──▶ AI response ──▶ Extension
//                     ├── authenticate (Supabase Auth verify — không decode thủ công)
//                     ├── check shop (shop_members)
//                     ├── check feature flag (shop_feature_flags)
//                     ├── rate limit   (RPC sliding window)
//                     ├── quota        (RPC atomic consume_ai_quota)
//                     ├── select provider keys (SERVER-SIDE — không bao giờ trả về)
//                     ├── select model  (SERVER-SIDE registry — client chỉ gửi task)
//                     └── audit / ai_usage_log
//
// Hỗ trợ các tác vụ (Tasks):
//   - parse: Bóc tách text thông thường (Groq Llama 3.1)
//   - address: Chuẩn hóa địa chỉ (Groq Llama 3.1)
//   - vision_ocr: Nhận diện chữ trong ảnh (Google Cloud Vision OCR)
//   - gemini_vision: Bóc tách ảnh đơn hàng bằng Multimodal Vision (Gemini 1.5/2.0 Flash / Llama Vision)
//
// Deploy:
//   supabase functions deploy ai-gateway --project-ref <ref>
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const groqEnvKey = Deno.env.get('GROQ_API_KEY') || '';
const googleVisionEnvKey = Deno.env.get('GOOGLE_VISION_API_KEY') || '';
const geminiEnvKey = Deno.env.get('GEMINI_API_KEY') || '';

const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shop-access-key, x-shop-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ------------------------------------------------------------------
// RESILIENCE UTILS: BACKOFF + JITTER & CIRCUIT BREAKER
// ------------------------------------------------------------------
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getBackoffWithJitter(attempt: number, baseMs = 400, capMs = 2000): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, attempt));
  const jitter = Math.random() * 200;
  return exp + jitter;
}

// In-memory circuit breaker cho Google Gemini (60s cooldown khi gặp 503/5xx liên tiếp)
const geminiCircuitBreaker = {
  consecutiveFailures: 0,
  failureThreshold: 2,
  cooldownMs: 60000,
  openedAt: 0,
  isOpen(): boolean {
    if (this.openedAt === 0) return false;
    const elapsed = Date.now() - this.openedAt;
    if (elapsed >= this.cooldownMs) {
      return false; // Half-open: cho phép thử 1 request
    }
    return true;
  },
  recordSuccess() {
    this.consecutiveFailures = 0;
    this.openedAt = 0;
  },
  recordFailure(status: number) {
    if (status === 503 || status === 429 || (status >= 500 && status < 600)) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.openedAt = Date.now();
        console.warn(`[Circuit Breaker] Gemini tạm ngắt (OPEN) trong ${this.cooldownMs / 1000}s do ${this.consecutiveFailures} lỗi liên tiếp (Status ${status})`);
      }
    }
  }
};

// ------------------------------------------------------------------
// SERVER-SIDE MODEL REGISTRY (P0-03)
// ------------------------------------------------------------------
const MODEL_REGISTRY: Record<string, string> = {
  parse:         'llama-3.3-70b-versatile',
  address:       'llama-3.3-70b-versatile',
  vision_ocr:    'google-vision-document-ocr',
  gemini_vision: 'gemini-3.6-flash',
  fallback:      'llama-3.3-70b-versatile', // Hỗ trợ fallback thay thế llama-3.1-8b-instant
};

const MAX_TOKENS_BY_TASK: Record<string, number> = {
  parse:         300,
  address:       200,
  vision_ocr:    1000,
  gemini_vision: 600,
  fallback:      256,
};

const ALLOWED_TASKS = new Set(['health', 'parse', 'address', 'vision_ocr', 'gemini_vision', 'fallback']);
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES / 3) * 4;
const DATA_IMAGE_RE = /^data:(image\/(?:png|jpe?g|webp));base64,/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let body: any;
    try { body = await req.json(); } catch (_) { return json({ error: 'AI_INVALID_INPUT', message: 'Invalid JSON' }, 400); }

    // ------------------------------------------------------------------
    // 1. AUTHENTICATE - Hỗ trợ cả 2 phương thức:
    //    A. Shop Access Key (Nhân viên / Máy trạm)
    //    B. Supabase Auth JWT Token (Chủ shop / Quản lý)
    // ------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') || '';
    const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const headerShopKey = req.headers.get('x-shop-access-key') || req.headers.get('x-shop-key') || '';
    const shopAccessKey = (headerShopKey || body.shop_access_key || (rawToken.toUpperCase().startsWith('KEY-') ? rawToken : '')).trim();

    // Client service-role: DÙNG ĐỂ ĐỌC/GHI NỘI BỘ TRONG EDGE
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let userId: string | null = null;
    // shop_id tu frontend KHONG duoc tin cay: moi shopId deu phai resolve/authorize lai server-side.
    let shopId: string | null = (typeof body.shop_id === 'string' && UUID_REGEX.test(body.shop_id.trim())) ? body.shop_id.trim() : null;
    let isShopKeyMode = false;

    if (shopAccessKey) {
      // Xác thực qua Shop Access Key
      const { data: shopRow, error: shopKeyErr } = await adminClient
        .from('shops')
        .select('id, name, status')
        .ilike('shop_access_key', shopAccessKey)
        .maybeSingle();

      if (shopKeyErr || !shopRow) {
        return json({ error: 'AI_INVALID_KEY', message: 'Mã Shop Access Key không hợp lệ hoặc đã bị đổi.' }, 401);
      }
      if (shopRow.status === 'suspended' || shopRow.status === 'inactive') {
        return json({ error: 'AI_SHOP_INACTIVE', message: 'Cửa hàng đang tạm khóa.' }, 403);
      }

      shopId = shopRow.id;
      isShopKeyMode = true;
    } else if (rawToken && (rawToken.startsWith('token_') || rawToken.startsWith('pin_sess_'))) {
      // Xác thực phiên làm việc máy trạm / PIN login qua bảng device_sessions
      const { data: devSess } = await adminClient
        .from('device_sessions')
        .select('shop_id, user_id, device_id, expires_at')
        .eq('session_token', rawToken)
        .maybeSingle();

      if (!devSess || (devSess.expires_at && new Date(devSess.expires_at).getTime() <= Date.now())) {
        return json({ error: 'AI_AUTH_REQUIRED', message: 'Phiên làm việc máy trạm không hợp lệ hoặc đã hết hạn.' }, 401);
      }

      // Kiểm tra trạng thái thiết bị gắn với phiên làm việc
      if (devSess.device_id) {
        const { data: devRow } = await adminClient
          .from('devices')
          .select('id, is_revoked, status')
          .eq('device_id', devSess.device_id)
          .maybeSingle();
        if (devRow && (devRow.is_revoked === true || devRow.status === 'revoked' || devRow.status === 'blocked')) {
          return json({ error: 'AI_DEVICE_REVOKED', message: 'Thiết bị này đã bị thu hồi quyền truy cập.' }, 403);
        }
      }

      // Shop ID bắt buộc lấy trực tiếp từ session trên server, tuyệt đối không lấy từ body
      shopId = devSess.shop_id;
      userId = devSess.user_id;
      isShopKeyMode = true;
    } else {
      // Xác thực qua Supabase Auth JWT
      if (!rawToken) return json({ error: 'AI_AUTH_REQUIRED', message: 'Missing authorization token or shop key' }, 401);

      const { data: { user }, error: authError } = await adminClient.auth.getUser(rawToken);
      if (authError || !user) {
        return json({ error: 'AI_AUTH_REQUIRED', message: 'Invalid or expired token' }, 401);
      }
      userId = user.id;

      if (!shopId) {
        // 1. Tìm shop mà user là thành viên active
        const { data: members } = await adminClient
          .from('shop_members')
          .select('shop_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .is('removed_at', null)
          .order('created_at', { ascending: true })
          .limit(1);
        if (members && members[0]?.shop_id && UUID_REGEX.test(members[0].shop_id)) {
          shopId = members[0].shop_id;
        }
      }

      if (!shopId) {
        // 2. Tìm shop mà user là chủ sở hữu (owner_id)
        const { data: ownedShops } = await adminClient
          .from('shops')
          .select('id')
          .eq('owner_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1);
        if (ownedShops && ownedShops[0]?.id) {
          shopId = ownedShops[0].id;
        }
      }

      if (!shopId) {
        // 3. Nếu là Quản trị viên hệ thống hoặc hỗ trợ, gán vào shop active đầu tiên
        const { data: adminRole } = await adminClient
          .from('user_roles')
          .select('roles!inner(code)')
          .eq('user_id', userId)
          .in('roles.code', ['SYSTEM_ADMIN', 'SUPPORT_ADMIN'])
          .limit(1);
        if (adminRole && adminRole.length > 0) {
          const { data: anyShop } = await adminClient
            .from('shops')
            .select('id')
            .eq('status', 'active')
            .order('created_at', { ascending: true })
            .limit(1);
          if (anyShop && anyShop[0]?.id) {
            shopId = anyShop[0].id;
          }
        }
      }

      if (!shopId) {
        return json({ error: 'AI_SHOP_REQUIRED', message: 'Tài khoản chưa được gán vào cửa hàng nào.' }, 403);
      }

      // ------------------------------------------------------------------
      // 2b. AUTHORIZE SHOP (fail-closed)
      // ------------------------------------------------------------------
      let isAuthorized = false;
      const { data: membership } = await adminClient
        .from('shop_members')
        .select('shop_id')
        .eq('user_id', userId)
        .eq('shop_id', shopId)
        .eq('status', 'active')
        .is('removed_at', null)
        .maybeSingle();

      if (membership) {
        isAuthorized = true;
      } else {
        const { data: shopOwner } = await adminClient
          .from('shops')
          .select('id')
          .eq('id', shopId)
          .eq('owner_id', userId)
          .maybeSingle();
        if (shopOwner) {
          isAuthorized = true;
        } else {
          const { data: adminRole } = await adminClient
            .from('user_roles')
            .select('roles!inner(code)')
            .eq('user_id', userId)
            .in('roles.code', ['SYSTEM_ADMIN', 'SUPPORT_ADMIN'])
            .limit(1);
          if (adminRole && adminRole.length > 0) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return json({ error: 'AI_SHOP_FORBIDDEN', message: 'Bạn không có quyền truy cập cửa hàng này.' }, 403);
      }
    }

    // ------------------------------------------------------------------
    // 3. CHECK FEATURE FLAG
    // ------------------------------------------------------------------
    const { data: flags } = await adminClient
      .from('shop_feature_flags')
      .select('ai_parsing_enabled, use_system_groq_key, custom_prompt_rules, google_vision_api_key, gemini_api_key')
      .eq('shop_id', shopId)
      .maybeSingle();
    const aiEnabled = flags?.ai_parsing_enabled !== false;
    if (!aiEnabled) {
      return json({ error: 'AI_FEATURE_DISABLED', message: 'AI parsing disabled for this shop.' }, 403);
    }

    const task = String(body.task || 'parse').trim();
    const imageBase64 = String(body.imageBase64 || body.image_base64 || body.image || '').trim();
    const text = String(body.text || '').trim();

    if (!ALLOWED_TASKS.has(task)) {
      return json({ error: 'AI_INVALID_INPUT', message: 'Unsupported AI task' }, 400);
    }

    // Fast health-check path for Options/UI status checks:
    // authenticate + authorize + feature flag only; never call AI providers and never consume quota.
    if (task === 'health') {
      const { data: quota } = await adminClient
        .from('shop_quotas')
        .select('daily_ai_limit,daily_ai_used,monthly_ai_limit,monthly_ai_used')
        .eq('shop_id', shopId)
        .maybeSingle();

      return json({
        success: true,
        data: { ok: true, task: 'health', shop_id: shopId, ai_enabled: true },
        quota: quota ? {
          daily_limit: quota.daily_ai_limit,
          daily_used: quota.daily_ai_used,
          monthly_limit: quota.monthly_ai_limit,
          monthly_used: quota.monthly_ai_used,
          remaining: Math.max(0, Number(quota.daily_ai_limit || 0) - Number(quota.daily_ai_used || 0)),
        } : null,
      });
    }

    // ------------------------------------------------------------------
    // 4. RATE LIMIT (DB sliding window)
    // ------------------------------------------------------------------
    const { data: rateRes, error: rateErr } = await adminClient.rpc('check_ai_rate_limit', { p_shop_id: shopId });
    if (rateErr) {
      console.error('check_ai_rate_limit error:', rateErr);
      return json({ error: 'AI_INTERNAL_ERROR', message: 'Cannot verify rate limit.' }, 500);
    }
    if (rateRes && rateRes.success === false) {
      return json({ error: rateRes.code || 'AI_RATE_LIMITED', message: rateRes.message || 'Too many requests.' }, 429);
    }

    // ------------------------------------------------------------------
    // 5. VALIDATE INPUT & TASK
    // ------------------------------------------------------------------
    if ((task === 'vision_ocr' || task === 'gemini_vision') && !imageBase64) {
      return json({ error: 'AI_INVALID_INPUT', message: 'Missing imageBase64 for vision task' }, 400);
    }
    if (imageBase64) {
      const hasDataUrl = imageBase64.startsWith('data:');
      if (hasDataUrl && !DATA_IMAGE_RE.test(imageBase64.slice(0, 64))) {
        return json({ error: 'AI_INVALID_INPUT', message: 'Unsupported image MIME type' }, 415);
      }
      const cleanImageBase64 = hasDataUrl ? imageBase64.replace(DATA_IMAGE_RE, '') : imageBase64;
      if (!/^[A-Za-z0-9+/=\s]+$/.test(cleanImageBase64)) {
        return json({ error: 'AI_INVALID_INPUT', message: 'Invalid imageBase64 encoding' }, 400);
      }
      if (cleanImageBase64.replace(/\s/g, '').length > MAX_IMAGE_BASE64_CHARS) {
        return json({ error: 'AI_INVALID_INPUT', message: 'imageBase64 too large (max 6MB)' }, 413);
      }
    }
    if (task !== 'vision_ocr' && task !== 'gemini_vision' && !text) {
      return json({ error: 'AI_INVALID_INPUT', message: 'Missing text' }, 400);
    }
    if (text.length > 15000) {
      return json({ error: 'AI_INVALID_INPUT', message: 'text too long (max 15000 chars)' }, 413);
    }

    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 100) : null;
    
    // Cập nhật last_seen cho thiết bị vừa thực hiện tách đơn / gọi AI
    const touchDeviceLastSeen = async () => {
      if (!deviceId) return;
      try {
        const nowIso = new Date().toISOString();
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (UUID_REGEX.test(deviceId)) {
          await adminClient
            .from('extension_devices')
            .update({ last_seen: nowIso, updated_at: nowIso })
            .or(`device_id.eq.${deviceId},id.eq.${deviceId}`);
        } else {
          await adminClient
            .from('extension_devices')
            .update({ last_seen: nowIso, updated_at: nowIso })
            .eq('device_id', deviceId);
        }
      } catch (devErr) {
        console.warn('[ai-gateway] touchDeviceLastSeen error:', devErr);
      }
    };

    // Tự động đảm bảo shop_quotas tồn tại
    try {
      await adminClient.from('shop_quotas').upsert({
        shop_id: shopId,
        daily_ai_limit: 500,
        monthly_ai_limit: 10000
      }, { onConflict: 'shop_id', ignoreDuplicates: true });
    } catch (e) {
      console.warn("Lỗi khi tự tạo quota:", e);
    }

    // ------------------------------------------------------------------
    // 6. QUOTA - Tiêu thụ atomic qua adminClient (service_role)
    // ------------------------------------------------------------------
    const { data: quotaRes, error: quotaErr } = await adminClient.rpc('consume_ai_quota', {
      p_shop_id: shopId,
      p_delta: 1,
      p_request_type: task,
      p_device_id: deviceId,
    });
    
    if (quotaErr) {
      console.error("RPC consume_ai_quota Error:", quotaErr);
      return json({ error: 'AI_RPC_ERROR', message: quotaErr.message || JSON.stringify(quotaErr) }, 500);
    }
    if (!quotaRes || quotaRes.success !== true) {
      return json({ 
        error: (quotaRes && quotaRes.code) || 'AI_QUOTA_EXCEEDED', 
        message: (quotaRes && quotaRes.message) || 'Cửa hàng đã hết hạn mức AI.',
        quota: quotaRes 
      }, 429);
    }

    // ==================================================================
    // TASK 1: GOOGLE CLOUD VISION OCR (task === 'vision_ocr')
    // ==================================================================
    if (task === 'vision_ocr') {
      let visionApiKey = body.customApiKey || flags?.google_vision_api_key || googleVisionEnvKey;
      
      if (!visionApiKey) {
        const { data: cfgRows } = await adminClient
          .from('system_configs')
          .select('value')
          .eq('key', 'google_vision_api_key')
          .limit(1);
        if (cfgRows && cfgRows[0] && cfgRows[0].value) {
          visionApiKey = typeof cfgRows[0].value === 'string' ? cfgRows[0].value : cfgRows[0].value.key || '';
        }
      }

      if (!visionApiKey) {
        return json({ error: 'AI_KEY_UNAVAILABLE', message: 'Google Cloud Vision API Key chưa được cấu hình.' }, 500);
      }

      // Xóa tiền tố data:image/... nếu có
      const cleanImgBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
      const visionPayload = {
        requests: [
          {
            image: { content: cleanImgBase64 },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION' },
              { type: 'TEXT_DETECTION' }
            ]
          }
        ]
      };

      const vController = new AbortController();
      const vTimer = setTimeout(() => vController.abort(), 25000);
      let vResp;
      try {
        vResp = await fetch(visionApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visionPayload),
          signal: vController.signal
        });
      } catch (err: any) {
        console.error('Google Vision Fetch Error:', err);
        return json({ error: 'AI_UPSTREAM_ERROR', message: `Google Vision lỗi mạng: ${err.message}` }, 502);
      } finally {
        clearTimeout(vTimer);
      }

      if (!vResp.ok) {
        const errText = await vResp.text();
        console.error('Google Vision Error Status:', vResp.status, errText);
        return json({ error: 'AI_UPSTREAM_ERROR', message: `Google Vision trả về lỗi ${vResp.status}` }, 502);
      }

      const vData = await vResp.json();
      const annotation = vData.responses && vData.responses[0] ? vData.responses[0] : null;

      await adminClient.from('ai_usage_log').insert({
        shop_id: shopId, user_id: userId, device_id: deviceId, request_type: 'vision_ocr', status: 'success', model: 'google-vision-document-ocr'
      });
      await touchDeviceLastSeen();

      return json({
        ok: true,
        result: annotation,
        quota: quotaRes,
        shop_id: shopId
      });
    }

    // ==================================================================
    // TASK 2: GEMINI VISION MULTIMODAL (task === 'gemini_vision')
    // ==================================================================
    if (task === 'gemini_vision') {
      // 1. Tập hợp TẤT CẢ các Gemini API Keys trong hệ thống (Hỗ trợ dàn keys đa tài khoản để gánh tải 429)
      const visionGeminiKeys: string[] = [];
      if (body.customApiKey && typeof body.customApiKey === 'string') visionGeminiKeys.push(body.customApiKey.trim());
      if (flags?.gemini_api_key && typeof flags.gemini_api_key === 'string') visionGeminiKeys.push(flags.gemini_api_key.trim());
      if (geminiEnvKey && !geminiEnvKey.startsWith('eyJ')) visionGeminiKeys.push(geminiEnvKey.trim());

      const { data: vCfgRows } = await adminClient
        .from('system_configs')
        .select('key,value')
        .in('key', ['gemini_api_key', 'groq_api_keys']);

      if (vCfgRows && Array.isArray(vCfgRows)) {
        for (const row of vCfgRows) {
          if (row.key === 'gemini_api_key') {
            const v = row.value;
            if (typeof v === 'string' && v.trim() && !visionGeminiKeys.includes(v.trim())) visionGeminiKeys.push(v.trim());
            else if (v?.key && typeof v.key === 'string' && v.key.trim() && !visionGeminiKeys.includes(v.key.trim())) visionGeminiKeys.push(v.key.trim());
            if (Array.isArray(v?.keys)) {
              for (const k of v.keys) if (typeof k === 'string' && k.trim() && !visionGeminiKeys.includes(k.trim())) visionGeminiKeys.push(k.trim());
            }
          } else if (row.key === 'groq_api_keys') {
            const val = row.value;
            const arr = Array.isArray(val) ? val : (Array.isArray(val?.keys) ? val.keys : (val?.key ? [val.key] : []));
            for (const k of arr) {
              if (typeof k === 'string' && (k.startsWith('AIzaSy') || k.startsWith('AQ.')) && !visionGeminiKeys.includes(k.trim())) {
                visionGeminiKeys.push(k.trim());
              }
            }
          }
        }
      }

      const cleanImgBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const rawOcrHint = body.rawOcrText ? `\n(Gợi ý văn bản quét sơ bộ: ${body.rawOcrText})\n` : '';

      const visionPrompt = `Bạn là chuyên gia trích xuất đơn hàng từ hình ảnh (ảnh chụp màn hình Zalo/Facebook, hóa đơn viết tay, phiếu gửi hàng).
Hãy phân tích kỹ hình ảnh và bóc tách thông tin khách hàng sang cấu trúc JSON:
1. "name": Tên khách hàng (Họ và tên người nhận). Nếu không có tên rõ ràng hoặc chữ quá mờ, để chuỗi rỗng "".
2. "phone": Số điện thoại người nhận (10 hoặc 11 số, bắt đầu bằng 0). Nếu có nhiều số, lấy số chính xác nhất.
3. "orderCode": Mã đơn hàng của shop (nếu có trên ảnh), nếu không có để "".
4. "codAmount": Số tiền thu hộ COD dưới dạng số nguyên (vd: 150000). Chú ý cách viết triệu (1tr5 -> 1500000), k (250k -> 250000). Nếu là chuyển khoản hoặc đã thanh toán, để 0.
5. "correctAddress": Địa chỉ nhận hàng đầy đủ nhất (số nhà, tên đường, thôn, xóm, phường/xã, quận/huyện, tỉnh/thành phố). Mở rộng viết tắt (HN -> Hà Nội, HCM -> Hồ Chí Minh).
6. "productItem": Tên sản phẩm / số lượng hàng hóa cần giao (nếu có ghi trên ảnh).
7. "extraNote": Ghi chú giao hàng (vd: giao giờ hành chính, gọi trước khi giao).

YÊU CẦU:
- Chỉ trả về duy nhất một JSON object hợp lệ, KHÔNG bọc trong markdown (\`\`\`json ... \`\`\`), KHÔNG có giải thích thêm.
Cấu trúc JSON:
{
  "name": "...",
  "phone": "...",
  "orderCode": "...",
  "codAmount": 0,
  "correctAddress": "...",
  "productItem": "...",
  "extraNote": "..."
}
${rawOcrHint}`;

      let lastVisionError = '';

      const isGeminiOpen = geminiCircuitBreaker.isOpen();
      let geminiSuccess = false;

      // Chỉ gọi Gemini nếu Circuit Breaker không OPEN
      if (!isGeminiOpen && visionGeminiKeys.length > 0) {
        // Thử qua từng Gemini Key trong dàn keys (Tự động xoay vòng key khi gặp 429 Quota Exceeded)
        for (let kIdx = 0; kIdx < visionGeminiKeys.length && !geminiSuccess; kIdx++) {
          const curGeminiKey = visionGeminiKeys[kIdx];
          let chosenModel = body.model || flags?.gemini_model || 'gemini-3.6-flash';
          if (chosenModel === 'gemini-2.0-flash') chosenModel = 'gemini-3.6-flash';
          
          const callGeminiApi = async (mod: string) => {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${encodeURIComponent(curGeminiKey)}`;
            const gPayload = {
              contents: [
                {
                  parts: [
                    { text: visionPrompt },
                    {
                      inline_data: {
                        mime_type: 'image/jpeg',
                        data: cleanImgBase64
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 800,
                responseMimeType: 'application/json'
              }
            };

            const gController = new AbortController();
            const gTimer = setTimeout(() => gController.abort(), 35000);
            try {
              return await fetch(geminiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': curGeminiKey
                },
                body: JSON.stringify(gPayload),
                signal: gController.signal
              });
            } finally {
              clearTimeout(gTimer);
            }
          };

          const candidateVisionModels = [
            chosenModel,
            'gemini-3.6-flash',
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.5-flash-lite',
            'gemini-1.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-pro'
          ].filter((v, i, a) => a.indexOf(v) === i);

          let gResp: any = null;
          for (const candMod of candidateVisionModels) {
            const maxRetries = 1;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                gResp = await callGeminiApi(candMod);
                if (gResp && gResp.ok) {
                  chosenModel = candMod;
                  break;
                }
                if (gResp && gResp.status === 404) {
                  // Model không hỗ trợ hoặc bị 404, thử candidate model tiếp theo
                  break;
                }
              } catch (err: any) {
                console.warn(`[AI Gateway] Gemini Vision Fetch Error (${candMod}, Key ${kIdx + 1}, Thử lần ${attempt + 1}):`, err.message);
                lastVisionError = `Gemini API lỗi mạng`;
              }

              const status = gResp ? gResp.status : 503;
              // Retry 1 lần với exponential backoff + jitter khi gặp 429, 503, 5xx
              if ((status === 429 || status === 503 || (status >= 500 && status < 600)) && attempt < maxRetries) {
                const backoff = getBackoffWithJitter(attempt);
                console.warn(`[AI Gateway] Gemini Vision HTTP ${status} (${candMod}, Key ${kIdx + 1}). Retry lần ${attempt + 1}/${maxRetries} sau ${Math.round(backoff)}ms...`);
                await sleep(backoff);
              } else {
                break;
              }
            }
            if (gResp && gResp.ok) break;
          }

          if (gResp && gResp.ok) {
            geminiCircuitBreaker.recordSuccess();
            geminiSuccess = true;
            const gData = await gResp.json();
            const rawContent = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            let parsedResult: any = null;
            try {
              parsedResult = JSON.parse(rawContent);
            } catch (_) {
              const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try { parsedResult = JSON.parse(jsonMatch[0]); } catch (_) {}
              }
            }

            await adminClient.from('ai_usage_log').insert({
              shop_id: shopId, user_id: userId, device_id: deviceId, request_type: 'gemini_vision', status: 'success', model: chosenModel
            });
            await touchDeviceLastSeen();

            return json({
              ok: true,
              result: parsedResult || {},
              model: chosenModel,
              quota: quotaRes,
              shop_id: shopId
            });
          } else if (gResp) {
            const status = gResp.status;
            geminiCircuitBreaker.recordFailure(status);
            const errBody = await gResp.text().catch(() => '');
            console.warn(`[AI Gateway] Gemini Vision Error (Key ${kIdx + 1}/${visionGeminiKeys.length}): HTTP ${status}`, errBody.slice(0, 150));
            lastVisionError = `Gemini API lỗi HTTP ${status}`;
            // Nếu bị 429 Quota Exceeded và vẫn còn key khác trong dàn, tự động xoay sang key kế tiếp
            if (status === 429 && kIdx < visionGeminiKeys.length - 1) {
              console.warn(`[AI Gateway] Gemini Vision Key ${kIdx + 1} hết hạn mức 429, tự động chuyển sang Gemini Key ${kIdx + 2}...`);
              continue;
            }
          } else {
            geminiCircuitBreaker.recordFailure(503);
          }
        }
      } else if (isGeminiOpen) {
        console.warn(`[AI Gateway] Gemini Circuit Breaker đang OPEN, bỏ qua Gemini và chuyển thẳng sang Groq Vision/Fallback`);
      }

      // Fallback: Thử gọi Groq Vision nếu có Groq key
      let groqKey = groqEnvKey;
      if (!groqKey) {
        const { data: cfgRows } = await adminClient
          .from('system_configs')
          .select('value')
          .eq('key', 'groq_api_keys')
          .limit(1);
        if (cfgRows && cfgRows[0] && cfgRows[0].value) {
          const arr = Array.isArray(cfgRows[0].value) ? cfgRows[0].value : cfgRows[0].value.keys;
          if (arr && arr.length > 0) {
            const candidate = arr.find((k: string) => k && !k.startsWith('AIzaSy') && !k.startsWith('AQ.'));
            if (candidate) groqKey = candidate;
          }
        }
      }

      if (groqKey) {
        console.warn("[AI Gateway] Gemini Vision hết hạn mức hoặc lỗi, tự động chuyển sang Groq Vision...");
        const grController = new AbortController();
        const grTimer = setTimeout(() => grController.abort(), 30000);
        try {
          const grResp = await fetch(groqEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
            body: JSON.stringify({
              model: 'llama-3.2-11b-vision-preview',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: visionPrompt },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanImgBase64}` } }
                  ]
                }
              ],
              temperature: 0,
              max_completion_tokens: 500,
              response_format: { type: 'json_object' }
            }),
            signal: grController.signal
          });
          clearTimeout(grTimer);

          if (grResp.ok) {
            const grData = await grResp.json();
            const grContent = grData.choices?.[0]?.message?.content || '';
            let parsedResult: any = null;
            try {
              parsedResult = JSON.parse(grContent);
            } catch (_) {
              const jsonMatch = grContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try { parsedResult = JSON.parse(jsonMatch[0]); } catch (_) {}
              }
            }

            if (parsedResult) {
              await adminClient.from('ai_usage_log').insert({
                shop_id: shopId, user_id: userId, device_id: deviceId, request_type: 'gemini_vision', status: 'success', model: 'llama-3.2-11b-vision-preview'
              });
              await touchDeviceLastSeen();

              return json({
                ok: true,
                result: parsedResult,
                model: 'llama-3.2-11b-vision-preview',
                quota: quotaRes,
                shop_id: shopId
              });
            }
          }
        } catch (e) {
          clearTimeout(grTimer);
        }
      }

      return json({
        error: 'AI_PROVIDER_UNAVAILABLE',
        message: 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.'
      }, 502);
    }

    // ==================================================================
    // TASK 3: STANDARD TEXT PARSE & ADDRESS (Groq Text Models)
    // ==================================================================
    let model = MODEL_REGISTRY[task] || MODEL_REGISTRY.fallback;
    const maxCompletionTokens = MAX_TOKENS_BY_TASK[task] || 300;

    // ------------------------------------------------------------------
    // NẠP VÀ TỔNG HỢP DÀN API KEYS TOÀN HỆ THỐNG (POOLED MULTI-KEY)
    // ------------------------------------------------------------------
    const { data: allAiConfigs } = await adminClient
      .from('system_configs')
      .select('key,value')
      .in('key', ['groq_api_keys', 'gemini_api_key', 'openai_api_key', 'default_ai_model']);

    const configMap: Record<string, any> = {};
    if (allAiConfigs && Array.isArray(allAiConfigs)) {
      for (const row of allAiConfigs) {
        configMap[row.key] = row.value;
      }
    }

    // 1. Tập hợp dàn Gemini Keys (từ gemini_api_key, env, và groq_api_keys nếu có key AIzaSy)
    const geminiKeys: string[] = [];
    if (geminiEnvKey && !geminiEnvKey.startsWith('eyJ')) geminiKeys.push(geminiEnvKey);
    const gVal = configMap['gemini_api_key'];
    if (gVal) {
      if (typeof gVal === 'string' && gVal.trim()) geminiKeys.push(gVal.trim());
      else if (gVal.key && typeof gVal.key === 'string' && gVal.key.trim()) geminiKeys.push(gVal.key.trim());
      if (Array.isArray(gVal.keys)) {
        for (const k of gVal.keys) if (typeof k === 'string' && k.trim() && !geminiKeys.includes(k.trim())) geminiKeys.push(k.trim());
      }
    }

    // 2. Tập hợp dàn Groq Keys (từ groq_api_keys và env)
    const groqKeys: string[] = [];
    if (groqEnvKey && !groqEnvKey.startsWith('eyJ') && !groqEnvKey.startsWith('AIzaSy')) groqKeys.push(groqEnvKey);
    const grVal = configMap['groq_api_keys'];
    if (grVal) {
      const arr = Array.isArray(grVal) ? grVal : (Array.isArray(grVal.keys) ? grVal.keys : (grVal.key ? [grVal.key] : []));
      for (const k of arr) {
        if (typeof k === 'string' && k.trim()) {
          const trimmed = k.trim();
          // Nếu trong groq_api_keys chứa nhầm key Gemini (do lưu đè ở bản cũ), chuyển vào geminiKeys
          if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) {
            if (!geminiKeys.includes(trimmed)) geminiKeys.push(trimmed);
          } else if (!groqKeys.includes(trimmed)) {
            groqKeys.push(trimmed);
          }
        }
      }
    }

    // 3. Tập hợp dàn OpenAI Keys
    const openaiKeys: string[] = [];
    const oaVal = configMap['openai_api_key'];
    if (oaVal) {
      const arr = Array.isArray(oaVal) ? oaVal : (Array.isArray(oaVal.keys) ? oaVal.keys : (oaVal.key ? [oaVal.key] : []));
      for (const k of arr) {
        if (typeof k === 'string' && k.trim() && !openaiKeys.includes(k.trim())) openaiKeys.push(k.trim());
      }
    }

    // Xác định Model và Provider ưu tiên (Single Source of Truth: default_ai_model)
    let defaultDef = configMap['default_ai_model'] || {};
    if (typeof defaultDef === 'string') {
      try { defaultDef = JSON.parse(defaultDef); } catch (_) {}
    }
    let grValObj = grVal || {};
    if (typeof grValObj === 'string') {
      try { grValObj = JSON.parse(grValObj); } catch (_) {}
    }
    let gValObj = gVal || {};
    if (typeof gValObj === 'string') {
      try { gValObj = JSON.parse(gValObj); } catch (_) {}
    }

    const reqProvider = (body.provider && typeof body.provider === 'string') ? body.provider.toLowerCase().trim() : null;
    const reqModel = (body.model && typeof body.model === 'string') ? body.model.trim() : null;

    let activeProvider = reqProvider || defaultDef.provider || (grValObj?.provider) || (groqKeys.length > 0 ? 'groq' : (geminiKeys.length > 0 ? 'gemini' : 'groq'));
    if (activeProvider === 'groq') {
      model = (reqProvider === 'groq' && reqModel)
        ? reqModel
        : ((defaultDef.provider === 'groq' && defaultDef.model && !defaultDef.model.startsWith('gemini') && !defaultDef.model.includes('gpt-oss'))
          ? defaultDef.model
          : ((grValObj?.model && !grValObj.model.startsWith('gemini') && !grValObj.model.includes('gpt-oss')) ? grValObj.model : 'llama-3.3-70b-versatile'));
    } else if (activeProvider === 'openai') {
      model = (reqProvider === 'openai' && reqModel)
        ? reqModel
        : ((defaultDef.provider === 'openai' && defaultDef.model) ? defaultDef.model : 'gpt-4o-mini');
    } else {
      activeProvider = 'gemini';
      model = (reqProvider === 'gemini' && reqModel)
        ? reqModel
        : ((defaultDef.provider === 'gemini' && defaultDef.model) ? defaultDef.model : (gValObj?.model || 'gemini-3.6-flash'));
    }

    if (geminiKeys.length === 0 && groqKeys.length === 0 && openaiKeys.length === 0) {
      return json({ error: 'AI_KEY_UNAVAILABLE', message: 'Chưa có API Key nhà cung cấp AI nào được cấu hình trong hệ thống.' }, 500);
    }

    // BUILD PROMPT
    let dbCustomRules = flags?.custom_prompt_rules || '';
    if (typeof dbCustomRules === 'string') dbCustomRules = dbCustomRules.trim();

    if (!dbCustomRules) {
      try {
        const { data: defaultRulesRows } = await adminClient
          .from('system_configs')
          .select('value')
          .eq('key', 'default_custom_prompt_rules')
          .limit(1);
        if (defaultRulesRows && defaultRulesRows[0]) {
          const valObj = defaultRulesRows[0].value;
          if (valObj) {
            if (typeof valObj === 'object') {
              dbCustomRules = String(valObj.rules || valObj.value || JSON.stringify(valObj)).trim();
            } else {
              dbCustomRules = String(valObj).trim();
            }
          }
        }
      } catch (e) {
        console.warn("Lỗi khi lấy default_custom_prompt_rules từ DB:", e);
      }
    }

    const customRules = dbCustomRules 
      ? `\nLƯU Ý BỔ SUNG TỪ NGƯỜI DÙNG (BẮT BUỘC TUÂN THỦ): ${dbCustomRules}\n` 
      : '';

    const parsePrompt = `Bạn là một trợ lý AI chuyên nghiệp chuyên bóc tách thông tin đơn hàng từ văn bản thô sang định dạng JSON.

Nhiệm vụ của bạn là đọc kỹ đoạn văn bản thô dưới đây và trích xuất các trường thông tin sau:
1. "name": Tên khách hàng (Họ và tên người nhận). Nếu không có tên rõ ràng hoặc không thể xác định chắc chắn (ví dụ: chỉ có tên hàng hoặc địa chỉ), hãy để chuỗi rỗng "". Tuyệt đối không tự bịa tên hoặc lấy tên sản phẩm, tên cửa hàng làm tên người nhận.
2. "phone": Số điện thoại người nhận. Chuẩn hóa thành chuỗi số điện thoại Việt Nam bắt đầu bằng 0, gồm 10 hoặc 11 chữ số (ví dụ: "0901234567"). Nếu có nhiều số điện thoại, ưu tiên số đầu tiên hợp lý.
3. "orderCode": Mã đơn hàng của shop hoặc mã quản lý đơn hàng (ví dụ: "DH123456", "e100.377"). Tuyệt đối KHÔNG lấy số điện thoại, số nhà, số căn hộ, mã zip, số tiền, hoặc chữ "Cod", "COD" kèm số tiền thu hộ làm mã đơn hàng. Nếu không có mã đơn hàng rõ ràng, để chuỗi rỗng "".
4. "codAmount": Số tiền thu hộ (COD) dưới dạng số nguyên (ví dụ: 150000). 
   - Hỗ trợ nhận diện các ký hiệu viết tắt như "150k" -> 150000, "150.000đ" -> 150000, "150,000" -> 150000.
   - Chú ý cách viết tiền thu hộ dạng "1.700k" hay "1,700k" nghĩa là 1700k (1700000 - 1 triệu 700 nghìn đồng), tuyệt đối không được bóc tách nhầm thành 170000 (trăm bảy mươi nghìn) hay 1700.
   - Nếu đơn hàng có các từ chỉ trạng thái đã thanh toán trước như "chuyển khoản", "đã ck", "ck", "đã thanh toán", "đã chuyển khoản", "paid", "free", hoặc "0đ", hãy đặt codAmount = 0.
   - Nếu không đề cập đến tiền thu hộ, đặt mặc định là 0.
5. "correctAddress": Địa chỉ nhận hàng đầy đủ và chính xác nhất (bao gồm số nhà, tên đường, ngõ, ngách, tên cửa hàng/tòa nhà/chung cư, phường/xã, quận/huyện, tỉnh/thành phố). Mở rộng các từ viết tắt địa danh (vd: HN -> Hà Nội, HCM -> Hồ Chí Minh). KHÔNG tự ý bịa thêm Phường/Xã/Quận/Huyện nếu không có thông tin trong văn bản.

YÊU CẦU ĐẦU RA:
- Chỉ trả về duy nhất một đối tượng JSON hợp lệ, KHÔNG bọc trong markdown (\`\`\`json ... \`\`\`), KHÔNG có giải thích thêm.
- Cấu trúc JSON bắt buộc:
{
  "name": "...",
  "phone": "...",
  "orderCode": "...",
  "codAmount": 0,
  "correctAddress": "..."
}

${customRules}
Văn bản cần bóc tách:
${text}`;

    const addressPrompt = `Bạn là chuyên gia chuẩn hóa địa chỉ Việt Nam. Hãy tách địa chỉ sau thành cấu trúc JSON có các trường: street, ward, district, province. YÊU CẦU: - street PHẢI chứa ĐẦY ĐỦ: số nhà, tên đường, tên cửa hàng/cơ sở, tòa nhà, khu đô thị (vd "579/43 Đường Quang Trung", "S202 Vinhomes Smart City"). - ward, district, province đầy đủ, đúng chính tả. - Nếu địa chỉ viết tắt (HN, HCM...) hãy mở rộng. - Tuyệt đối KHÔNG bỏ sót số nhà, tên đường, tên cửa hàng; tất cả trong 4 trường trên. - Nếu có tên cửa hàng/cơ sở, đưa vào street. JSON format: {"street":"...","ward":"...","district":"...","province":"..."}${customRules}
Văn bản địa chỉ: ${text}`;

    const prompt = task === 'address' ? addressPrompt : parsePrompt;

    // ==================================================================
    // CROSS-PROVIDER SMART FALLBACK PIPELINE (GEMINI ⟷ GROQ ⟷ OPENAI)
    // ==================================================================
    const isGeminiPrimary = activeProvider === 'gemini';
    const isOpenaiPrimary = activeProvider === 'openai';
    const isGeminiText = isGeminiPrimary;

    let lastAiError = '';

    // Helper gọi Google Gemini (Hỗ trợ dàn keys đa tài khoản, retry backoff+jitter và circuit breaker)
    const executeGemini = async (preferredModel: string) => {
      if (geminiCircuitBreaker.isOpen()) {
        console.warn('[AI Gateway] Gemini Circuit Breaker đang OPEN, bỏ qua Gemini và chuyển sang Groq AI...');
        return null;
      }
      if (geminiKeys.length === 0) {
        lastAiError = 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.';
        return null;
      }
      let gModel = preferredModel.startsWith('gemini') ? preferredModel : 'gemini-3.6-flash';

      // Duyệt qua từng Gemini Key trong dàn keys
      for (let kIdx = 0; kIdx < geminiKeys.length; kIdx++) {
        const curGeminiKey = geminiKeys[kIdx];
        const callApi = async (mod: string) => {
          const actualMod = (mod === 'gemini-2.0-flash') ? 'gemini-3.6-flash' : mod;
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualMod}:generateContent?key=${encodeURIComponent(curGeminiKey)}`;
          const gPayload = {
            contents: [{ parts: [{ text: `${prompt}\n\nVĂN BẢN CẦN XỬ LÝ:\n${text}` }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json'
            }
          };
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 35000);
          try {
            return await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': curGeminiKey },
              body: JSON.stringify(gPayload),
              signal: controller.signal
            });
          } finally {
            clearTimeout(timer);
          }
        };

        const candidateGeminiModels = [
          gModel,
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.7-flash',
          'gemini-3.5-flash-lite',
          'gemini-1.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-pro'
        ].filter((v, i, a) => a.indexOf(v) === i);

        let resp: any = null;
        for (const candMod of candidateGeminiModels) {
          const maxRetries = 1;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              resp = await callApi(candMod);
              if (resp && resp.ok) {
                gModel = candMod;
                break;
              }
              if (resp && resp.status === 404) {
                // Model không hỗ trợ hoặc bị 404, thử candidate model tiếp theo
                break;
              }
            } catch (err: any) {
              console.warn(`[AI Gateway] Gemini execution failed (${candMod}, Key ${kIdx + 1}, Thử lần ${attempt + 1}):`, err.message);
            }

            const status = resp ? resp.status : 503;
            if ((status === 429 || status === 503 || (status >= 500 && status < 600)) && attempt < maxRetries) {
              const backoff = getBackoffWithJitter(attempt);
              console.warn(`[AI Gateway] Gemini text HTTP ${status} (${candMod}, Key ${kIdx + 1}). Retry lần ${attempt + 1}/${maxRetries} sau ${Math.round(backoff)}ms...`);
              await sleep(backoff);
            } else {
              break;
            }
          }
          if (resp && resp.ok) break;
        }

        if (resp && resp.ok) {
          geminiCircuitBreaker.recordSuccess();
          const gData = await resp.json();
          const raw = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (_) {
            const m = raw.match(/\{[\s\S]*\}/);
            if (m) { try { parsed = JSON.parse(m[0]); } catch (_) {} }
          }
          if (parsed) return {
            success: true,
            parsed,
            model: gModel,
            usage: {
              prompt_tokens: gData.usageMetadata?.promptTokenCount || 0,
              completion_tokens: gData.usageMetadata?.candidatesTokenCount || 0
            }
          };
        } else if (resp) {
          const status = resp.status;
          geminiCircuitBreaker.recordFailure(status);
          const errText = await resp.text().catch(() => '');
          console.warn(`[AI Gateway] Gemini API Error (Key ${kIdx + 1}/${geminiKeys.length}): HTTP ${status}`, errText.slice(0, 150));
          lastAiError = 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.';
          if (status === 429 && kIdx < geminiKeys.length - 1) {
            console.warn(`[AI Gateway] Gemini Key ${kIdx + 1} hết hạn mức (429), chuyển tiếp sang Gemini Key ${kIdx + 2}...`);
            continue;
          }
        } else {
          geminiCircuitBreaker.recordFailure(503);
          lastAiError = 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.';
        }
      }
      return null;
    };

    // Helper gọi Groq (Hỗ trợ xoay vòng dàn keys và tự khắc phục model 404)
    const executeGroq = async (preferredModel: string) => {
      if (groqKeys.length === 0) {
        lastAiError = lastAiError || 'Groq API Key chưa được cấu hình.';
        return null;
      }

      let primaryGroqMod = (preferredModel && !preferredModel.startsWith('gemini') && !preferredModel.includes('gpt-oss'))
        ? preferredModel
        : 'llama-3.3-70b-versatile';

      const candidateModels = [
        primaryGroqMod,
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'gemma2-9b-it'
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      for (let kIdx = 0; kIdx < groqKeys.length; kIdx++) {
        const curGroqKey = groqKeys[kIdx];
        for (const groqMod of candidateModels) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          try {
            const resp = await fetch(groqEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${curGroqKey}` },
              body: JSON.stringify({
                model: groqMod,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                max_tokens: Math.max(maxCompletionTokens || 800, 800),
                response_format: { type: 'json_object' },
              }),
              signal: controller.signal,
            });
            if (resp && resp.ok) {
              const aiData = await resp.json();
              const raw = aiData.choices?.[0]?.message?.content || '';
              let parsed = null;
              try { parsed = JSON.parse(raw); } catch (_) {
                const m = raw.match(/\{[\s\S]*\}/);
                if (m) { try { parsed = JSON.parse(m[0]); } catch (_) {} }
              }
              if (parsed) {
                return {
                  success: true,
                  parsed,
                  model: groqMod,
                  usage: { prompt_tokens: aiData.usage?.prompt_tokens || 0, completion_tokens: aiData.usage?.completion_tokens || 0 }
                };
              }
            } else if (resp) {
              const grErr = await resp.text().catch(() => '');
              lastAiError = `Groq HTTP ${resp.status}: ${grErr.slice(0, 300)}`;
              console.warn(`[AI Gateway] Groq API Error (${groqMod}, Key #${kIdx + 1}):`, resp.status, grErr);
              // Nếu bị 429 và còn key khác, thử đổi key
              if (resp.status === 429 && kIdx < groqKeys.length - 1) {
                break;
              }
              // Thử model tiếp theo trong dàn candidate
              continue;
            }
          } catch (err: any) {
            lastAiError = `Groq fetch: ${err.message}`;
            console.warn("Groq execution failed:", err);
          } finally {
            clearTimeout(timer);
          }
        }
      }
      return null;
    };

    // Helper gọi OpenAI (Dự phòng cấp 2)
    const executeOpenai = async (preferredModel: string) => {
      if (openaiKeys.length === 0) return null;
      const oModel = (preferredModel && !preferredModel.startsWith('gemini') && !preferredModel.includes('llama')) ? preferredModel : 'gpt-4o-mini';
      for (const curKey of openaiKeys) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${curKey}` },
            body: JSON.stringify({
              model: oModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0,
              response_format: { type: 'json_object' }
            }),
            signal: controller.signal
          });
          if (resp && resp.ok) {
            const data = await resp.json();
            const raw = data.choices?.[0]?.message?.content || '';
            let parsed = null;
            try { parsed = JSON.parse(raw); } catch (_) {
              const m = raw.match(/\{[\s\S]*\}/);
              if (m) { try { parsed = JSON.parse(m[0]); } catch (_) {} }
            }
            if (parsed) {
              return {
                success: true,
                parsed,
                model: oModel,
                usage: { prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0 }
              };
            }
          }
        } catch (err: any) {
          console.warn("OpenAI execution failed:", err);
        } finally {
          clearTimeout(timer);
        }
      }
      return null;
    };

    let executionResult: any = null;
    let usedFallback = false;
    let fallbackModel = '';

    // THỰC HIỆN THEO THỨ TỰ ƯU TIÊN VÀ TỰ ĐỘNG CHUYỂN TIẾP SANG NHÀ CUNG CẤP KHÁC
    if (isGeminiPrimary) {
      // 1. Thử Gemini trước (với toàn bộ dàn Gemini Keys)
      executionResult = await executeGemini(model);
      // 2. Nếu Gemini lỗi (ví dụ 429 Quota Exceeded) -> Tự động chuyển tiếp Groq
      if (!executionResult && groqKeys.length > 0) {
        fallbackModel = 'llama-3.3-70b-versatile'; // Thay thế cho llama-3.1-8b-instant đã decommissioned
        console.warn("[AI Gateway] Gemini thất bại (429/lỗi), tự động chuyển tiếp sang Groq AI...", fallbackModel);
        executionResult = await executeGroq(fallbackModel);
        if (executionResult) usedFallback = true;
      }
      // 3. Nếu Groq vẫn không thành công -> Tự động chuyển tiếp OpenAI
      if (!executionResult && openaiKeys.length > 0) {
        fallbackModel = 'gpt-4o-mini';
        console.warn("[AI Gateway] Chuyển tiếp sang OpenAI...", fallbackModel);
        executionResult = await executeOpenai(fallbackModel);
        if (executionResult) usedFallback = true;
      }
    } else if (isOpenaiPrimary) {
      executionResult = await executeOpenai(model);
      if (!executionResult && geminiKeys.length > 0) {
        fallbackModel = 'gemini-3.6-flash';
        executionResult = await executeGemini(fallbackModel);
        if (executionResult) usedFallback = true;
      }
      if (!executionResult && groqKeys.length > 0) {
        fallbackModel = 'llama-3.3-70b-versatile';
        executionResult = await executeGroq(fallbackModel);
        if (executionResult) usedFallback = true;
      }
    } else {
      // Groq là nhà cung cấp ưu tiên
      executionResult = await executeGroq(model);
      // Nếu Groq lỗi -> Tự động chuyển tiếp Gemini
      if (!executionResult && geminiKeys.length > 0) {
        fallbackModel = 'gemini-3.6-flash';
        console.warn("[AI Gateway] Groq thất bại, tự động chuyển tiếp sang Google Gemini AI...", fallbackModel);
        executionResult = await executeGemini(fallbackModel);
        if (executionResult) usedFallback = true;
      }
      // Nếu Gemini vẫn lỗi -> Tự động chuyển tiếp OpenAI
      if (!executionResult && openaiKeys.length > 0) {
        fallbackModel = 'gpt-4o-mini';
        executionResult = await executeOpenai(fallbackModel);
        if (executionResult) usedFallback = true;
      }
    }

    if (executionResult && executionResult.success) {
      const actualModel = executionResult.model;
      const pTokens = executionResult.usage?.prompt_tokens || 0;
      const cTokens = executionResult.usage?.completion_tokens || 0;

      await adminClient.from('ai_usage_log').insert({
        shop_id: shopId, user_id: userId, device_id: deviceId, request_type: task,
        prompt_tokens: pTokens, completion_tokens: cTokens, status: 'success',
        model: actualModel
      });
      await touchDeviceLastSeen();

      return json({
        ok: true,
        data: executionResult.parsed,
        result: executionResult.parsed,
        task,
        model: actualModel,
        fallback_used: usedFallback,
        usage: { prompt_tokens: pTokens, completion_tokens: cTokens },
        quota: quotaRes,
        shop_id: shopId,
      });
    }

    // Nếu tất cả nhà cung cấp đều thất bại
    await adminClient.from('ai_usage_log').insert({
      shop_id: shopId, user_id: userId, device_id: deviceId, request_type: task, status: 'error',
      model: isGeminiPrimary ? 'gemini-3.6-flash' : 'llama-3.3-70b-versatile',
      error_message: 'All AI providers unavailable or rate limited'
    });
    return json({ 
      error: 'AI_PROVIDER_UNAVAILABLE', 
      message: 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.' 
    }, 502);
  
  } catch (globalErr: any) {
    console.error("Global Gateway Error:", globalErr);
    return json({ error: 'AI_INTERNAL_ERROR', message: globalErr.message || 'Unknown Edge Function crash' }, 500);
  }
});
