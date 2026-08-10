const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xlgovgynbsahuykyjzcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ292Z3luYnNhaHV5a3lqemN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODg2MTksImV4cCI6MjEwMDE2NDYxOX0.AytQ0MPBklNajTadr2KyNwk-UP7JQZJ-UWdTGtIEyeM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('system_configs').select('*').eq('key', 'groq_api_keys');
  console.log(JSON.stringify({ data, error }, null, 2));
}
run();
