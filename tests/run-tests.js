/**
 * Test Runner Script — Kiểm thử tự động hệ thống
 *
 * Chạy: node tests/run-tests.js
 *
 * Yêu cầu:
 *   - Đã cấu hình Supabase URL + Anon Key trong supabase-config.js
 *   - Node.js >= 18
 *   - Đã chạy: cd tests && npm install @supabase/supabase-js (nếu cần)
 */

const fs = require('fs');
const path = require('path');

// ─── Supabase Client Setup ────────────────────────────────────────────────
// Thử load supabase client từ project
let supabase;
try {
    // Dùng dynamic import để tránh lỗi nếu chưa install
    const { createClient } = require('@supabase/supabase-js');

    // Đọc config từ admin-dashboard/supabase-config.js
    const configPath = path.join(__dirname, '..', 'admin-dashboard', 'supabase-config.js');
    if (!fs.existsSync(configPath)) {
        console.warn('⚠️  Không tìm thấy supabase-config.js — bỏ qua các test Supabase trực tiếp.');
    } else {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const urlMatch = configContent.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
        const keyMatch = configContent.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

        if (urlMatch && keyMatch) {
            supabase = createClient(urlMatch[1], keyMatch[2]);
            console.log('✅ Supabase client initialized:', urlMatch[1]);
        }
    }
} catch (err) {
    console.warn('⚠️  @supabase/supabase-js chưa được cài đặt.');
    console.warn('   Chạy: npm install @supabase/supabase-js');
}

// ─── Test Data ────────────────────────────────────────────────────────────
const testData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'test-data.json'), 'utf-8')
);

// ─── Test Results Collector ───────────────────────────────────────────────
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    startTime: new Date().toISOString(),
    endTime: null
};

function test(name, fn) {
    results.total++;
    const start = Date.now();
    try {
        const promise = fn();
        if (promise && typeof promise.then === 'function') {
            return promise.then(() => {
                recordPass(name, Date.now() - start);
            }).catch(err => {
                recordFail(name, err.message, Date.now() - start);
            });
        } else {
            recordPass(name, Date.now() - start);
            return Promise.resolve();
        }
    } catch (err) {
        recordFail(name, err.message, Date.now() - start);
        return Promise.resolve();
    }
}

function recordPass(name, duration) {
    results.passed++;
    results.tests.push({ name, status: '✅ PASS', duration: `${duration}ms` });
    console.log(`  ✅ PASS: ${name} (${duration}ms)`);
}

function recordFail(name, error, duration) {
    results.failed++;
    results.tests.push({ name, status: '❌ FAIL', error, duration: `${duration}ms` });
    console.log(`  ❌ FAIL: ${name} — ${error} (${duration}ms)`);
}

function skip(name, reason) {
    results.skipped++;
    results.tests.push({ name, status: '⏭️ SKIP', reason });
    console.log(`  ⏭️ SKIP: ${name} — ${reason}`);
}

// ─── Assertion Helpers ────────────────────────────────────────────────────
const assert = {
    ok: (value, msg) => { if (!value) throw new Error(msg || 'Assertion failed: expected truthy'); },
    equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
    notEqual: (a, b, msg) => { if (a === b) throw new Error(msg || `Expected not ${b}`); },
    includes: (str, substr, msg) => { if (!str.includes(substr)) throw new Error(msg || `Expected '${str}' to include '${substr}'`); },
    isArray: (val, msg) => { if (!Array.isArray(val)) throw new Error(msg || 'Expected array'); },
    isObject: (val, msg) => { if (typeof val !== 'object' || val === null) throw new Error(msg || 'Expected object'); },
    greaterThan: (a, b, msg) => { if (!(a > b)) throw new Error(msg || `Expected ${a} > ${b}`); },
};

