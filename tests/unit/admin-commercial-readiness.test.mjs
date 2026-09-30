import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const repository = read('src/domain/admin/admin.repository.js');
const service = read('src/domain/admin/admin.service.js');
const overview = read('src/ui/admin-dashboard/pages/Overview/Overview.jsx');
const header = read('src/ui/admin-dashboard/components/Header.jsx');
const app = read('src/ui/admin-dashboard/App.jsx');
const commercial = read('src/ui/admin-dashboard/components/CommercialMetrics.jsx');

assert.match(service, /getOverviewMetrics\(range/, 'overview service must accept a real date range');
assert.match(service, /AdminRepository\.getKpis\(range\)/, 'overview service must pass range to repository');
assert.match(repository, /static async getKpis\(range/, 'KPI repository must accept a date range');
assert.doesNotMatch(repository, /aiRequestsToday\s*=\s*ordersToday/, 'AI usage must never be inferred from order count');

assert.match(overview, /getOverviewMetrics\(datePreset\)/, 'Overview must request metrics for selected range');
assert.match(overview, /searchParams\.set\('range'/, 'Overview range must be persisted in URL');
assert.doesNotMatch(overview, /\+18\.4%/, 'Overview must not render a hard-coded MRR delta');
assert.match(overview, /metrics\.mrr_delta_percent/, 'Overview must render measured MRR delta');
assert.match(overview, /data_source/, 'Overview must disclose metric data source');
assert.match(overview, /setError\(/, 'Overview must expose an error state');

assert.match(header, /function Header\(\{[^}]*userRole[^}]*onSearch/, 'Header must receive real role and global-search callback');
assert.match(header, /onChange=.*setQuery/, 'global search input must be wired through debounced state');
assert.match(header, /350/, 'global search must be debounced');
assert.match(app, /AdminService\.globalSearch/, 'App must execute unified global search');
assert.doesNotMatch(header, />SYSTEM_ADMIN</, 'Header must not hard-code SYSTEM_ADMIN');
assert.match(app, /<Header[\s\S]*userRole=\{userRole\}/, 'App must pass the authenticated role to Header');
for (const table of ['subscriptions', 'payment_transactions', 'support_tickets', 'license_keys', 'ai_usage_log']) {
  assert.match(app, new RegExp(`table: '${table}'`), `Admin realtime must include ${table}`);
}

assert.match(commercial, /const \[loading, setLoading\]/, 'Commercial metrics must have loading state');
assert.match(commercial, /const \[error, setError\]/, 'Commercial metrics must have error state');
assert.doesNotMatch(commercial, /if \(!data\) return null/, 'Commercial metric errors must not disappear silently');

console.log('Admin commercial readiness contracts passed.');
