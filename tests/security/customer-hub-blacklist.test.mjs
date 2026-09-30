import assert from 'node:assert/strict'; import fs from 'node:fs';
const sql=fs.readFileSync('database/migrations/v64_customer_hub_360.sql','utf8'); assert.match(sql,/is_shop_owner_or_manager\(v_customer\.shop_id\)/); assert.match(sql,/blacklist_reason_required/); assert.match(sql,/CUSTOMER_BLACKLIST/); assert.match(sql,/customer_hub_protect_sensitive_update/);
console.log('Customer Hub blacklist contracts passed.');