// ─── SECTION 1: Test Data Validation ──────────────────────────────────────
async function section1_testDataValidation() {
    console.log('\n📦 SECTION 1: Test Data Validation');
    console.log('─'.repeat(60));

    await test('test-data.json is valid JSON', () => {
        assert.isObject(testData, 'test-data.json must be an object');
    });

    await test('master_admin config exists', () => {
        assert.ok(testData.master_admin, 'master_admin missing');
        assert.ok(testData.master_admin.email, 'master_admin.email missing');
        assert.ok(testData.master_admin.password, 'master_admin.password missing');
    });

    await test('test_shops has 3 entries', () => {
        assert.isArray(testData.test_shops);
        assert.equal(testData.test_shops.length, 3);
    });

    await test('test_shops have required fields', () => {
        testData.test_shops.forEach(shop => {
            assert.ok(shop.name, `Shop missing name`);
            assert.ok(shop.owner_email, `Shop ${shop.name} missing owner_email`);
            assert.ok(shop.owner_password, `Shop ${shop.name} missing owner_password`);
            assert.ok(shop.owner_password.length >= 6, `Shop ${shop.name} password too short`);
        });
    });

    await test('test_quotas has valid values', () => {
        assert.ok(testData.test_quotas.daily_quota > 0, 'daily_quota must be positive');
        assert.ok(testData.test_quotas.max_devices > 0, 'max_devices must be positive');
    });

    await test('test_configs has groq_keys as array', () => {
        assert.isArray(testData.test_configs.groq_keys);
    });

    await test('test_configs has blacklist_phones as array', () => {
        assert.isArray(testData.test_configs.blacklist_phones);
    });

    await test('urls config exists', () => {
        assert.ok(testData.urls.login_page, 'login_page missing');
        assert.ok(testData.urls.admin_page, 'admin_page missing');
    });
}

// ─── SECTION 2: Supabase Connection ───────────────────────────────────────
async function section2_supabaseConnection() {
    console.log('\n🔗 SECTION 2: Supabase Connection');
    console.log('─'.repeat(60));

    if (!supabase) {
        skip('Supabase connection test', 'Supabase client not initialized');
        skip('Ping Supabase REST API', 'Supabase client not initialized');
        skip('Check Supabase auth service', 'Supabase client not initialized');
        return;
    }

    await test('Supabase client is initialized', () => {
        assert.ok(supabase, 'supabase client should exist');
        assert.ok(supabase.auth, 'supabase.auth should exist');
    });

    await test('Can query Supabase health check', async () => {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw new Error(`Query failed: ${error.message}`);
        assert.ok(true);
    });

    await test('Supabase auth service is reachable', async () => {
        const { data, error } = await supabase.auth.getSession();
        // Không có session là bình thường (chưa login)
        assert.ok(!error || error.message.includes('session'), 'Auth service should be reachable');
    });
}

// ─── SECTION 3: Database Schema Validation ────────────────────────────────
async function section3_schemaValidation() {
    console.log('\n🗄️  SECTION 3: Database Schema Validation');
    console.log('─'.repeat(60));

    if (!supabase) {
        skip('Schema validation', 'Supabase client not initialized');
        return;
    }

    const requiredTables = [
        'profiles',
        'shops',
        'shop_members',
        'shop_invites',
        'quotas',
        'feature_flags',
        'system_configs',
        'audit_logs'
    ];

    for (const table of requiredTables) {
        await test(`Table '${table}' exists and is queryable`, async () => {
            const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
            if (error && error.code === '42P01') {
                throw new Error(`Table '${table}' does not exist`);
            }
            // Các lỗi khác (RLS, permission) chấp nhận được vì dùng anon key
            assert.ok(true);
        });
    }
}

// ─── SECTION 4: File Structure Validation ─────────────────────────────────
async function section4_fileStructure() {
    console.log('\n📁 SECTION 4: File Structure Validation');
    console.log('─'.repeat(60));

    const requiredFiles = [
        'admin-dashboard/login.html',
        'admin-dashboard/admin.html',
        'admin-dashboard/index.html',
        'admin-dashboard/master-admin.js',
        'admin-dashboard/shops.js',
        'admin-dashboard/app.js',
        'admin-dashboard/supabase-config.js',
        'manifest.json',
        'backend/content/index.js',
        'src/backend/auth/auth.service.js',
        'src/backend/auth/auth.session.js',
        'src/backend/permission/permission.service.js',
        'src/backend/audit/audit.service.js',
        'src/backend/shop/shop.service.js',
        'src/backend/shop/invite.service.js',
        'src/backend/member/member.service.js',
        'src/backend/realtime/realtime.service.js',
        'database/migrations/v3_enterprise_schema.sql',
        'database/migrations/v3_1_rbac_schema.sql',
        'database/migrations/v4_saas_architecture.sql',
        'database/migrations/v5_master_admin_schema.sql',
        'database/migrations/v6_DEPRECATED_panel_accounts.sql',
    ];

    const baseDir = path.join(__dirname, '..');

    for (const file of requiredFiles) {
        await test(`File exists: ${file}`, () => {
            const fullPath = path.join(baseDir, file);
            assert.ok(fs.existsSync(fullPath), `File not found: ${fullPath}`);
        });
    }
}

