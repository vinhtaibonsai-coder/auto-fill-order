import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

console.log('--- 1. Testing Migration v99: Global Knowledge Governance ---');

const migrationPath = path.join(rootDir, 'database/migrations/v99_global_knowledge_governance.sql');
assert.ok(fs.existsSync(migrationPath), 'Migration v99 must exist');
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

assert.match(sqlContent, /ALTER TABLE public\.shop_address_aliases\s+ALTER COLUMN shop_id DROP NOT NULL/, 'Must allow shop_id to be NULL for global aliases');
assert.match(sqlContent, /ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE/, 'Must add is_global column');
assert.match(sqlContent, /CREATE UNIQUE INDEX IF NOT EXISTS uq_global_address_alias/, 'Must create unique index on global aliases');
assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.get_admin_learning_candidates/, 'Must create get_admin_learning_candidates RPC');
assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.admin_promote_to_global_alias/, 'Must create admin_promote_to_global_alias RPC');
assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.get_active_global_aliases/, 'Must create get_active_global_aliases RPC');
assert.match(sqlContent, /GRANT EXECUTE ON FUNCTION public\.get_admin_learning_candidates/i, 'Must grant execute on get_admin_learning_candidates');
assert.match(sqlContent, /GRANT EXECUTE ON FUNCTION public\.admin_promote_to_global_alias/i, 'Must grant execute on admin_promote_to_global_alias');
assert.match(sqlContent, /GRANT EXECUTE ON FUNCTION public\.get_active_global_aliases/i, 'Must grant execute on get_active_global_aliases');

console.log('✅ Migration v99 verified successfully.');

console.log('--- 2. Testing AddressNormalizer Dual-Tier Precedence ---');

const normalizerPath = path.join(rootDir, 'src/application/address/normalizer.js');
const normalizerCode = fs.readFileSync(normalizerPath, 'utf8');
eval(normalizerCode);

const globalAliases = [
  { original: 'kcx tân thuận', mapping: 'Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP Hồ Chí Minh' },
  { original: 'kcn sóng thần', mapping: 'Khu Công Nghiệp Sóng Thần, Phường An Bình, Dĩ An, Bình Dương' },
  { original: 'qbt', mapping: 'Quận Bình Thạnh, TP Hồ Chí Minh' }
];

const shopAliases = [
  // Shop này muốn ghi đè 'qbt' thành Quận Bắc Từ Liêm thay vì Bình Thạnh
  { original: 'qbt', mapping: 'Quận Bắc Từ Liêm, Hà Nội' },
  { original: 'kho riêng', mapping: 'Số 99 Lê Duẩn, Hoàn Kiếm, Hà Nội' }
];

// Case A: Global Alias applies when no shop override
const text1 = 'Giao tới cổng số 2, kcx tân thuận gấp nhé';
const res1 = globalThis.AddressNormalizer.applyShopAliases(text1, [], globalAliases);
assert.ok(res1.includes('Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP Hồ Chí Minh'), 'Global alias should expand correctly across any shop');

// Case B: Shop-specific alias overrides Global alias
const text2 = 'Địa chỉ khách: Số 15 đường 32, qbt';
const res2 = globalThis.AddressNormalizer.applyShopAliases(text2, shopAliases, globalAliases);
assert.ok(res2.includes('Quận Bắc Từ Liêm, Hà Nội'), 'Shop-specific alias MUST override global alias when conflict exists');
assert.ok(!res2.includes('Quận Bình Thạnh'), 'Global alias should NOT override shop-specific preference');

// Case C: Both Shop and Global aliases cooperate in the same order text
const text3 = 'Giao từ kho riêng tới kcn sóng thần';
const res3 = globalThis.AddressNormalizer.applyShopAliases(text3, shopAliases, globalAliases);
assert.ok(res3.includes('Số 99 Lê Duẩn, Hoàn Kiếm, Hà Nội'), 'Shop alias should expand');
assert.ok(res3.includes('Khu Công Nghiệp Sóng Thần, Phường An Bình, Dĩ An, Bình Dương'), 'Global alias should expand');

console.log('✅ AddressNormalizer dual-tier precedence verified.');

console.log('--- 3. Testing Admin Service & Repository Contracts ---');

const repoPath = path.join(rootDir, 'src/domain/admin/admin.repository.js');
const repoCode = fs.readFileSync(repoPath, 'utf8');
assert.match(repoCode, /getLearningCandidates/, 'AdminRepository must implement getLearningCandidates');
assert.match(repoCode, /promoteToGlobalAlias/, 'AdminRepository must implement promoteToGlobalAlias');
assert.match(repoCode, /getGlobalAliases/, 'AdminRepository must implement getGlobalAliases');
assert.match(repoCode, /deleteGlobalAlias/, 'AdminRepository must implement deleteGlobalAlias');

const servicePath = path.join(rootDir, 'src/domain/admin/admin.service.js');
const serviceCode = fs.readFileSync(servicePath, 'utf8');
assert.match(serviceCode, /getLearningCandidates/, 'AdminService must implement getLearningCandidates');
assert.match(serviceCode, /promoteToGlobalAlias/, 'AdminService must implement promoteToGlobalAlias');
assert.match(serviceCode, /getGlobalAliases/, 'AdminService must implement getGlobalAliases');
assert.match(serviceCode, /deleteGlobalAlias/, 'AdminService must implement deleteGlobalAlias');

console.log('✅ Admin Service & Repository contracts verified.');

console.log('--- 4. Testing Admin Dashboard Address Page UI Contracts ---');

const adminAddressPath = path.join(rootDir, 'src/ui/admin-dashboard/pages/Address/AddressDataset.jsx');
const adminAddressCode = fs.readFileSync(adminAddressPath, 'utf8');

assert.match(adminAddressCode, /subTab === 'global_knowledge'/, 'Must support global_knowledge sub-tab');
assert.match(adminAddressCode, /subTab === 'datasets'/, 'Must support datasets sub-tab');
assert.match(adminAddressCode, /Tri Thức Toàn Cầu & Học Máy/i, 'Must have tab label for global knowledge');
assert.match(adminAddressCode, /handleOpenPromoteModal/, 'Must implement promote modal trigger');
assert.match(adminAddressCode, /handleSubmitGlobalAlias/, 'Must implement promote submission');
assert.match(adminAddressCode, /handleDeleteGlobalAlias/, 'Must implement delete global alias');
assert.match(adminAddressCode, /filteredCandidates/, 'Must support search filtering for candidates');
assert.match(adminAddressCode, /filteredGlobalAliases/, 'Must support search filtering for active global aliases');

console.log('✅ Admin Dashboard Address Page UI contracts verified.');
console.log('🎉 ALL GLOBAL KNOWLEDGE GOVERNANCE TESTS PASSED!');
