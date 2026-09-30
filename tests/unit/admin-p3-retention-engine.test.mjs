import assert from 'node:assert/strict'; import fs from 'node:fs';
const migration=fs.readFileSync('database/migrations/v110_admin_p3_retention_engine.sql','utf8');
const page=fs.readFileSync('src/ui/admin-dashboard/pages/Retention/RetentionCenter.jsx','utf8');
const repo=fs.readFileSync('src/domain/admin/admin.repository.js','utf8');
assert.match(migration,/retention_actions/); assert.match(migration,/admin_get_retention_portfolio/); assert.match(migration,/trial_conversion_percent/);
assert.match(repo,/getRetentionPortfolio/); assert.match(page,/ExportButton/); assert.match(page,/AT_RISK/); assert.match(page,/recordRetentionAction/);
console.log('Admin P3 retention engine contracts passed.');
