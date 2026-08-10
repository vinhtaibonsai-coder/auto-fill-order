// =============================================================================
// AI GATEWAY - Supabase Edge Function (Deno)
//
// Kiến trúc (xem AUTO_FILL_ORDER_OFFICIAL_SOURCE_AUDIT P0-02/P0-03/P0-04):
//
//   Extension ──raw order──▶ Edge Function ──▶ Groq ──▶ AI response ──▶ Extension
//                     ├── authenticate (Supabase Auth verify — không decode thủ công)
//                     ├── check shop (shop_members)
//                     ├── check feature flag (shop_feature_flags)
//                     ├── rate limit   (RPC sliding window)
//                     ├── quota        (RPC atomic consume_ai_quota)
//                     ├── select Groq key (SERVER-SIDE — không bao giờ trả về)
//                     ├── select model  (SERVER-SIDE registry — client chỉ gửi task)
//                     └── audit / ai_usage_log
//
// Extension KHÔNG bao giờ biết Groq API key.
// Extension KHÔNG thể chọn model tùy ý — gateway dùng task → model registry.
//
// Deploy:
//   supabase functions deploy ai-gateway --project-ref <ref>
//
// Env (Edge Function secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (có sẵn)
//   GROQ_API_KEY  (tuỳ chọn: nếu đặt thì ưu tiên; nếu trống dùng groq_api_keys
//                  trong bảng system_configs)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const groqEnvKey = Deno.env.get('GROQ_API_KEY') || '';
const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ------------------------------------------------------------------
// SERVER-SIDE MODEL REGISTRY (P0-03)
// Client chỉ gửi task name, gateway quyết định model.
// Không bao giờ cho client chọn model tùy ý.
// ------------------------------------------------------------------
const MODEL_REGISTRY: Record<string, string> = {
  parse:   'llama-3.1-8b-instant',
  address: 'llama-3.1-8b-instant',
  vision:  'llama-3.2-11b-vision-preview',
  fallback: 'llama-3.1-8b-instant',
};

