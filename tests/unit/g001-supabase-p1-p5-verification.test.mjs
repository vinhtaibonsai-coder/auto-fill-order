import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// 1. Static migration contract assertions
console.log('--- 1. Checking Static Migration Contracts for v109, v110, v111 ---');

const v109 = read('database/migrations/v109_admin_p1_p2_commercial_intelligence.sql');
const v110 = read('database/migrations/v110_admin_p3_retention_engine.sql');
const v111 = read('database/migrations/v111_remote_selector_release_safety.sql');

// v109 checks
assert.match(v109, /CREATE TABLE IF NOT EXISTS public\.commercial_cost_entries/, 'v109 must create commercial_cost_entries');
assert.match(v109, /CREATE TABLE IF NOT EXISTS public\.ai_model_cost_rates/, 'v109 must create ai_model_cost_rates');
assert.match(v109, /ALTER TABLE public\.commercial_cost_entries ENABLE ROW LEVEL SECURITY/, 'v109 must enable RLS on commercial_cost_entries');
assert.match(v109, /ALTER TABLE public\.ai_model_cost_rates ENABLE ROW LEVEL SECURITY/, 'v109 must enable RLS on ai_model_cost_rates');
assert.match(v109, /CREATE OR REPLACE FUNCTION public\.admin_get_commercial_intelligence/, 'v109 must create admin_get_commercial_intelligence');
assert.match(v109, /CREATE OR REPLACE FUNCTION public\.admin_global_search/, 'v109 must create admin_global_search');
assert.match(v109, /GRANT EXECUTE ON FUNCTION public\.admin_get_commercial_intelligence/, 'v109 must grant execute on admin_get_commercial_intelligence');
assert.match(v109, /GRANT EXECUTE ON FUNCTION public\.admin_global_search/, 'v109 must grant execute on admin_global_search');

// v110 checks
assert.match(v110, /CREATE TABLE IF NOT EXISTS public\.retention_actions/, 'v110 must create retention_actions');
assert.match(v110, /ALTER TABLE public\.retention_actions ENABLE ROW LEVEL SECURITY/, 'v110 must enable RLS on retention_actions');
assert.match(v110, /CREATE OR REPLACE FUNCTION public\.admin_get_retention_portfolio/, 'v110 must create admin_get_retention_portfolio');
assert.match(v110, /CREATE OR REPLACE FUNCTION public\.admin_record_retention_action/, 'v110 must create admin_record_retention_action');
assert.match(v110, /GRANT EXECUTE ON FUNCTION public\.admin_get_retention_portfolio/, 'v110 must grant execute on admin_get_retention_portfolio');

// v111 checks
assert.match(v111, /ALTER TABLE public\.remote_selector_releases ADD COLUMN IF NOT EXISTS rollback_reason/, 'v111 must add rollback_reason');
assert.match(v111, /ALTER TABLE public\.remote_selector_releases ADD COLUMN IF NOT EXISTS rolled_back_at/, 'v111 must add rolled_back_at');
assert.match(v111, /ALTER TABLE public\.remote_selector_releases ADD COLUMN IF NOT EXISTS rolled_back_by/, 'v111 must add rolled_back_by');
assert.match(v111, /CREATE OR REPLACE FUNCTION public\.admin_list_remote_selector_releases/, 'v111 must create admin_list_remote_selector_releases');
assert.match(v111, /CREATE OR REPLACE FUNCTION public\.admin_rollback_remote_selectors/, 'v111 must create admin_rollback_remote_selectors');
assert.match(v111, /GRANT EXECUTE ON FUNCTION public\.admin_list_remote_selector_releases/, 'v111 must grant execute on admin_list_remote_selector_releases');

console.log('Static migration contracts verified for v109, v110, v111.');

// 2. Live Supabase read-only schema & permission verification
console.log('--- 2. Checking Live Supabase Schema & Member Rejection ---');

const supabaseUrl = process.env.TEST_SUPABASE_URL || 'https://xlgovgynbsahuykyjzcx.supabase.co';
const anonKey = process.env.TEST_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ292Z3luYnNhaHV5a3lqemN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODg2MTksImV4cCI6MjEwMDE2NDYxOX0.AytQ0MPBklNajTadr2KyNwk-UP7JQZJ-UWdTGtIEyeM';

const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

