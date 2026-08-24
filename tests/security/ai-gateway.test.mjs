// =============================================================================
// ai-gateway.test.mjs - Integration security test for the AI Gateway edge function
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const ENV = process.env;
const required = [
  'TEST_SUPABASE_URL',
  'TEST_SUPABASE_ANON_KEY',
  'TEST_MEMBER_EMAIL',
  'TEST_MEMBER_PASS',
  'TEST_SHOP_A_ID',
  'TEST_SHOP_B_ID'
];

const missing = required.filter(k => !ENV[k]);
console.log('== AI Gateway Integration Security Test ==');
if (missing.length > 0) {
  console.log('SKIP: Missing required environment variables:', missing.join(', '));
  process.exit(0);
}

const client = createClient(ENV.TEST_SUPABASE_URL, ENV.TEST_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

let failures = 0;
const report = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'} [${name}] ${detail}`);
  if (!pass) failures++;
};

async function invokeGateway(token, payload) {
  try {
    const endpoint = `${ENV.TEST_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/ai-gateway`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const status = resp.status;
    const body = await resp.json().catch(() => ({}));
    return { status, body };
  } catch (e) {
    return { status: 0, body: { error: e.message } };
  }
}

const { data: signIn, error: errA } = await client.auth.signInWithPassword({
  email: ENV.TEST_MEMBER_EMAIL,
  password: ENV.TEST_MEMBER_PASS
});
report('member sign-in', !errA && !!signIn?.session?.access_token, errA?.message || 'ok');

if (!signIn?.session?.access_token) {
  process.exit(1);
}

const token = signIn.session.access_token;

const { status: invalidStatus } = await invokeGateway('invalid_token', {
  action: 'runGroqAddressOnly',
  shop_id: ENV.TEST_SHOP_A_ID,
  addressText: 'Ha Noi'
});
report('Gateway rejects invalid token', invalidStatus === 401 || invalidStatus === 403, `HTTP ${invalidStatus}`);

const { status: crossShopStatus, body: crossShopBody } = await invokeGateway(token, {
  action: 'runGroqAddressOnly',
  shop_id: ENV.TEST_SHOP_B_ID,
  addressText: 'Ha Noi'
});
report('Gateway rejects cross-shop access', crossShopStatus === 403, `HTTP ${crossShopStatus} ${JSON.stringify(crossShopBody)}`);

console.log('\n== AI Gateway Summary ==');
console.log(failures === 0 ? 'ALL PASS' : `${failures} test(s) FAIL`);
process.exit(failures === 0 ? 0 : 1);
