import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(path.join(root, 'database/migrations/v81_auth_login_repair.sql'), 'utf8');
const consolidated = fs.readFileSync(path.join(root, 'database/migrations/RUN_ALL_MIGRATIONS.sql'), 'utf8');
const repairReplacement = /DROP FUNCTION IF EXISTS public\.admin_repair_user_auth\(TEXT, TEXT\);\s*CREATE OR REPLACE FUNCTION public\.admin_repair_user_auth/;

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_repair_user_auth/);
assert.match(
  migration,
  repairReplacement,
  'v81 must drop the legacy function before removing its parameter default'
);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.admin_reset_user_password/);
assert.match(migration, /FROM auth\.users u[\s\S]*lower\(trim\(u\.email\)\)/);
assert.match(migration, /DELETE FROM auth\.identities/);
assert.match(migration, /email_confirmed_at = COALESCE\(email_confirmed_at, now\(\)\)/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_repair_user_auth\(TEXT, TEXT\) TO anon/);
assert.match(consolidated, /FILE: v81_auth_login_repair\.sql/);
assert.match(consolidated, /CREATE OR REPLACE FUNCTION public\.admin_repair_user_auth/);
assert.match(
  consolidated,
  repairReplacement,
  'RUN_ALL must drop the legacy function before removing its parameter default'
);

console.log('Auth login migration contract passed.');
