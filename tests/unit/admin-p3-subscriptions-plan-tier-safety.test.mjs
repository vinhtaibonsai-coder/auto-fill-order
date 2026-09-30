import assert from 'node:assert/strict';
import fs from 'node:fs';

const v110 = fs.readFileSync('database/migrations/v110_admin_p3_retention_engine.sql', 'utf8');
const v112 = fs.readFileSync('database/migrations/v112_fix_subscriptions_plan_tier_schema.sql', 'utf8');

// Ensure schema alters subscriptions with ADD COLUMN IF NOT EXISTS for both plan_tier and plan_code
assert.match(v110, /ALTER TABLE public\.subscriptions ADD COLUMN IF NOT EXISTS plan_tier/);
assert.match(v110, /ALTER TABLE public\.subscriptions ADD COLUMN IF NOT EXISTS plan_code/);
assert.match(v110, /COALESCE\(sub\.plan_tier,sub\.plan_code/);

assert.match(v112, /ALTER TABLE public\.subscriptions ADD COLUMN IF NOT EXISTS plan_tier/);
assert.match(v112, /ALTER TABLE public\.subscriptions ADD COLUMN IF NOT EXISTS plan_code/);
assert.match(v112, /tr_sync_subscriptions_tier_code/);

console.log('Subscriptions plan_tier schema safety test passed.');
