import assert from 'node:assert/strict'; import fs from 'node:fs';
const panel=fs.readFileSync('frontend/panel/panel.js','utf8'); assert.match(panel,/rpc\/customer_hub_lookup/); assert.match(panel,/controller\.abort\(\)/); assert.match(panel,/việc bóc tách và nhập đơn vẫn hoạt động/); assert.match(panel,/LTV/);
console.log('Panel customer summary contracts passed.');
