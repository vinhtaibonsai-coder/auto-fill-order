const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xlgovgynbsahuykyjzcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ292Z3luYnNhaHV5a3lqemN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU4ODYxOSwiZXhwIjoyMTAwMTY0NjE5fQ.PqbHDnTxUDT0zSO8RXVHbr53p0DAmY76IlbUXYjWpR4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking tables in database...");
  
  const { data: logData, error: logErr } = await supabase.from('ai_usage_log').select('count');
  console.log("ai_usage_log check:", { exists: !logErr, count: logData ? logData.length : null, error: logErr ? logErr.message : null });

  const { data: logsData, error: logsErr } = await supabase.from('ai_usage_logs').select('count');
  console.log("ai_usage_logs check:", { exists: !logsErr, count: logsData ? logsData.length : null, error: logsErr ? logsErr.message : null });

  // Query database definitions to see what tables exist
  const { data: tables, error: tablesErr } = await supabase.rpc('get_admin_kpis').catch(err => ({ error: err }));
  console.log("get_admin_kpis RPC test:", { data: tables, error: tablesErr ? tablesErr.message : null });
}

run();
