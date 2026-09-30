import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const { FeatureFlagEvaluator } = await import('../../src/domain/feature-flags/evaluator.js');
const adminRepo = read('src/domain/admin/admin.repository.js');
const adminService = read('src/domain/admin/admin.service.js');
const featureFlagsUi = read('src/ui/admin-dashboard/pages/Features/FeatureFlags.jsx');
const editModal = read('src/ui/admin-dashboard/modals/EditFeatureFlagModal.jsx');

// 1. FeatureFlagEvaluator tests
console.log('--- Testing FeatureFlagEvaluator Logic ---');

// Disabled flag
assert.equal(
  FeatureFlagEvaluator.isEnabled({ key: 'test_off', is_enabled: false, scope_type: 'global', rollout_percentage: 100 }),
  false,
  'Disabled flag must evaluate to false regardless of rollout'
);

// Global 100%
assert.equal(
  FeatureFlagEvaluator.isEnabled({ key: 'global_all', is_enabled: true, scope_type: 'global', rollout_percentage: 100 }),
  true,
  'Global 100% rollout must evaluate to true'
);

// Global 0%
assert.equal(
  FeatureFlagEvaluator.isEnabled({ key: 'global_zero', is_enabled: true, scope_type: 'global', rollout_percentage: 0 }),
  false,
  'Global 0% rollout must evaluate to false'
);

// Deterministic hashing for partial rollout
const flag50 = { key: 'canary_feature', is_enabled: true, scope_type: 'global', rollout_percentage: 50 };
const result1 = FeatureFlagEvaluator.isEnabled(flag50, { shopId: 'shop-abc' });
const result2 = FeatureFlagEvaluator.isEnabled(flag50, { shopId: 'shop-abc' });
assert.equal(result1, result2, 'Same entity must always receive deterministic evaluation');

// Plan Scope
const planFlag = {
  key: 'ai_vision_ocr',
  is_enabled: true,
  scope_type: 'plan',
  plan_code: 'PRO',
  target_plans: ['PRO', 'ENTERPRISE']
};
assert.equal(FeatureFlagEvaluator.isEnabled(planFlag, { planCode: 'PRO' }), true, 'Plan PRO should be enabled');
assert.equal(FeatureFlagEvaluator.isEnabled(planFlag, { planCode: 'enterprise' }), true, 'Case-insensitive target_plans match');
assert.equal(FeatureFlagEvaluator.isEnabled(planFlag, { planCode: 'FREE' }), false, 'Plan FREE should be disabled');
assert.equal(FeatureFlagEvaluator.isEnabled(planFlag, {}), false, 'Missing planCode should be disabled');

// Shop Scope
const shopFlag = {
  key: 'beta_order_split',
  is_enabled: true,
  scope_type: 'shop',
  shop_id: '11111111-2222-3333-4444-555555555555'
};
assert.equal(
  FeatureFlagEvaluator.isEnabled(shopFlag, { shopId: '11111111-2222-3333-4444-555555555555' }),
  true,
  'Matching shop_id must enable feature'
);
assert.equal(
  FeatureFlagEvaluator.isEnabled(shopFlag, { shopId: '99999999-8888-7777-6666-555555555555' }),
  false,
  'Non-matching shop_id must disable feature'
);

// User Scope
const userFlag = {
  key: 'debug_tools',
  is_enabled: true,
  scope_type: 'user',
  user_id: 'user-vip-001'
};
assert.equal(
  FeatureFlagEvaluator.isEnabled(userFlag, { userId: 'user-vip-001' }),
  true,
  'Matching user_id must enable feature'
);
assert.equal(
  FeatureFlagEvaluator.isEnabled(userFlag, { userId: 'user-regular-002' }),
  false,
  'Non-matching user_id must disable feature'
);

// evaluateAll dictionary
const allMap = FeatureFlagEvaluator.evaluateAll([planFlag, shopFlag, userFlag], {
  planCode: 'PRO',
  shopId: 'wrong-shop',
  userId: 'user-vip-001'
});
assert.deepEqual(allMap, {
  ai_vision_ocr: true,
  beta_order_split: false,
  debug_tools: true
}, 'evaluateAll must return correct boolean dictionary');

// 2. AdminRepository methods
console.log('--- Testing AdminRepository & AdminService Contracts ---');
assert.match(adminRepo, /createFeatureFlag\s*\(/, 'AdminRepository must implement createFeatureFlag');
assert.match(adminRepo, /updateFeatureFlag\s*\(/, 'AdminRepository must implement updateFeatureFlag');
assert.match(adminRepo, /deleteFeatureFlag\s*\(/, 'AdminRepository must implement deleteFeatureFlag');
assert.match(adminRepo, /getFeatureFlags\s*\(/, 'AdminRepository must implement getFeatureFlags');

// 3. AdminService methods & Audit logs
assert.match(adminService, /createFeatureFlag\s*\(/, 'AdminService must implement createFeatureFlag');
assert.match(adminService, /updateFeatureFlag\s*\(/, 'AdminService must implement updateFeatureFlag');
assert.match(adminService, /deleteFeatureFlag\s*\(/, 'AdminService must implement deleteFeatureFlag');
assert.match(adminService, /evaluateFeatureFlag\s*\(/, 'AdminService must implement evaluateFeatureFlag');
assert.match(adminService, /evaluateAllFeatureFlags\s*\(/, 'AdminService must implement evaluateAllFeatureFlags');

assert.match(adminService, /ADMIN_CREATE_FEATURE_FLAG/, 'createFeatureFlag must record audit log');
assert.match(adminService, /ADMIN_UPDATE_FEATURE_FLAG/, 'updateFeatureFlag must record audit log');
assert.match(adminService, /ADMIN_DELETE_FEATURE_FLAG/, 'deleteFeatureFlag must record audit log');

// 4. UI & Modals verification
console.log('--- Testing UI & Modal Components ---');
assert.match(featureFlagsUi, /SkeletonHeroKpis/, 'FeatureFlags UI must use SkeletonHeroKpis');
assert.match(featureFlagsUi, /SkeletonTableRows/, 'FeatureFlags UI must use SkeletonTableRows');
assert.match(featureFlagsUi, /EditFeatureFlagModal/, 'FeatureFlags UI must integrate EditFeatureFlagModal');
assert.match(featureFlagsUi, /Tạo Cờ Tính Năng Mới/, 'FeatureFlags UI must provide Create button');
assert.match(featureFlagsUi, /rollout_percentage/, 'FeatureFlags UI must show rollout_percentage');

for (const scope of ['scope_type', 'shop_id', 'user_id', 'plan_code']) {
  assert.match(featureFlagsUi, new RegExp(scope), `FeatureFlags UI must handle ${scope}`);
  assert.match(editModal, new RegExp(scope), `EditFeatureFlagModal must handle ${scope}`);
}

console.log('✅ ALL FEATURE FLAGS & ROLLOUT CONTROL TESTS PASSED SUCCESSFULLY!');
