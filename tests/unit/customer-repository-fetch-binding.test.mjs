import assert from 'node:assert/strict';
import { CustomerRepository } from '../../src/application/customer/customer.repository.js';
import fs from 'node:fs';

// 1. Verify CustomerRepository fetch binding contract
function mockNativeFetch(url, options) {
  // Native window.fetch throws if `this` is not Window/globalThis
  if (this !== globalThis && (typeof window === 'undefined' || this !== window)) {
    throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{ id: 'cust-1', name: 'Test Customer', phone: '0912345678' }])
  });
}

const repo = new CustomerRepository({
  config: { url: 'https://test.supabase.co', anonKey: 'anon-key-123' },
  session: { access_token: 'jwt-token-xyz', active_shop_id: 'shop-001' },
  fetchImpl: mockNativeFetch
});

// Calling listCustomers invokes this.fetch as a method on `repo`
const customers = await repo.listCustomers();
assert.ok(Array.isArray(customers) && customers.length === 1, 'listCustomers should succeed without Illegal invocation');
assert.equal(customers[0].name, 'Test Customer');

// 2. Verify ShopService resilience contract
const shopServiceCode = fs.readFileSync('src/domain/shop/shop.service.js', 'utf8');
assert.match(shopServiceCode, /const hasAnySuccess = queryResponses\.some\(r => r && r\.ok\)/, 'ShopService must check for at least one successful query');
assert.match(shopServiceCode, /activeShopRes/, 'ShopService must include activeShopRes fallback');
assert.doesNotMatch(shopServiceCode, /!ownerRes \|\| !ownerRes\.ok \|\| !memberRes/, 'ShopService must not strictly abort if only one query fails');

console.log('Customer repository fetch binding and ShopService resilience tests passed.');
