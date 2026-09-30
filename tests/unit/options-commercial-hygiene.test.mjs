import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('options UI hygiene: no hardcoded mock email fallback admin@af-store.vn in src/ui/options', () => {
  const optionsDir = path.join(projectRoot, 'src', 'ui', 'options');
  
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(jsx?|tsx?)$/.test(f)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(
          !content.includes('admin@af-store.vn'),
          `File ${path.relative(projectRoot, fullPath)} still contains hardcoded mock email 'admin@af-store.vn'`
        );
      }
    }
  }

  scanDir(optionsDir);
});

test('options UI hygiene: ShopProfile.jsx provides complete 63 provinces coverage', () => {
  const shopProfilePath = path.join(projectRoot, 'src', 'ui', 'options', 'pages', 'General', 'ShopProfile.jsx');
  const content = fs.readFileSync(shopProfilePath, 'utf8');

  assert.ok(content.includes('VIETNAM_PROVINCES'), 'ShopProfile must define VIETNAM_PROVINCES');
  assert.ok(content.includes('Hà Nội'), 'VIETNAM_PROVINCES must contain Hà Nội');
  assert.ok(content.includes('TP Hồ Chí Minh'), 'VIETNAM_PROVINCES must contain TP Hồ Chí Minh');
  assert.ok(content.includes('Bình Dương'), 'VIETNAM_PROVINCES must contain Bình Dương');
  assert.ok(content.includes('Đồng Nai'), 'VIETNAM_PROVINCES must contain Đồng Nai');
  assert.ok(content.includes('An Giang'), 'VIETNAM_PROVINCES must contain An Giang');
  assert.ok(content.includes('Cà Mau'), 'VIETNAM_PROVINCES must contain Cà Mau');
  assert.ok(content.includes('district-options'), 'ShopProfile must provide datalist for flexible district entry');
  assert.ok(content.includes('ward-options'), 'ShopProfile must provide datalist for flexible ward entry');
});

test('options UI hygiene: Subscription.jsx uses bank-compliant short VietQR memo and transactions history', () => {
  const subPath = path.join(projectRoot, 'src', 'ui', 'options', 'pages', 'Subscription', 'Subscription.jsx');
  const content = fs.readFileSync(subPath, 'utf8');

  assert.ok(content.includes('`AF ${code}`'), 'Subscription must use short bank-compliant AF <CODE> memo');
  assert.ok(!content.includes('`AUTOFILL ${activeShopId}'), 'Subscription must not use raw 36-character UUID in bank memo');
  assert.ok(content.includes('payment_transactions'), 'Subscription must query payment_transactions');
  assert.ok(content.includes('Lịch Sử Giao Dịch & Hóa Đơn Thuê Bao'), 'Subscription must render transaction history section');
});

test('options UI hygiene: Notifications.jsx uses dynamic real-time status without fake fabricated timestamps', () => {
  const notifPath = path.join(projectRoot, 'src', 'ui', 'options', 'pages', 'Notifications', 'Notifications.jsx');
  const content = fs.readFileSync(notifPath, 'utf8');

  assert.ok(!content.includes('notif_sec_1'), 'Notifications must not contain hardcoded fake notif_sec_1');
  assert.ok(!content.includes('notif_welcome_2'), 'Notifications must not contain hardcoded fake notif_welcome_2');
  assert.ok(content.includes('af_read_notifications'), 'Notifications must persist read IDs in storage');
});
