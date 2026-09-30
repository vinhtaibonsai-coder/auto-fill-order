import assert from 'node:assert/strict';

export function assertCustomerMetrics(customer, expected) {
  for (const [key, value] of Object.entries(expected)) assert.equal(customer[key], value, `Unexpected customer metric: ${key}`);
}

export function assertTenantRows(rows, shopId) {
  assert.ok(rows.every(row => row.shop_id === shopId), `Rows leaked outside shop ${shopId}`);
}