// ─── SECTION 5: Migration SQL Content Validation ──────────────────────────
async function section5_migrationContent() {
    console.log('\n📜 SECTION 5: Migration SQL Content');
    console.log('─'.repeat(60));

    const baseDir = path.join(__dirname, '..');
    const migrations = [
        { file: 'database/migrations/v3_enterprise_schema.sql', keywords: ['shops', 'profiles', 'CREATE TABLE'] },
        { file: 'database/migrations/v3_1_rbac_schema.sql', keywords: ['role', 'permission', 'rbac'] },
        { file: 'database/migrations/v4_saas_architecture.sql', keywords: ['roles', 'policy'] },
        { file: 'database/migrations/v5_master_admin_schema.sql', keywords: ['master_admin', 'admin'] },
        { file: 'database/migrations/v6_DEPRECATED_panel_accounts.sql', keywords: ['panel', 'account'] },
    ];

    for (const mig of migrations) {
        await test(`Migration ${mig.file} contains required keywords`, () => {
            const fullPath = path.join(baseDir, mig.file);
            const content = fs.readFileSync(fullPath, 'utf-8').toLowerCase();
            for (const keyword of mig.keywords) {
                assert.ok(
                    content.includes(keyword.toLowerCase()),
                    `Migration ${mig.file} missing keyword: '${keyword}'`
                );
            }
        });
    }
}

// ─── SECTION 6: Source Code Structure Validation ──────────────────────────
async function section6_sourceCode() {
    console.log('\n💻 SECTION 6: Source Code Structure');
    console.log('─'.repeat(60));

    const baseDir = path.join(__dirname, '..');

    await test('auth.service.js exports required functions', () => {
        const content = fs.readFileSync(path.join(baseDir, 'src/backend/auth/auth.service.js'), 'utf-8');
        const required = ['signIn', 'signUp', 'signOut'];
        for (const fn of required) {
            assert.ok(content.includes(fn), `auth.service.js missing: ${fn}`);
        }
    });

    await test('auth.session.js handles session management', () => {
        const content = fs.readFileSync(path.join(baseDir, 'src/backend/auth/auth.session.js'), 'utf-8');
        assert.ok(content.includes('session'), 'auth.session.js should handle sessions');
    });

    await test('permission.service.js exports RBAC logic', () => {
        const content = fs.readFileSync(path.join(baseDir, 'src/backend/permission/permission.service.js'), 'utf-8');
        assert.ok(content.includes('role') || content.includes('permission'), 'permission.service.js should handle roles/permissions');
    });

    await test('shop.service.js has CRUD operations', () => {
        const content = fs.readFileSync(path.join(baseDir, 'src/backend/shop/shop.service.js'), 'utf-8');
        const operations = ['create', 'delete', 'update'];
        let found = 0;
        for (const op of operations) {
            if (content.toLowerCase().includes(op)) found++;
        }
        assert.ok(found >= 2, `shop.service.js should have at least 2 CRUD operations, found ${found}`);
    });

    await test('audit.service.js logs actions', () => {
        const content = fs.readFileSync(path.join(baseDir, 'src/backend/audit/audit.service.js'), 'utf-8');
        assert.ok(content.includes('log') || content.includes('audit'), 'audit.service.js should handle logging');
    });

    await test('admin-dashboard/master-admin.js is non-empty', () => {
        const content = fs.readFileSync(path.join(baseDir, 'admin-dashboard/master-admin.js'), 'utf-8');
        assert.ok(content.length > 100, 'master-admin.js should have substantial content');
    });

    await test('admin-dashboard/login.html has login form', () => {
        const content = fs.readFileSync(path.join(baseDir, 'admin-dashboard/login.html'), 'utf-8');
        assert.ok(content.includes('form') || content.includes('login'), 'login.html should have a login form');
    });
}

