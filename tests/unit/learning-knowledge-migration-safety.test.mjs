import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => fs.readFileSync(path.join(rootDir, relative), 'utf8');

const historical = read('database/migrations/v100_mine_historical_orders_to_learning_kb.sql');
assert.doesNotMatch(historical, /UPDATE\s+public\.submitted_orders/i,
  'Knowledge mining must never mutate submitted orders');
assert.doesNotMatch(historical, /OR\s+o\.shop_id\s+IS\s+NULL/i,
  'A Shop must never ingest orphan orders');
assert.doesNotMatch(historical, /OR\s+c\.shop_id\s+IS\s+NULL/i,
  'A Shop must never ingest orphan customers');
assert.doesNotMatch(historical, /v_default_shop_id/i,
  'Historical data must never be assigned to an arbitrary default Shop');
assert.match(historical, /o\.shop_id\s+IS\s+NOT\s+NULL/i);
assert.match(historical, /c\.shop_id\s+IS\s+NOT\s+NULL/i);

const repairPath = path.join(rootDir, 'database/migrations/v103_learning_knowledge_production_safety.sql');
assert.ok(fs.existsSync(repairPath), 'A forward repair migration must protect already-deployed databases');
const repair = fs.readFileSync(repairPath, 'utf8');

for (const contract of [
  /field_correction/,
  /source_type\s+TEXT/i,
  /verified_at\s+TIMESTAMPTZ/i,
  /verified_by\s+UUID/i,
  /lookup_count\s+INT/i,
  /CREATE OR REPLACE FUNCTION public\.verify_shop_learning_entry/i,
  /CREATE OR REPLACE FUNCTION public\.delete_shop_learning_entry/i,
  /CREATE OR REPLACE FUNCTION public\.is_safe_global_alias/i,
  /REVOKE INSERT, UPDATE, DELETE ON public\.shop_learning_kb FROM authenticated/i,
  /REVOKE EXECUTE ON FUNCTION public\.get_active_global_aliases\(\) FROM anon/i
]) {
  assert.match(repair, contract);
}

assert.match(repair, /DROP FUNCTION IF EXISTS public\.get_admin_learning_candidates\(INT\);[\s\S]*?CREATE OR REPLACE FUNCTION public\.get_admin_learning_candidates/i,
  'Changing the candidate return contract must drop the exact function signature first');
assert.doesNotMatch(repair, /DROP[^;]*CASCADE/i, 'Authorization migrations must never use DROP CASCADE');

const candidateFunction = repair.match(/CREATE OR REPLACE FUNCTION public\.get_admin_learning_candidates[\s\S]*?\$\$;/i)?.[0] || '';
assert.match(candidateFunction, /FROM\s+public\.shop_address_aliases/i,
  'Global candidates must come from deliberate Shop aliases');
assert.doesNotMatch(candidateFunction, /FROM\s+public\.shop_learning_kb/i,
  'Private raw customer addresses must never become global candidates');

const syncFunction = repair.match(/CREATE OR REPLACE FUNCTION public\.sync_shop_learning_batch[\s\S]*?\$\$;/i)?.[0] || '';
assert.match(syncFunction, /source_rank/i, 'Upsert conflict resolution must use provenance priority');
assert.doesNotMatch(syncFunction, /confidence\s*=\s*GREATEST/i,
  'A new value must not retain an unrelated old confidence score');

const optionsCode = read('src/ui/options/pages/AddressEngine/AddressEngine.jsx');
assert.match(optionsCode, /rpc\/verify_shop_learning_entry/);
assert.match(optionsCode, /rpc\/delete_shop_learning_entry/);
assert.match(optionsCode, /addressLearningDB:/,
  'Options deletion and verification must update the active Shop cache');

const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
assert.match(runAll, /LEARNING KNOWLEDGE PRODUCTION SAFETY \(v103\)/,
  'The consolidated migration entry point must include the safety repair');

console.log('✅ Learning knowledge migration and governance safety contracts passed.');
