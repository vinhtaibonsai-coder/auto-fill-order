import assert from 'node:assert/strict'; import { exportCustomersCsv } from '../../src/application/customer/customer-import.service.js'; import fs from 'node:fs';
const csv=exportCustomersCsv([{phone:'0912345678',name:'Tên, có dấu',totalOrders:2,totalSpent:100000}]); assert.ok(csv.startsWith('\uFEFF')); assert.match(csv,/"Tên, có dấu"/); assert.match(fs.readFileSync('src/ui/options/pages/Customers/CustomerHub.jsx','utf8'),/audit\('CUSTOMER_EXPORT'/);
console.log('Customer Hub export contracts passed.');
