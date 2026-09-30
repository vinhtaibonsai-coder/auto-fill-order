import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql = fs.readFileSync('database/migrations/v64_customer_hub_360.sql', 'utf8');
assert.match(sql, /public\.is_shop_member\(shop_id\)/);
assert.match(sql, /public\.is_shop_owner_or_manager\(v_customer\.shop_id\)/);
assert.match(sql, /CUSTOMER_BLACKLIST/);
assert.doesNotMatch(sql, /USING \(true\)/i);
console.log('Customer Hub RLS contracts passed.');
