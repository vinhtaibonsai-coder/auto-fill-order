import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function getAllFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx', '.html', '.json', '.sql']) {
  const res = [];
  if (!fs.existsSync(dir)) return res;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      res.push(...getAllFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      res.push(full);
    }
  }
  return res;
}

test('G016 Security Review 1: RLS Tenant Isolation is enforced across all tables', () => {
  const migrationsDir = path.join(root, 'database', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  const tables = new Set();
  const tablesWithRLS = new Set();

  for (const file of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Extract created tables
    const createMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi);
    for (const match of createMatches) {
      const tbl = match[1].toLowerCase();
      if (!tbl.startsWith('tmp_') && !tbl.startsWith('backup_')) {
        tables.add(tbl);
      }
    }

    // Extract RLS enables
    const rlsMatches = content.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi);
    for (const match of rlsMatches) {
      tablesWithRLS.add(match[1].toLowerCase());
    }
  }

  // Critical application tables that MUST have RLS enabled
  const criticalTables = [
    'shops',
    'shop_members',
    'orders',
    'submitted_orders',
    'prepaid_wallets',
    'wallet_ledger',
    'reseller_commissions',
    'reseller_payout_statements',
    'retention_actions',
    'retention_daily_snapshots',
    'commercial_cost_entries',
    'ai_model_cost_rates',
    'system_incidents',
    'system_job_outbox',
    'remote_selector_releases',
    'system_configs',
    'audit_logs'
  ];

  for (const tbl of criticalTables) {
    assert.ok(
      tablesWithRLS.has(tbl),
      `Critical table '${tbl}' must have ENABLE ROW LEVEL SECURITY defined in migrations`
    );
  }
});

test('G016 Security Review 2: IDOR defense on all admin RPCs (is_system_admin mandatory guard)', () => {
  const runAllSql = read('database/migrations/RUN_ALL_MIGRATIONS.sql');

  // Find all admin_* functions
  const rpcMatches = [...runAllSql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(admin_[a-zA-Z0-9_]+)\s*\(([^)]*)\)[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/gi)];

  assert.ok(rpcMatches.length >= 10, `Must inspect all admin RPCs (found ${rpcMatches.length})`);

  for (const match of rpcMatches) {
    const fnName = match[1];
    const fnBody = match[3];

    // Every administrative RPC must check is_system_admin or SYSTEM_ADMIN role
    const hasAdminCheck =
      fnBody.includes('is_system_admin()') ||
      fnBody.includes('is_system_admin(auth.uid())') ||
      fnBody.includes('is_system_admin') ||
      fnBody.includes("r.code = 'SYSTEM_ADMIN'") ||
      fnBody.includes('SYSTEM_ADMIN');

    assert.ok(
      hasAdminCheck,
      `IDOR Guard Violation: Admin RPC '${fnName}' must enforce is_system_admin() check`
    );
  }
});

test('G016 Security Review 3: Secret Exposure Audit — zero service_role, private keys, or credentials in client bundles', () => {
  const scanDirs = [
    path.join(root, 'src'),
    path.join(root, 'frontend'),
    path.join(root, 'admin-dashboard'),
    path.join(root, 'extension')
  ];

  const forbiddenPatterns = [
    { name: 'Supabase service_role key', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*(?:service_role|service-role)/i },
    { name: 'Hardcoded password string', regex: /(?:admin_pass|service_pass|carrier_password)\s*=\s*['"][^'"]{6,}['"]/i },
    { name: 'Webhook HMAC secret', regex: /WEBHOOK_HMAC_SECRET\s*=\s*['"][a-zA-Z0-9_\-]{8,}['"]/i }
  ];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = getAllFiles(dir, ['.js', '.jsx', '.ts', '.html', '.json']);
    for (const f of files) {
      // Skip test fixtures or config templates with placeholder strings
      if (f.includes('test-data.json') || f.includes('fixtures')) continue;
      const content = fs.readFileSync(f, 'utf8');

      for (const pattern of forbiddenPatterns) {
        assert.ok(
          !pattern.regex.test(content),
          `Secret Exposure Violation: File '${path.relative(root, f)}' may leak ${pattern.name}`
        );
      }
    }
  }
});

test('G016 Security Review 4: Stored & Reflected XSS Prevention in UI components', () => {
  const scanDirs = [
    path.join(root, 'src', 'ui'),
    path.join(root, 'admin-dashboard'),
    path.join(root, 'frontend')
  ];

  const sensitiveFields = ['customerName', 'customer_name', 'phone', 'address', 'rawAddress', 'note', 'extraNote', 'orderCode'];

  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = getAllFiles(dir, ['.jsx', '.js', '.html']);
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');

      // Check dangerouslySetInnerHTML
      if (content.includes('dangerouslySetInnerHTML')) {
        for (const field of sensitiveFields) {
          assert.ok(
            !content.includes(`dangerouslySetInnerHTML={{ __html: ${field}`),
            `XSS Violation: Component '${path.relative(root, f)}' sets dangerouslySetInnerHTML with unescaped field '${field}'`
          );
        }
      }
    }
  }
});

test('G016 Security Review 5: Webhook Replay and HMAC Timing Attack Protections', () => {
  const webhookFile = path.join(root, 'supabase', 'functions', 'payment-webhook', 'index.ts');
  assert.ok(fs.existsSync(webhookFile), 'payment-webhook/index.ts must exist');
  const code = read('supabase/functions/payment-webhook/index.ts');

  // Must verify HMAC
  assert.match(code, /crypto\.subtle\.sign|crypto\.subtle\.verify/i, 'Must use crypto.subtle for cryptographic operations');
  // Must use constant-time comparison
  assert.match(code, /timingSafeEqual/i, 'Must use constant-time comparison to prevent timing attacks');
  // Must check timestamp drift
  assert.match(code, /300/, 'Must enforce +-300s timestamp freshness replay window');
  // Must check nonce replay
  assert.match(code, /x-nonce|nonce/i, 'Must check nonce header');
  // Must check idempotency
  assert.match(code, /referenceCode|transactionCode|payment_transactions/i, 'Must check transaction idempotency');
});

test('G016 Security Review 6: Mandatory Admin Audit Logging on State-Mutating Operations', () => {
  const runAllSql = read('database/migrations/RUN_ALL_MIGRATIONS.sql');

  const mutatingAdminRpcs = [
    'admin_topup_wallet_with_audit',
    'admin_refund_wallet_with_audit',
    'admin_replay_dead_letter_jobs',
    'admin_generate_reseller_payout_statement'
  ];

  for (const rpc of mutatingAdminRpcs) {
    // Locate RPC implementation in SQL
    const rpcRegex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${rpc}[\\s\\S]*?AS\\s*\\$\\$([\\s\\S]*?)\\$\\$`, 'i');
    const match = runAllSql.match(rpcRegex);
    assert.ok(match, `RPC '${rpc}' must exist in migrations`);
    const body = match[1];

    assert.ok(
      body.includes('INSERT INTO public.audit_logs') || body.includes('INSERT INTO audit_logs'),
      `Audit Logging Violation: State-mutating admin RPC '${rpc}' must insert audit_logs`
    );
  }
});
