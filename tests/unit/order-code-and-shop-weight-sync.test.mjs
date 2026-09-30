import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('JTAdapter fills codeEl and updates noteEl/goodsInp with orderCode', () => {
  const jtPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'jt', 'autofill.js');
  assert.ok(fs.existsSync(jtPath), 'jt/autofill.js must exist');
  const jtCode = fs.readFileSync(jtPath, 'utf8');

  // Kiểm tra gán mã đơn vào codeEl
  assert.match(jtCode, /if\s*\(codeEl\)\s*setInputValue\(codeEl,\s*orderCode\s*\|\|\s*''\)/, 'JTAdapter must set codeEl value');

  // Kiểm tra điền nội dung / ghi chú với mã đơn
  assert.match(jtCode, /if\s*\(noteEl\)\s*\{[\s\S]*setInputValue\(noteEl,\s*noteText\)/, 'JTAdapter must write noteText to noteEl');

  // Kiểm tra lấy khối lượng từ Cài đặt cửa hàng (default_package_weight)
  assert.match(jtCode, /default_package_weight/, 'resolveJTDefaultWeight must support default_package_weight');
  assert.match(jtCode, /pkgWeight\s*>=\s*10\s*\?\s*\(pkgWeight\s*\/\s*1000\)\s*:\s*pkgWeight/, 'resolveJTDefaultWeight must convert gram to kg');
});

test('VNPostAdapter resolves default weight with shop package weight fallback', () => {
  const vnpostPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'vnpost', 'autofill.js');
  assert.ok(fs.existsSync(vnpostPath), 'vnpost/autofill.js must exist');
  const vnpostCode = fs.readFileSync(vnpostPath, 'utf8');

  assert.match(vnpostCode, /default_package_weight/, 'resolveVNPostDefaultWeight must support default_package_weight');
  assert.match(vnpostCode, /chrome\.storage\.local\.get\(\['order_default_settings',\s*'default_weight_vnpost'/, 'resolveVNPostDefaultWeight maintains exact chrome.storage.local contract');
});

test('Content script updateSingleCarrierFieldInDOM synchronizes orderCode to carrier note/goods fields', () => {
  const indexPath = path.join(repoRoot, 'src', 'runtime', 'content', 'index.js');
  const indexCode = fs.readFileSync(indexPath, 'utf8');

  // Khi sửa orderCode trong DOM carrier
  assert.match(indexCode, /if\s*\(field === 'orderCode'\)\s*\{/, 'Must have handler for orderCode edit');
  assert.match(indexCode, /safeSetDomInput\(contentEl,\s*noteText\)/, 'VNPost must update contentEl with new orderCode');
  assert.match(indexCode, /safeSetDomInput\(goodsInp,\s*goodsText\)/, 'J&T must update goodsInp with new orderCode');
  assert.match(indexCode, /safeSetDomInput\(noteEl,\s*goodsText\)/, 'J&T must update noteEl with new orderCode');
});

test('ShopProfile and ShopService synchronize default_package_weight to local storage', () => {
  const shopProfilePath = path.join(repoRoot, 'src', 'ui', 'options', 'pages', 'General', 'ShopProfile.jsx');
  const shopProfileCode = fs.readFileSync(shopProfilePath, 'utf8');

  assert.match(shopProfileCode, /default_package_weight:\s*pkgWeight/, 'ShopProfile must save default_package_weight to chrome.storage');
  assert.match(shopProfileCode, /default_weight_jt:\s*pkgWeightKg/, 'ShopProfile must sync default_weight_jt (kg)');

  const shopServicePath = path.join(repoRoot, 'src', 'domain', 'shop', 'shop.service.js');
  const shopServiceCode = fs.readFileSync(shopServicePath, 'utf8');
  assert.match(shopServiceCode, /default_package_weight:\s*Number\(s\.default_package_weight\)\s*\|\|\s*0/, 'ShopService must map default_package_weight');
  assert.match(shopServiceCode, /default_weight_jt:\s*pkgWeightKg/, 'ShopService must sync active shop default_weight_jt');
});
