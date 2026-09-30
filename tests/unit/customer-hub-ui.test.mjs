import assert from 'node:assert/strict'; import fs from 'node:fs';
const ui=fs.readFileSync('src/ui/options/pages/Customers/CustomerHub.jsx','utf8'); for(const text of ['Quét đơn lịch sử','Import CSV','HỒ SƠ KHÁCH HÀNG 360','ĐỊA CHỈ TỪNG GIAO']) assert.ok(ui.includes(text));
assert.match(ui,/repository\.loadDashboard/); assert.doesNotMatch(ui,/localStorage\.setItem\('customer_crm_(notes|tags)'/);
console.log('Customer Hub UI contracts passed.');
