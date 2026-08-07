// =============================================================================
// rls-isolation.test.js — CROSS-SHOP ISOLATION SECURITY TEST
//
// Mục đích (theo mục 18/38 của review):
//   Chứng minh:
//     1. user SHOP A KHÔNG đọc được orders của SHOP B (RLS)
//     2. user không phải admin KHÔNG gọi được admin_* RPC (guard)
//     3. get_user_role: KHÔNG xem được role người khác (IDOR guard, v16)
//     4. consume_ai_quota: KHÔNG tiêu thụ cho shop không thuộc về mình
//
// Cách chạy:
//   node tests/security/rls-isolation.test.js
//
// Cấu hình: đặt biến môi trường
//   SB_URL, SB_ANON_KEY, TEST_MEMBER_EMAIL, TEST_MEMBER_PASS,
//   TEST_SHOP_A_ID, TEST_SHOP_B_ID, TEST_OTHER_USER_ID, ADMIN_EMAIL, ADMIN_PASS
// Nếu thiếu biến -> chạy ở '@mode offline' chỉ validate cấu hình.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Lưu ý: dùng ESM với Deno/node-fetch. Nếu chạy Node local, thay bằng:
//   import { createClient } from '@supabase/supabase-js';

const ENV = process.env;
const required = [
  'SB_URL', 'SB_ANON_KEY', 'SB_MEMBER_EMAIL', 'SB_MEMBER_PASS',
  'SB_SHOP_A_ID', 'SB_SHOP_B_ID', 'SB_OTHER_USER_ID',
];
const missing = required.filter(k => !ENV[k]);
console.log('== Cross-Shop Isolation Security Test ==');
if (missing.length > 0) {
  console.log('SKIP: thiếu biến môi trường:', missing.join(', '));
  console.log('Chạy bằng env nếu muốn active. (offline config check)');
  process.exit(0);
}

const admin = createClient(ENV.TEST_SUPABASE_URL, ENV.TEST_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
let failures = 0;
const report = (name, pass, detail) => {
  console.log(`${pass ? 'PASS' : 'FAIL'} [${name}] ${detail || ''}`);
  if (!pass) failures++;
};

// 1. Đăng nhập user SHOP_A
const memberA = createClient(ENV.TEST_SUPABASE_URL, ENV.TEST_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: signInA, error: errA } = await memberA.auth.signInWithPassword({
  email: ENV.TEST_MEMBER_EMAIL,
  password: ENV.TEST_MEMBER_PASS,
});
report('member sign-in', !errA && !!signInA, errA?.message || 'ok');

// 2. Cross-shop SELECT (RLS): user A đọc orders của SHOP B -> phải bằng 0
if (signInA) {
  const { data: ordersB, error: errB } = await memberA
    .from('orders')
    .select('id')
    .eq('shop_id', ENV.TEST_SHOP_B_ID)
    .limit(10);
  const blocked = errB || (ordersB && ordersB.length === 0);
  report('CROSS-SHOP SELECT denied', !!blocked, `rows=${ordersB?.length || 0}`);
}

// 3. RPC guard: user không admin gọi admin_list_users -> phải lỗi
if (signInA) {
  const { data: listed, error: errL } = await memberA.rpc('admin_list_users');
  report('admin_list_users guard', !!errL, errL?.message || 'UNEXPECTED ACCESS');
}

// 4. IDOR: get_user_role người khác -> phải lỗi
if (signInA) {
  const { data, error: errR } = await memberA.rpc('get_user_role', {
    p_user_id: ENV.SB_OTHER_USER_ID,
  });
  report('IDOR guard on get_user_role', !!errR, errR?.message || 'UNEXPECTED ROLE');
}

// 5. Quota: user A consume quota cho SHOP B -> phải bị từ chối
if (signInA) {
  const { data: q, error: errQ } = await memberA.rpc('consume_ai_quota', {
    p_shop_id: ENV.TEST_SHOP_B_ID,
    p_delta: 1,
  });
  const denied = errQ || (q && q.code === 'ACCESS_DENIED');
  report('QUOTA deny cross-shop', !!denied, JSON.stringify(q?.code || errQ?.message));
}

console.log('\n== TỔNG KẾT ==');
console.log(failures === 0 ? 'ALL PASS ✅' : `${failures} test(s) FAIL ❌`);
process.exit(failures === 0 ? 0 : 1);