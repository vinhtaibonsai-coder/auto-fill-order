import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xlgovgynbsahuykyjzcx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'; // MUST REPLACE OR USE SERVICE KEY
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_KEY'; // MUST REPLACE

async function run() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // 1. Get first active shop
  const { data: shops } = await adminClient.from('shops').select('id, name').limit(1);
  if (!shops || shops.length === 0) {
    console.log("No shops found");
    return;
  }
  const shopId = shops[0].id;
  console.log("Testing shop:", shops[0].name, shopId);

  // 2. Test get_ai_budget
  const { data: budget, error: budgetErr } = await adminClient.rpc('get_ai_budget', { p_shop_id: shopId });
  console.log("Budget:", budget, budgetErr);

  // 3. Test consume_ai_quota
  const { data: consume, error: consumeErr } = await adminClient.rpc('consume_ai_quota', {
    p_shop_id: shopId,
    p_delta: 1,
    p_prompt_tokens: 0,
    p_completion_tokens: 0,
    p_request_type: 'parse',
    p_device_id: 'test_script'
  });
  console.log("Consume:", consume, consumeErr);
}

run();
