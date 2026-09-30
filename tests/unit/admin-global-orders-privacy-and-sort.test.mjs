import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

// 1. Migration v101 test
const migrationSql = readSource('database/migrations/v101_global_orders_privacy_and_sort_fix.sql');
assert.match(migrationSql, /DROP FUNCTION IF EXISTS public\.admin_get_global_orders/i, 'Must drop old admin_get_global_orders function before changing return signature');
assert.match(migrationSql, /id TEXT,/i, 'Return table must use id TEXT instead of UUID');
assert.match(migrationSql, /destination_region TEXT,/i, 'Return table must provide destination_region');
assert.doesNotMatch(migrationSql, /customer_name TEXT,/i, 'Global Orders RPC must NOT expose customer_name');
assert.doesNotMatch(migrationSql, /phone TEXT,/i, 'Global Orders RPC must NOT expose customer phone');
assert.doesNotMatch(migrationSql, /address TEXT,/i, 'Global Orders RPC must NOT expose raw customer address');
assert.match(migrationSql, /ORDER BY fo\.created_at DESC/i, 'Global Orders RPC must order by created_at DESC');
assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.admin_get_global_orders/i, 'Must grant execute on admin_get_global_orders');

// 2. AdminRepository test
const repoSrc = readSource('src/domain/admin/admin.repository.js');
assert.match(repoSrc, /&order=submitted_at\.desc,created_at\.desc/, 'REST fallback query must enforce newest-first ordering');
assert.match(repoSrc, /destination_region:\s*extractProvince\s*\(/, 'REST fallback query must extract destination_region safely');
assert.doesNotMatch(repoSrc, /customer_name:\s*r\.customer_name/, 'REST fallback query must not leak customer_name');

// 3. GlobalOrders UI test
const uiSrc = readSource('src/ui/admin-dashboard/pages/GlobalOrders/GlobalOrders.jsx');
assert.match(uiSrc, /Tuyến phát \/ Điểm đến/, 'Must have destination route column');
assert.match(uiSrc, /Tìm theo Mã đơn, Mã vận đơn, Tên Shop\.\.\./, 'Search placeholder must not ask for customer phone or name');
assert.match(uiSrc, /Chính sách cách ly dữ liệu khách hàng \(Tenant PII Isolation\)/, 'Must have safety banner explaining PII isolation');
assert.match(uiSrc, /Tuyến Giao Hàng & Điều Phối Bưu Cục/, 'Modal must display routing and dispatch instead of customer PII');
assert.doesNotMatch(uiSrc, /<th[^>]*>Khách hàng<\/th>/, 'Table header must NOT have Khách hàng column');

console.log('✅ ALL GLOBAL ORDERS PRIVACY AND SORT TESTS PASSED (100%)');
