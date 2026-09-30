import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const validatorCode = fs.readFileSync(path.join(root, 'src/domain/order/order.validator.js'), 'utf8');

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(validatorCode, sandbox);
const { cleanPhone, isValidVietnamesePhone, checkDuplicatePhone, checkBlacklist } = sandbox.OrderValidator;

// 1. Phone cleaning and validation
assert.equal(cleanPhone('0912.345.678'), '0912345678');
assert.equal(cleanPhone('+84912345678'), '0912345678');
assert.equal(cleanPhone('84912345678'), '0912345678');
assert.equal(isValidVietnamesePhone('0912345678'), true);
assert.equal(isValidVietnamesePhone('0388888888'), true);
assert.equal(isValidVietnamesePhone('123456'), false);

// 2. Duplicate check within 24h (Advisory Warning Only)
const now = Date.now();
const recentOrders = [
  {
    order_code: 'DH-001',
    phone: '0912345678',
    name: 'Nguyễn Văn A',
    submitted_at: new Date(now - 2 * 3600 * 1000).toISOString() // 2 hours ago
  },
  {
    order_code: 'DH-002',
    phone: '0987654321',
    name: 'Trần Thị B',
    submitted_at: new Date(now - 48 * 3600 * 1000).toISOString() // 48 hours ago
  }
];

const dupResult1 = checkDuplicatePhone('0912345678', recentOrders, 24);
assert.equal(dupResult1.isDuplicate, true, 'Should detect duplicate phone within 24h');
assert.equal(dupResult1.orderCode, 'DH-001');
assert.equal(dupResult1.hoursAgo, 2);

const dupResult2 = checkDuplicatePhone('0987654321', recentOrders, 24);
assert.equal(dupResult2.isDuplicate, false, 'Should ignore order placed 48h ago when threshold is 24h');

const dupResult3 = checkDuplicatePhone('0900000000', recentOrders, 24);
assert.equal(dupResult3.isDuplicate, false, 'Non-existent phone should not be duplicate');

// 3. Blacklist check
const blacklist = [
  { phone: '0911111111', reason: 'Bom hàng 3 lần' },
  '0922222222'
];

const blResult1 = checkBlacklist('0911.111.111', blacklist);
assert.equal(blResult1.isBlacklisted, true);
assert.equal(blResult1.reason, 'Bom hàng 3 lần');

const blResult2 = checkBlacklist('+84922222222', blacklist);
assert.equal(blResult2.isBlacklisted, true);

const blResult3 = checkBlacklist('0933333333', blacklist);
assert.equal(blResult3.isBlacklisted, false);

console.log('Order validator and anti-duplicate tests passed!');
