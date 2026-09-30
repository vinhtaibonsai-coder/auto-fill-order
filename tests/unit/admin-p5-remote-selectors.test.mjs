import assert from 'node:assert/strict';import fs from 'node:fs';
const migration=fs.readFileSync('database/migrations/v111_remote_selector_release_safety.sql','utf8');
const runtime=fs.readFileSync('src/runtime/content/carrier-runtime.js','utf8');
const page=fs.readFileSync('src/ui/admin-dashboard/pages/Carriers/CarrierHealth.jsx','utf8');
assert.match(migration,/admin_rollback_remote_selectors/);assert.match(migration,/ROLLBACK_REASON_REQUIRED/);
assert.match(runtime,/min_extension_version/);assert.match(runtime,/30_000/);assert.match(runtime,/compareVersions/);
assert.match(page,/rollbackRemoteSelectors/);assert.match(page,/selectorHistory/);
console.log('Admin P5 remote selector safety contracts passed.');
