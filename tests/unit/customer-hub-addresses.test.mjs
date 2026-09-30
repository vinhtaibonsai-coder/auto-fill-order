import assert from 'node:assert/strict';
import { mapCustomerDashboard } from '../../src/application/customer/customer.service.js';
const result = mapCustomerDashboard({ customers:[{id:'c1',normalized_phone:'0912345678',name:'An',total_orders:2}], addresses:[{customer_id:'c1',raw_address:'Địa chỉ A',is_primary:true},{customer_id:'c1',raw_address:'Địa chỉ B'}], orders:[],notes:[],tags:[],assignments:[] });
assert.equal(result.customers[0].primaryAddress, 'Địa chỉ A');
assert.equal(result.customers[0].addresses.length, 2);
console.log('Customer Hub address contracts passed.');
