import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isValidShopOrderCode, evaluateDataQualityMetrics } from '../../src/domain/admin/data-quality.engine.js';
import '../../src/application/order-parser/parser.js';
const OrderProcessor = globalThis.OrderProcessor;

const repoRoot = process.cwd();

test('1. isValidShopOrderCode distinguishes shop codes from product names or pure digits', () => {
  // Pure alphabetic / product names -> INVALID
  assert.equal(isValidShopOrderCode('caycover'), false);
  assert.equal(isValidShopOrderCode('CayCover'), false);
  assert.equal(isValidShopOrderCode('Cây Cover'), false);
  assert.equal(isValidShopOrderCode('bonsai'), false);
  assert.equal(isValidShopOrderCode('LuaThuySinh'), false);
  assert.equal(isValidShopOrderCode('cay'), false);
  assert.equal(isValidShopOrderCode(''), false);
  assert.equal(isValidShopOrderCode(null), false);
  assert.equal(isValidShopOrderCode(undefined), false);

  // Pure digits (phone / COD / numbers) -> INVALID
  assert.equal(isValidShopOrderCode('100000'), false);
  assert.equal(isValidShopOrderCode('0912345678'), false);
  assert.equal(isValidShopOrderCode('123'), false);

  // Valid structured shop codes with digits -> VALID
  assert.equal(isValidShopOrderCode('e120.02'), true);
  assert.equal(isValidShopOrderCode('p150.12'), true);
  assert.equal(isValidShopOrderCode('TAI0001'), true);
  assert.equal(isValidShopOrderCode('TAI0002'), true);
  assert.equal(isValidShopOrderCode('E80.290'), true);
  assert.equal(isValidShopOrderCode('DH-12345'), true);
  assert.equal(isValidShopOrderCode('ORD_991'), true);
  assert.equal(isValidShopOrderCode('VN123456789'), true);
});

test('2. OrderProcessor.extractProductItem extracts product item from DH: Cây Cover', () => {
  const rawText1 = `Nguyễn Văn A
0912345678
Số 10 Tràng Tiền, Hoàn Kiếm, Hà Nội
ĐH: Cây Cover
COD: 150k`;
  const parsed1 = OrderProcessor.parse(rawText1);
  assert.equal(parsed1.productItem, 'Cây Cover');
  // Must NOT treat "Cây Cover" as orderCode
  assert.notEqual((parsed1.orderCode || '').toLowerCase(), 'caycover');
  assert.equal(parsed1.orderCode, '');

  const rawText2 = `0989935936
Cây Cover
123 Lê Lợi, P. Bến Nghé, Quận 1, TP. HCM`;
  const parsed2 = OrderProcessor.parse(rawText2);
  assert.equal(parsed2.productItem, 'Cây Cover');
  assert.notEqual((parsed2.orderCode || '').toLowerCase(), 'caycover');
});

test('3. OrderProcessor.extractOrderCode accepts structured shop codes and rejects non-shop words', () => {
  const rawWithShopCode1 = `Nguyễn Văn B - 0987654321
Ấp 1, Xã Tân Tây, Gò Công Đông, Tiền Giang
Mã: e120.02
COD: 250k`;
  const parsedShop1 = OrderProcessor.parse(rawWithShopCode1);
  assert.equal(parsedShop1.orderCode, 'e120.02');

  const rawWithShopCode2 = `TAI0001
Trần Thị C - 0903123456
Số 5 Nguyễn Huệ, Quận 1, TP. HCM`;
  const parsedShop2 = OrderProcessor.parse(rawWithShopCode2);
  assert.equal(parsedShop2.orderCode, 'TAI0001');

  const rawWithShopCode3 = `Lê Văn D - 0918112233
Thôn Nam, Xã Quảng Minh, Sầm Sơn, Thanh Hóa
p150.12
180k`;
  const parsedShop3 = OrderProcessor.parse(rawWithShopCode3);
  assert.equal(parsedShop3.orderCode, 'p150.12');
});

test('4. Data Quality Engine does not flag duplicate pure-text names like "caycover"', () => {
  const ordersWithNonCodeDups = [
    {
      id: 'ord_1',
      shop_id: 'shop_001',
      order_code: 'caycover',
      customer_name: 'Khách A',
      phone: '0912345678',
      created_at: new Date().toISOString()
    },
    {
      id: 'ord_2',
      shop_id: 'shop_001',
      order_code: 'caycover',
      customer_name: 'Khách B',
      phone: '0987654321',
      created_at: new Date().toISOString()
    }
  ];

  const metricsNonCode = evaluateDataQualityMetrics({ orders: ordersWithNonCodeDups });
  assert.equal(
    metricsNonCode.invalid_duplicate_order_code,
    0,
    'Orders with pure text non-shop order_code must NOT be flagged as duplicate order code issue'
  );

  const ordersWithShopCodeDups = [
    {
      id: 'ord_3',
      shop_id: 'shop_001',
      order_code: 'TAI0001',
      customer_name: 'Khách C',
      phone: '0912345678',
      created_at: new Date().toISOString()
    },
    {
      id: 'ord_4',
      shop_id: 'shop_001',
      order_code: 'TAI0001',
      customer_name: 'Khách D',
      phone: '0987654321',
      created_at: new Date().toISOString()
    }
  ];

  const metricsShopCode = evaluateDataQualityMetrics({ orders: ordersWithShopCodeDups });
  assert.equal(
    metricsShopCode.invalid_duplicate_order_code,
    2,
    'Orders with real duplicate shop order_code (e.g. TAI0001) MUST be flagged as duplicate order code issue'
  );
});

test('5. Migration v119 prevents RLS recursion and uses proper shop code filters', () => {
  const migPath = path.join(repoRoot, 'database/migrations/v119_fix_duplicate_order_code_and_profiles_rls.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  // Verify is_system_admin does NOT select from public.profiles
  const isSysAdminMatch = sql.match(/CREATE OR REPLACE FUNCTION public\.is_system_admin[\s\S]*?\$function\$;/);
  assert.ok(isSysAdminMatch, 'v119 must define is_system_admin');
  assert.equal(
    /FROM\s+public\.profiles/i.test(isSysAdminMatch[0]),
    false,
    'is_system_admin in v119 must NEVER query public.profiles to prevent 42P17 RLS recursion'
  );

  // Verify duplicate order code in SQL filters for digits and length >= 3
  assert.match(sql, /order_code\s*~\s*'\\d'/, 'v119 SQL must require digits in order_code');
  assert.match(sql, /length\(trim\(order_code\)\)\s*>=\s*3/, 'v119 SQL must require length >= 3 in order_code');
  assert.match(sql, /NOT\s*\(\s*(?:trim\()order_code(?:\))?\s*~\s*'\^\\d\+\$'\s*\)|order_code\s*!~\s*'\^\\d\+\$'/, 'v119 SQL must reject pure digits in order_code');

  // Verify admin_update_user_name RPC exists
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_update_user_name/, 'v119 must create admin_update_user_name RPC');
});
