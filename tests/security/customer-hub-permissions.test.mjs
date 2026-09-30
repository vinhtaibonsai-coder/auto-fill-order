import assert from 'node:assert/strict'; import fs from 'node:fs';
const sql=fs.readFileSync('database/migrations/v64_customer_hub_360.sql','utf8'); const ui=fs.readFileSync('src/ui/options/pages/Customers/CustomerHub.jsx','utf8'); assert.match(sql,/customer_hub_list/); assert.match(sql,/\*\*\*/); assert.match(ui,/permission\.canExport/); assert.match(ui,/permission\.canManage/);
console.log('Customer Hub permission contracts passed.');
