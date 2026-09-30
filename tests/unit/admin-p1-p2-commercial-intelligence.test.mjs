import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const migration = read('database/migrations/v109_admin_p1_p2_commercial_intelligence.sql');
const repository = read('src/domain/admin/admin.repository.js');
const service = read('src/domain/admin/admin.service.js');
const component = read('src/ui/admin-dashboard/components/CommercialIntelligence.jsx');
const overview = read('src/ui/admin-dashboard/pages/Overview/Overview.jsx');

for (const token of ['commercial_cost_entries', 'ai_model_cost_rates', 'admin_get_commercial_intelligence', 'admin_global_search']) {
  assert.match(migration, new RegExp(token), `migration must provide ${token}`);
}
assert.match(migration, /cac/i);
assert.match(migration, /ltv/i);
assert.match(migration, /churn/i);
assert.match(migration, /cohort/i);
assert.match(repository, /getCommercialIntelligence\(/);
assert.match(repository, /globalSearch\(/);
assert.match(service, /getCommercialIntelligence\(/);
assert.match(service, /globalSearch\(/);
assert.match(component, /ExportButton/);
assert.match(component, /shop_margins/);
assert.match(component, /cohorts/);
assert.match(overview, /CommercialIntelligence/);

console.log('Admin P1/P2 commercial intelligence contracts passed.');
