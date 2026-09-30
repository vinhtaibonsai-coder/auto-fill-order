import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Verify panel.js and index.js implement the invariant
const panelSource = fs.readFileSync(path.join(process.cwd(), 'frontend/panel/panel.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(process.cwd(), 'src/runtime/content/index.js'), 'utf8');

assert.match(panelSource, /hasBothCodes\s*&&\s*checkCode\s*!==\s*subCode/, 'panel.js must not alert duplicate when both orders have different orderCodes');
assert.match(indexSource, /hasBothCodes\s*&&\s*checkCode\s*!==\s*subCode/, 'index.js must not alert duplicate when both orders have different orderCodes');

// Simulation of duplicate check logic
function checkDuplicate(currentOrder, submittedOrders) {
  const checkCode = String(currentOrder.orderCode || '').trim().toLowerCase();
  const checkPhone = String(currentOrder.phone || '').replace(/\D/g, '');
  const checkName = String(currentOrder.name || '').trim().toLowerCase();

  return (submittedOrders || []).some(sub => {
    const subCode = String(sub.orderCode || sub.order_code || '').trim().toLowerCase();
    const subPhone = String(sub.phone || '').replace(/\D/g, '');
    const subName = String(sub.name || sub.customer_name || '').trim().toLowerCase();

    const hasBothCodes = Boolean(checkCode && checkCode !== '—' && checkCode !== '-' && subCode && subCode !== '—' && subCode !== '-');
    if (hasBothCodes && checkCode !== subCode) {
      return false; // Different order codes -> distinct orders, do not warn
    }

    const matchCode = Boolean(checkCode && checkCode !== '—' && checkCode !== '-' && subCode && checkCode === subCode);
    const matchPhone = Boolean(checkPhone && checkPhone.length >= 9 && subPhone && checkPhone === subPhone);
    const matchCustomer = Boolean(checkPhone && checkName && checkPhone === subPhone && checkName === subName);

    return matchCode || matchPhone || matchCustomer;
  });
}

const submittedOrders = [
  {
    id: 'ord_1',
    name: 'Nguyễn Tiến Thanh',
    phone: '0916144938',
    orderCode: 'P120.43',
    submittedAt: new Date().toISOString()
  }
];

// Case A: Same phone, DIFFERENT orderCode (buying another bonsai tree) -> NOT duplicate
const newOrderDifferentTree = {
  name: 'Nguyễn Tiến Thanh',
  phone: '0916144938',
  orderCode: 'E90.189'
};
assert.equal(checkDuplicate(newOrderDifferentTree, submittedOrders), false, 'Same customer with different orderCode must not trigger duplicate warning');

// Case B: Same phone, SAME orderCode -> DUPLICATE
const sameOrderReEntered = {
  name: 'Nguyễn Tiến Thanh',
  phone: '0916144938',
  orderCode: 'P120.43'
};
assert.equal(checkDuplicate(sameOrderReEntered, submittedOrders), true, 'Same customer with same orderCode must trigger duplicate warning');

// Case C: Same phone, MISSING orderCode -> DUPLICATE (cannot distinguish tree)
const orderWithoutCode = {
  name: 'Nguyễn Tiến Thanh',
  phone: '0916144938',
  orderCode: ''
};
assert.equal(checkDuplicate(orderWithoutCode, submittedOrders), true, 'Same customer without orderCode must trigger duplicate warning');

console.log('Distinct order code duplicate alert unit tests passed!');
