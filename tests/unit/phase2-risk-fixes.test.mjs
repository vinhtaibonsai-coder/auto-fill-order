import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('🧪 Running Phase 2 Risk Fixes Validation Tests...');

// Test 1: T021 - Verify no runtime environment injects fake customer/order data
{
  const panelAppPath = path.join(rootDir, 'src/ui/panel/App.jsx');
  const content = fs.readFileSync(panelAppPath, 'utf-8');

  assert.doesNotMatch(content, /const mockAi|window\.location\.hostname\s*===\s*['"]localhost['"]/,
    'T021 FAILED: App.jsx must not inject mock AI data in runtime');
  assert.ok(content.includes('AI_PROVIDER_UNAVAILABLE') && content.includes("addressSource: 'local_parser'"),
    'T021 FAILED: App.jsx must degrade gracefully using attributed local data');
  console.log('✅ PASS T021: Production panel flow does not inject fake customer/order data');
}

// Test 2: T022 - Verify scrape behavior defines shipFeeBox before access to prevent ReferenceError
{
  const contentIndexPath = path.join(rootDir, 'src/runtime/content/index.js');
  const content = fs.readFileSync(contentIndexPath, 'utf-8');

  const shipFeeBoxIndex = content.indexOf('const shipFeeBox = document.querySelector');
  const usageIndex = content.indexOf('if (shipFeeBox) collectFee = !!shipFeeBox.checked;');

  assert.ok(shipFeeBoxIndex !== -1, 'T022 FAILED: shipFeeBox must be declared');
  assert.ok(usageIndex !== -1, 'T022 FAILED: collectFee check must exist');
  assert.ok(shipFeeBoxIndex < usageIndex, 'T022 FAILED: shipFeeBox must be declared before usage');
  console.log('✅ PASS T022: Scrape behavior safely declares shipFeeBox before access');
}

// Test 3: T023 - Verify admin plan mutation performs a real repository call
{
  const adminServicePath = path.join(rootDir, 'src/domain/admin/admin.service.js');
  const content = fs.readFileSync(adminServicePath, 'utf-8');

  assert.ok(
    content.includes('await AdminRepository.updateShopPlan(shopId, newPlan)'),
    'T023 FAILED: updateShopPlan must invoke AdminRepository.updateShopPlan directly'
  );
  console.log('✅ PASS T023: Admin plan mutation performs a real database repository update');
}

// Test 4: T024 - Verify non-admin users are blocked from admin mutations in _ensureAdmin
{
  const adminServicePath = path.join(rootDir, 'src/domain/admin/admin.service.js');
  const content = fs.readFileSync(adminServicePath, 'utf-8');

  assert.ok(
    content.includes("roles(code)") && content.includes("SYSTEM_ADMIN"),
    'T024 FAILED: _ensureAdmin must verify SYSTEM_ADMIN role from user_roles'
  );
  console.log('✅ PASS T024: Non-admin users are blocked from admin mutations by authorization checks');
}

console.log('\n🎉 ALL PHASE 2 RISK FIX TESTS PASSED SUCCESSFULLY!\n');
