import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

console.log('--- 1. Testing Migration v100: Historical Knowledge Mining ---');

const migrationPath = path.join(rootDir, 'database/migrations/v100_mine_historical_orders_to_learning_kb.sql');
assert.ok(fs.existsSync(migrationPath), 'Migration v100 must exist');
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.mine_historical_orders_to_learning_kb/, 'Must create mine_historical_orders_to_learning_kb RPC');
assert.match(sqlContent, /FROM public\.submitted_orders/, 'Must scan submitted_orders table');
assert.match(sqlContent, /FROM public\.customers/, 'Must scan customers table');
assert.match(sqlContent, /INSERT INTO public\.shop_learning_kb/, 'Must insert into shop_learning_kb table');
assert.match(sqlContent, /category,\s*raw_key/, 'Must insert category and raw_key');
assert.match(sqlContent, /GRANT EXECUTE ON FUNCTION public\.mine_historical_orders_to_learning_kb/i, 'Must grant execute on mine_historical_orders_to_learning_kb');

console.log('✅ Migration v100 verified successfully.');

console.log('--- 2. Testing Admin Service & Repository Mining Methods ---');

const repoPath = path.join(rootDir, 'src/domain/admin/admin.repository.js');
const repoCode = fs.readFileSync(repoPath, 'utf8');
assert.match(repoCode, /mineHistoricalKnowledge/, 'AdminRepository must implement mineHistoricalKnowledge');
assert.match(repoCode, /mine_historical_orders_to_learning_kb/, 'AdminRepository must call mine_historical_orders_to_learning_kb RPC');

const servicePath = path.join(rootDir, 'src/domain/admin/admin.service.js');
const serviceCode = fs.readFileSync(servicePath, 'utf8');
assert.match(serviceCode, /mineHistoricalKnowledge/, 'AdminService must implement mineHistoricalKnowledge');
assert.match(serviceCode, /ADMIN_MINE_HISTORICAL_KNOWLEDGE/, 'AdminService must log audit event ADMIN_MINE_HISTORICAL_KNOWLEDGE');

console.log('✅ Admin Service & Repository mining methods verified.');

console.log('--- 3. Testing UI Integration for Historical Mining ---');

// Check Admin Dashboard UI
const adminAddressPath = path.join(rootDir, 'src/ui/admin-dashboard/pages/Address/AddressDataset.jsx');
const adminAddressCode = fs.readFileSync(adminAddressPath, 'utf8');
assert.match(adminAddressCode, /handleMineHistoricalKnowledge/, 'AddressDataset must define handleMineHistoricalKnowledge');
assert.match(adminAddressCode, /Khai Phá Lịch Sử Đơn Hàng/i, 'AddressDataset must have mining button');

// Check Shop Options Address Engine UI
const optionsAddressPath = path.join(rootDir, 'src/ui/options/pages/AddressEngine/AddressEngine.jsx');
const optionsAddressCode = fs.readFileSync(optionsAddressPath, 'utf8');
assert.match(optionsAddressCode, /handleMineHistoricalShopData/, 'AddressEngine must define handleMineHistoricalShopData');
assert.match(optionsAddressCode, /mine_historical_orders_to_learning_kb/, 'AddressEngine must call mine_historical_orders_to_learning_kb');
assert.match(optionsAddressCode, /Khai Phá Lịch Sử/i, 'AddressEngine must have mining button');

console.log('✅ UI Integration for Historical Mining verified.');

console.log('--- 4. Testing Batch Promotion & Inline Editing Contracts ---');

// Check Migration v100 batch promote RPC
assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.admin_promote_batch_global_aliases/, 'Migration v100 must define admin_promote_batch_global_aliases');
assert.match(sqlContent, /p_entries JSONB/, 'Batch promote RPC must accept JSONB entries array');
assert.match(sqlContent, /ON CONFLICT \(LOWER\(TRIM\(original\)\)\)/, 'Batch promote RPC must handle conflicts gracefully');

// Check Repository & Service
assert.match(repoCode, /promoteBatchGlobalAliases/, 'AdminRepository must implement promoteBatchGlobalAliases');
assert.match(repoCode, /admin_promote_batch_global_aliases/, 'AdminRepository must call admin_promote_batch_global_aliases RPC');
assert.match(serviceCode, /promoteBatchGlobalAliases/, 'AdminService must implement promoteBatchGlobalAliases');
assert.match(serviceCode, /ADMIN_PROMOTE_BATCH_GLOBAL_ALIASES/, 'AdminService must log audit event for batch promotion');

// Check Admin Dashboard UI (Inline edit & multi-select)
assert.match(adminAddressCode, /editedMappings/, 'AddressDataset must maintain editedMappings state');
assert.match(adminAddressCode, /selectedKeys/, 'AddressDataset must maintain selectedKeys state');
assert.match(adminAddressCode, /handleInlineMappingChange/, 'AddressDataset must define handleInlineMappingChange');
assert.match(adminAddressCode, /handleBulkPromote/, 'AddressDataset must define handleBulkPromote');
assert.match(adminAddressCode, /handleInlineSinglePromote/, 'AddressDataset must define handleInlineSinglePromote');
assert.match(adminAddressCode, /toggleSelectAll/, 'AddressDataset must support selecting all candidates');
assert.match(adminAddressCode, /Phê Duyệt Hàng Loạt/i, 'AddressDataset must render bulk approval button');

console.log('✅ Batch Promotion & Inline Editing contracts verified.');
console.log('🎉 ALL HISTORICAL KNOWLEDGE MINING & BULK PROMOTION TESTS PASSED!');
