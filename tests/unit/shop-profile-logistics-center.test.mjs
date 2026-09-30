import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const source = readSource('src/ui/options/pages/General/ShopProfile.jsx');
const migration = readSource('database/migrations/v63_shop_profile_logistics_fields.sql');
const pkg = JSON.parse(readSource('package.json'));

assert.match(source, /PATCH/, 'Shop Profile must update public.shops with PATCH');
assert.match(source, /\/rest\/v1\/shops\?id=eq\./, 'Shop Profile must PATCH the selected shop by id');
assert.match(source, /globalThis\.ShopService\.syncShopsFromCloud\(\)/, 'Shop Profile must sync cloud shops back to local cache after save');
assert.match(source, /AuthSession\.updateActiveShop/, 'Branch switching must persist active_shop_id in session');
assert.match(source, /ShopService\.setActiveShop/, 'Branch switching must update local active shop');

[
  'Định danh & Chi nhánh',
  'Địa chỉ Kho gửi bưu điện',
  'Mã Hợp đồng & Tiền tố đơn',
  'Tài khoản Ngân hàng đối soát COD',
  'Cấu hình Bưu phẩm mặc định'
].forEach(label => assert.match(source, new RegExp(label), `Shop Profile must render card: ${label}`));

[
  'sender_name',
  'sender_phone',
  'sender_address',
  'sender_province',
  'sender_district',
  'sender_ward',
  'order_code_prefix',
  'vnpost_customer_code',
  'jt_contract_code',
  'bank_account_no',
  'bank_account_name',
  'default_package_weight',
  'default_package_note',
  'shipping_fee_payer'
].forEach(field => assert.match(source, new RegExp(field), `Shop Profile must support field: ${field}`));

assert.match(source, /VIETQR_BANKS[\s\S]*VCB[\s\S]*MB[\s\S]*TCB[\s\S]*AGRIBANK/, 'Shop Profile must include 40+ VietQR bank options');
assert.match(source, /ADDRESS_TREE/, 'Shop Profile must include a 3-level province/district/ward selector source');
assert.match(source, /Chi nhánh đang cấu hình/, 'Shop Profile must expose a multi-branch switcher');
assert.match(source, /Tem gửi bưu điện mẫu/, 'Shop Profile must render sender label preview');
assert.match(source, /SkeletonCard/, 'Shop Profile must render skeleton loading state');
assert.match(source, /Thử lại/, 'Shop Profile must render retry action on load error');
assert.match(source, /Đã lưu hồ sơ/, 'Shop Profile must render success toast copy');

[
  'default_carrier',
  'bank_name',
  'default_package_weight',
  'default_package_note',
  'shipping_fee_payer'
].forEach(field => assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${field}`), `Migration must add shops.${field}`));

assert.match(pkg.scripts.test, /shop-profile-logistics-center\.test\.mjs/, 'Main test script must include Shop Profile logistics coverage');

console.log('Shop Profile logistics center tests passed.');