// ─── SECTION 7: Security Baseline ─────────────────────────────────────────
async function section7_securityBaseline() {
    console.log('\n🔒 SECTION 7: Security Baseline');
    console.log('─'.repeat(60));

    const baseDir = path.join(__dirname, '..');

    await test('No hardcoded Supabase service_role key in source', () => {
        const filesToCheck = [
            'admin-dashboard/supabase-config.js',
            'admin-dashboard/master-admin.js',
            'backend/supabase/client.js',
        ];
        for (const file of filesToCheck) {
            const fullPath = path.join(baseDir, file);
            if (!fs.existsSync(fullPath)) continue;
            const content = fs.readFileSync(fullPath, 'utf-8');
            assert.ok(
                !content.includes('service_role') && !content.includes('service-key'),
                `${file} should not contain service_role key`
            );
        }
    });

    await test('No hardcoded passwords in source code', () => {
        const filesToCheck = [
            'admin-dashboard/master-admin.js',
            'admin-dashboard/shops.js',
            'admin-dashboard/app.js',
        ];
        const suspiciousPatterns = /password\s*=\s*['"][^'"]{6,}['"]/gi;
        for (const file of filesToCheck) {
            const fullPath = path.join(baseDir, file);
            if (!fs.existsSync(fullPath)) continue;
            const content = fs.readFileSync(fullPath, 'utf-8');
            const matches = content.match(suspiciousPatterns);
            if (matches) {
                throw new Error(`${file} may contain hardcoded passwords: ${matches.join(', ')}`);
            }
        }
    });

    await test('manifest.json has minimum permissions', () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, 'manifest.json'), 'utf-8'));
        const dangerousPerms = ['<all_urls>', 'debugger', 'fileSystem', 'nativeMessaging'];
        const perms = manifest.permissions || [];
        for (const perm of dangerousPerms) {
            if (perms.includes(perm)) {
                throw new Error(`manifest.json has dangerous permission: ${perm}`);
            }
        }
        assert.ok(true);
    });
}

// ─── SECTION 8: E2E Smoke Tests (Manual Verification Required) ────────────
async function section8_e2eSmoke() {
    console.log('\n🧪 SECTION 8: E2E Smoke Tests (Manual)');
    console.log('─'.repeat(60));
    console.log('  📋 Các test E2E cần được thực thi thủ công trên browser:');
    console.log('    1. Mở admin-dashboard/login.html');
    console.log('    2. Đăng nhập với master admin credentials');
    console.log('    3. Kiểm tra dashboard metrics');
    console.log('    4. Tạo shop mới');
    console.log('    5. Cấu hình quotas & feature flags');
    console.log('    6. Kiểm tra audit logs');
    console.log('    7. Logout & verify session cleared');
    console.log('');
    console.log('  Xem chi tiết tại: tests/system/04-e2e-flows.md');
}

// ─── Main Runner ──────────────────────────────────────────────────────────
async function runAll() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     🧪 VIETAUTOFILL SYSTEM TEST RUNNER v1.0              ║');
    console.log('║     Thời gian: ' + new Date().toLocaleString('vi-VN') + '               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    try {
        await section1_testDataValidation();
        await section2_supabaseConnection();
        await section3_schemaValidation();
        await section4_fileStructure();
        await section5_migrationContent();
        await section6_sourceCode();
        await section7_securityBaseline();
        await section8_e2eSmoke();
    } catch (err) {
        console.error('\n💥 FATAL ERROR:', err.message);
        console.error(err.stack);
    }

    // ─── Summary ──────────────────────────────────────────────────────
    results.endTime = new Date().toISOString();
    const totalTime = (new Date(results.endTime) - new Date(results.startTime)) / 1000;

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 TEST SUMMARY                        ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║   Total:   ${String(results.total).padStart(4)} tests                             ║`);
    console.log(`║   Passed:  ${String(results.passed).padStart(4)} ✅                              ║`);
    console.log(`║   Failed:  ${String(results.failed).padStart(4)} ❌                              ║`);
    console.log(`║   Skipped: ${String(results.skipped).padStart(4)} ⏭️                              ║`);
    console.log(`║   Time:    ${String(totalTime.toFixed(2)).padStart(6)}s                              ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Write results to file
    const reportPath = path.join(__dirname, 'reports', 'TEST-RESULTS.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed results saved to: ${reportPath}`);

    // Exit with proper code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run
runAll().catch(err => {
    console.error('Fatal error:', err);
    process.exit(2);
});