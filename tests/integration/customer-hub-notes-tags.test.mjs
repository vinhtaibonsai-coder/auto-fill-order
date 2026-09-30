import assert from 'node:assert/strict'; import fs from 'node:fs';
const repository=fs.readFileSync('src/application/customer/customer.repository.js','utf8'); assert.match(repository,/addNote\(customerId, content/); assert.match(repository,/assignTag\(customerId, name/); assert.match(repository,/shop_id: this\.shopId/);
console.log('Customer Hub notes/tags cloud contracts passed.');