async function verifyLiveDb() {
  // 2.1 Table Existence and Column Accessibility
  const tCost = await client.from('commercial_cost_entries').select('id,cost_type,amount,occurred_at,shop_id,source').limit(1);
  assert.equal(tCost.error, null, `commercial_cost_entries read error: ${JSON.stringify(tCost.error)}`);

  const tRates = await client.from('ai_model_cost_rates').select('model,input_cost_per_million,output_cost_per_million,currency').limit(1);
  assert.equal(tRates.error, null, `ai_model_cost_rates read error: ${JSON.stringify(tRates.error)}`);

  const tRetention = await client.from('retention_actions').select('id,shop_id,action_type,status').limit(1);
  assert.equal(tRetention.error, null, `retention_actions read error: ${JSON.stringify(tRetention.error)}`);

  const tReleases = await client.from('remote_selector_releases').select('id,rollback_reason,rolled_back_at,rolled_back_by').limit(1);
  assert.equal(tReleases.error, null, `remote_selector_releases columns read error: ${JSON.stringify(tReleases.error)}`);

  console.log('Verified: tables commercial_cost_entries, ai_model_cost_rates, retention_actions, and remote_selector_releases columns exist in PostgREST schema cache.');

  // 2.2 Member / Non-Admin Access Denial for RPCs
  const now = new Date().toISOString();

  const r1 = await client.rpc('admin_get_commercial_intelligence', {
    p_from: now, p_to: now, p_previous_from: now, p_previous_to: now
  });
  assert(r1.error && r1.error.message.includes('ACCESS_DENIED'), `admin_get_commercial_intelligence must reject non-admin: ${JSON.stringify(r1)}`);

  const r2 = await client.rpc('admin_global_search', { p_query: 'test', p_limit: 5 });
  assert(r2.error && r2.error.message.includes('ACCESS_DENIED'), `admin_global_search must reject non-admin: ${JSON.stringify(r2)}`);

  const r3 = await client.rpc('admin_get_retention_portfolio', { p_inactive_days: 3, p_expiring_days: 3 });
  assert(r3.error && r3.error.message.includes('ACCESS_DENIED'), `admin_get_retention_portfolio must reject non-admin: ${JSON.stringify(r3)}`);

  const r4 = await client.rpc('admin_list_remote_selector_releases', { p_carrier_code: 'VNPOST', p_limit: 5 });
  assert(r4.error && r4.error.message.includes('ACCESS_DENIED'), `admin_list_remote_selector_releases must reject non-admin: ${JSON.stringify(r4)}`);

  console.log('Verified: All 4 administrative RPCs strictly reject non-admin callers with ACCESS_DENIED.');

  // 3. SYSTEM_ADMIN invocation
  const adminToken = process.env.TEST_ADMIN_TOKEN;
  let adminClient = null;

  if (adminToken) {
    adminClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
      auth: { persistSession: false }
    });
  } else if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASS) {
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASS
    });
    if (!authError && authData?.session?.access_token) {
      adminClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
        auth: { persistSession: false }
      });
    }
  }

  if (adminClient) {
    console.log('--- 3. Testing SYSTEM_ADMIN Calls ---');
    const adminR1 = await adminClient.rpc('admin_get_commercial_intelligence', {
      p_from: now, p_to: now, p_previous_from: now, p_previous_to: now
    });
    assert.equal(adminR1.error, null, `admin_get_commercial_intelligence error: ${JSON.stringify(adminR1.error)}`);
    assert(adminR1.data && typeof adminR1.data === 'object', 'Must return jsonb object');
    assert('revenue' in adminR1.data, 'Must contain revenue field');
    assert('shop_margins' in adminR1.data, 'Must contain shop_margins field');
    assert('cohorts' in adminR1.data, 'Must contain cohorts field');

    const adminR2 = await adminClient.rpc('admin_global_search', { p_query: 'shop', p_limit: 5 });
    assert.equal(adminR2.error, null, `admin_global_search error: ${JSON.stringify(adminR2.error)}`);
    assert(Array.isArray(adminR2.data), 'admin_global_search must return array');

    const adminR3 = await adminClient.rpc('admin_get_retention_portfolio', { p_inactive_days: 3, p_expiring_days: 3 });
    assert.equal(adminR3.error, null, `admin_get_retention_portfolio error: ${JSON.stringify(adminR3.error)}`);
    assert(adminR3.data && typeof adminR3.data === 'object', 'Must return jsonb object');
    assert('shops' in adminR3.data, 'Must contain shops list');
    assert('trial_shops' in adminR3.data, 'Must contain trial_shops');

    const adminR4 = await adminClient.rpc('admin_list_remote_selector_releases', { p_carrier_code: 'VNPOST', p_limit: 5 });
    assert.equal(adminR4.error, null, `admin_list_remote_selector_releases error: ${JSON.stringify(adminR4.error)}`);
    assert(Array.isArray(adminR4.data), 'admin_list_remote_selector_releases must return array');

    console.log('Verified: All 4 RPCs return correct schema when invoked by SYSTEM_ADMIN.');
    return { status: 'DONE', details: 'All checks passed including SYSTEM_ADMIN live calls.' };
  } else {
    console.log('NOTICE: SYSTEM_ADMIN live call requires TEST_ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASS in environment.');
    return {
      status: 'BLOCKED',
      reason: 'Missing SYSTEM_ADMIN credentials/token in environment (TEST_ADMIN_TOKEN or ADMIN_EMAIL+ADMIN_PASS) to execute privileged RPC calls.'
    };
  }
}

verifyLiveDb()
  .then(res => {
    console.log('Result:', JSON.stringify(res));
    if (res.status === 'BLOCKED') {
      console.log('G001 Live DB read-only checks passed; SYSTEM_ADMIN call blocked by missing credentials.');
    } else {
      console.log('G001 Verification completely successful.');
    }
  })
  .catch(err => {
    console.error('Validation failure:', err);
    process.exit(1);
  });
