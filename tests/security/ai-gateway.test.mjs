// =============================================================================
// ai-gateway.test.mjs - SECURITY TEST FOR AI GATEWAY EDGE FUNCTION
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const ENV = process.env;
const required = [
  'TEST_SUPABASE_URL', 'TEST_SUPABASE_ANON_KEY', 'TEST_MEMBER_EMAIL', 'TEST_MEMBER_PASS',
  'TEST_SHOP_A_ID', 'TEST_SHOP_B_ID'
];
const missing = required.filter(k => !ENV[k]);
console.log('== AI Gateway Integration Security Test ==');
if (missing.length > 0) {
  console.error('FAIL: Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const client = createClient(ENV.TEST_SUPABASE_URL, ENV.TEST_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
const report = (name, pass, detail) => {
  console.log(${pass ? 'PASS' : 'FAIL'} [] );
  if (!pass) failures++;
};

async function invokeGateway(token, payload) {
  try {
    const url = new URL(ENV.TEST_SUPABASE_URL);
    const endpoint = ${url.protocol}///functions/v1/ai-gateway;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': \Bearer \\,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const status = resp.status;
    const body = await resp.json().catch(() => ({}));
    return { status, body };
  } catch (e) {
    return { status: 0, body: e.message };
  }
}

(async () => {
  const { data: signIn, error: errA } = await client.auth.signInWithPassword({
    email: ENV.TEST_MEMBER_EMAIL,
    password: ENV.TEST_MEMBER_PASS,
  });
  report('member sign-in', !errA && !!signIn, errA?.message || 'ok');
  
  if (!signIn) {
    process.exit(1);
  }
  
  const token = signIn.session.access_token;
  
  const { status: s1 } = await invokeGateway('invalid_token', {
    action: 'runGroqAddressOnly',
    shopId: ENV.TEST_SHOP_A_ID,
    addressText: 'Hà Nội'
  });
  report('Gateway Rejects Invalid Token (401)', s1 === 401 || s1 === 403, \HTTP \\);

  const { status: s2, body: b2 } = await invokeGateway(token, {
    action: 'runGroqAddressOnly',
    shopId: ENV.TEST_SHOP_B_ID,
    addressText: 'Hà Nội'
  });
  report('Gateway Rejects Cross-Shop Access (403)', s2 === 403, \HTTP \, \\);
  
  console.log('\n== TỔNG KẾT AI GATEWAY ==');
  console.log(failures === 0 ? 'ALL PASS ✅' : \\ test(s) FAIL ❌\);
  process.exit(failures === 0 ? 0 : 1);
})();