const MAX_TOKENS_BY_TASK: Record<string, number> = {
  parse:   300,
  address: 200,
  vision:  500,
  fallback: 256,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let body;
    try { body = await req.json(); } catch (_) { return json({ error: 'AI_INVALID_INPUT', message: 'Invalid JSON' }, 400); }

    // ------------------------------------------------------------------
    // 1. AUTHENTICATE - Verify JWT bằng Supabase Auth (không decode thủ công)
    // P0-03 / P1-16: Dùng adminClient.auth.getUser() để xác thực token thật.
    // ------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'AI_AUTH_REQUIRED', message: 'Missing authorization token' }, 401);

    // Client dùng token user: tất cả RPC bên dưới chạy với auth.uid() = userId
    const userClient = createClient(supabaseUrl, token, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { apikey: serviceRoleKey } },
    });

    // Client service-role: CHỈ DÙNG TRONG EDGE để đọc Groq key / config ẩn.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify token thật qua Supabase Auth (không chỉ decode payload)
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return json({ error: 'AI_AUTH_REQUIRED', message: 'Invalid or expired token' }, 401);
    }
    const userId = user.id;

    // ------------------------------------------------------------------
    // 2. CHECK SHOP
    // ------------------------------------------------------------------
    let shopId = typeof body.shop_id === 'string' && body.shop_id ? body.shop_id : null;
    if (!shopId) {
      const { data: members } = await adminClient
        .from('shop_members')
        .select('shop_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('removed_at', null)
        .order('created_at', { ascending: true })
        .limit(1);
      shopId = members && members[0] ? members[0].shop_id : null;
    }
    if (!shopId) {
      return json({ error: 'AI_SHOP_REQUIRED', message: 'Account is not assigned to a shop.' }, 403);
    }

    // ------------------------------------------------------------------
    // 3. CHECK FEATURE FLAG
    // ------------------------------------------------------------------
    const { data: flags } = await adminClient
      .from('shop_feature_flags')
      .select('ai_parsing_enabled, use_system_groq_key, custom_prompt_rules')
      .eq('shop_id', shopId)
      .maybeSingle();
    const aiEnabled = flags?.ai_parsing_enabled !== false;
    if (!aiEnabled) {
      return json({ error: 'AI_FEATURE_DISABLED', message: 'AI parsing disabled for this shop.' }, 403);
    }

    // ------------------------------------------------------------------
    // 4. RATE LIMIT (DB sliding window)
    // ------------------------------------------------------------------
    const { data: rateRes } = await userClient.rpc('check_ai_rate_limit', { p_shop_id: shopId });
    if (rateRes && rateRes.success === false) {
      return json({ error: rateRes.code || 'AI_RATE_LIMITED', message: rateRes.message || 'Too many requests.' }, 429);
    }

    // ------------------------------------------------------------------
    // 5. VALIDATE INPUT
    // ------------------------------------------------------------------
    const text = String(body.text || '').trim();
    if (!text) {
      return json({ error: 'AI_INVALID_INPUT', message: 'Missing text' }, 400);
    }
    if (text.length > 12000) {
      return json({ error: 'AI_INVALID_INPUT', message: 'text too long (max 12000 chars)' }, 413);
    }

    // ------------------------------------------------------------------
    // 6. TASK & MODEL (SERVER-SIDE REGISTRY — client không chọn model)
    // P0-03: body.model bị bỏ qua hoàn toàn.
    // ------------------------------------------------------------------
    const task = body.task === 'address' ? 'address' : 'parse';
    let model = MODEL_REGISTRY[task] || MODEL_REGISTRY.fallback;
    const maxCompletionTokens = MAX_TOKENS_BY_TASK[task] || 300;

    // ------------------------------------------------------------------
    // 7. QUOTA - tiêu thụ atomic (một lần duy nhất, ở gateway)
    // P1-15: Quota chỉ được consume ở gateway. Extension không consume quota.
    // ------------------------------------------------------------------
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 100) : null;
    
    // Tự động đảm bảo shop_quotas tồn tại để tránh lỗi "Hết hạn mức" ảo
    try {
      await adminClient.from('shop_quotas').upsert({
        shop_id: shopId,
        daily_ai_limit: 500,
        monthly_ai_limit: 10000
      }, { onConflict: 'shop_id', ignoreDuplicates: true });
    } catch (e) {
      console.warn("Lỗi khi tự tạo quota (không chặn luồng):", e);
    }

    const { data: quotaRes, error: quotaErr } = await userClient.rpc('consume_ai_quota', {
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
      return json({ error: (quotaRes && quotaRes.code) || 'AI_QUOTA_EXCEEDED', quota: quotaRes }, 429);
    }

    // ------------------------------------------------------------------
    // 8. SELECT GROQ KEY - SERVER-SIDE, không bao giờ gửi về client
    // ------------------------------------------------------------------
    let apiKey = '';
    if (flags?.use_system_groq_key !== false) {
      const { data: cfgRows } = await adminClient
        .from('system_configs')
        .select('key,value')
        .eq('key', 'groq_api_keys')
        .limit(1);
      
      const configValue = cfgRows && cfgRows[0] ? cfgRows[0].value : null;
      let arr = [];
      
      if (Array.isArray(configValue)) {
        arr = configValue;
      } else if (configValue && Array.isArray(configValue.keys)) {
        arr = configValue.keys;
        if (configValue.model) {
          model = configValue.model;
        }
      }
      
      if (arr.length > 0) {
        apiKey = arr[Math.floor(Math.random() * arr.length)];
      }
    }

    // Fallback to Env key (but avoid using Supabase JWT tokens accidentally set in Env)
    if (!apiKey && groqEnvKey && !groqEnvKey.startsWith('eyJ')) {
      apiKey = groqEnvKey;
    }

    if (!apiKey) {
      return json({ error: 'AI_KEY_UNAVAILABLE', message: 'AI provider key not configured.' }, 500);
    }

    // ------------------------------------------------------------------
    // 9. BUILD PROMPT
    // ------------------------------------------------------------------
    let dbCustomRules = flags?.custom_prompt_rules || '';
    if (typeof dbCustomRules === 'string') dbCustomRules = dbCustomRules.trim();

    // Nếu Shop không có cấu hình luật AI riêng, lấy luật dùng chung mặc định từ system_configs
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

    const callGroq = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const resp = await fetch(groqEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_completion_tokens: maxCompletionTokens,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        return resp;
      } catch (err) {
        console.error("Groq fetch error:", err);
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

  let groqResp = await callGroq();
  if (groqResp.status >= 500 && groqResp.status < 600) {
    await new Promise((r) => setTimeout(r, 800));
    groqResp = await callGroq();
  }

  if (!groqResp.ok) {
    const status = groqResp.status;
    const errorCode = status === 429 ? 'AI_RATE_LIMITED' : status >= 500 ? 'AI_PROVIDER_UNAVAILABLE' : 'AI_UPSTREAM_ERROR';
    await adminClient.from('ai_usage_log').insert({
      shop_id: shopId, user_id: userId, device_id: deviceId, request_type: task, status: 'error',
    });
    return json({ error: errorCode, status }, status === 429 ? 429 : 502);
  }

  const aiData = await groqResp.json();
  const content = aiData.choices && aiData.choices[0] ? aiData.choices[0].message.content : '';
  let parsed;
  try { parsed = JSON.parse(content); } catch (_) { parsed = null; }

  const promptTokens = aiData.usage?.prompt_tokens || 0;
  const completionTokens = aiData.usage?.completion_tokens || 0;

  if (parsed) {
    await adminClient.from('ai_usage_log').insert({
      shop_id: shopId, user_id: userId, device_id: deviceId, request_type: task,
      prompt_tokens: promptTokens, completion_tokens: completionTokens, status: 'success',
    });
  }

  // ------------------------------------------------------------------
  // 11. RESPONSE — KHÔNG BAO GIỜ chứa Groq API key
  // ------------------------------------------------------------------
  return json({
    ok: true,
    result: parsed,
    task,
    model, // trả về model đã dùng để client có thể hiển thị diagnostic
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    quota: quotaRes,
    shop_id: shopId,
  });
  
  } catch (globalErr) {
    console.error("Global Gateway Error:", globalErr);
    return json({ error: 'AI_INTERNAL_ERROR', message: globalErr.message || 'Unknown Edge Function crash' }, 500);
  }
});