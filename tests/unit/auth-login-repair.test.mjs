import assert from 'node:assert/strict';

// Regression contract for the HTTP 500 self-healing login path.  A repair
// that succeeds must be followed by a successful token response; this test
// catches accidental regressions where the retry response cannot replace the
// initial failed response.
await import('../../src/domain/auth/auth.service.js');

const AuthService = globalThis.AuthService;
assert.ok(AuthService, 'AuthService must be exposed for the login contract');

const originalFetch = globalThis.fetch;
const originalConfig = globalThis.SUPABASE_CONFIG;

const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

try {
  globalThis.SUPABASE_CONFIG = {
    url: 'https://example.supabase.co',
    anonKey: 'test-anon-key'
  };
  AuthService.fetchUserProfile = async () => ({
    id: 'user-1',
    email: 'toxic@afo.vn',
    full_name: 'Toxic'
  });
  AuthService._fetchUserRBAC = async () => ({
    active_shop_id: null,
    permissions: [],
    role: 'SHOP_OWNER',
    features: {}
  });

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return jsonResponse(500, { msg: 'internal server error' });
    }
    if (calls.length === 2) {
      return jsonResponse(200, { success: true });
    }
    return jsonResponse(200, {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      user: { id: 'user-1', email: 'toxic@afo.vn' }
    });
  };

  const result = await AuthService.loginWithUsernameOrEmail('toxic@afo.vn', 'admin123@');
  assert.equal(result.session.access_token, 'access-token');
  assert.equal(calls.length, 3, 'login should repair once and retry exactly once');
  assert.match(calls[1].url, /\/rest\/v1\/rpc\/admin_repair_user_auth$/);
  assert.match(calls[2].url, /\/auth\/v1\/token\?grant_type=password$/);
  console.log('Auth login repair retry contract passed.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalConfig === undefined) delete globalThis.SUPABASE_CONFIG;
  else globalThis.SUPABASE_CONFIG = originalConfig;
}
