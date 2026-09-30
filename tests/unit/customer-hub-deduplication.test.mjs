import assert from 'node:assert/strict'; import fs from 'node:fs';
const sql=fs.readFileSync('database/migrations/v64_customer_hub_360.sql','utf8');
assert.match(sql,/UNIQUE\(shop_id, source_type, source_order_id\)/); assert.match(sql,/customer_order_links_canonical_uidx/); assert.match(sql,/ON CONFLICT DO NOTHING/);
console.log('Customer Hub deduplication contracts passed.');
