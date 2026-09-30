import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('database/migrations/v64_customer_hub_360.sql', 'utf8');
const addCustomerCreatedAt = sql.indexOf('ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ');
const firstCustomerCreatedAtUse = sql.indexOf('last_order_at = COALESCE(last_order_at, latest_date, created_at)');
assert.ok(addCustomerCreatedAt >= 0 && addCustomerCreatedAt < firstCustomerCreatedAtUse,
  'migration must add legacy customers.created_at before reading it');
const addCustomerId = sql.indexOf('ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id UUID');
const firstCustomerForeignKey = sql.indexOf('REFERENCES public.customers(id)');
const customerIdUniqueIndex = sql.indexOf('customers_id_uidx');
assert.ok(addCustomerId >= 0 && customerIdUniqueIndex > addCustomerId && customerIdUniqueIndex < firstCustomerForeignKey,
  'migration must create a unique customers.id before foreign keys reference it');
assert.doesNotMatch(sql, /NEW\.created_at/, 'shared order trigger must not reference a column missing from legacy submitted_orders');
for (const table of ['customer_addresses','customer_order_links','customer_notes','customer_tags','customer_tag_assignments','customer_risk_events','customer_sync_jobs']) {
  assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
  assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
}
for (const fn of ['customer_hub_normalize_phone','customer_hub_sync_order','customer_hub_backfill_batch','customer_hub_audit_export','customer_hub_rebuild_metrics','customer_hub_set_blacklist']) assert.match(sql, new RegExp(`FUNCTION public\\.${fn}`));
assert.match(sql, /trg_customer_hub_sync_job_audit/);
assert.match(sql, /event_type='delivery_failure'/);
assert.match(sql, /UNIQUE\(shop_id, source_type, source_order_id\)/);
assert.match(sql, /customer_order_links_canonical_uidx/);
console.log('Customer Hub schema contracts passed.');
