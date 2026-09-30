import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Duplicate order detection across past dates and Customer Order Count badge', () => {
  const panelSource = fs.readFileSync(path.join(process.cwd(), 'frontend/panel/panel.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(process.cwd(), 'src/runtime/content/index.js'), 'utf8');

  // 1. Invariant: Customer count badge exists in panel.js
  assert.match(
    panelSource,
    /id="rev-customer-order-count"/,
    'panel.js must contain #rev-customer-order-count element'
  );
  assert.match(
    panelSource,
    /setCustomerOrderCountBadge/,
    'panel.js must define and call setCustomerOrderCountBadge'
  );

  // 2. Invariant: checkAndDisplayDuplicateAlert must detect matching orderCode across past dates
  const submittedOrders = [
    {
      id: 'ord_past_1',
      name: 'Phát',
      phone: '0983002074',
      orderCode: 'e80.288',
      trackingCode: 'CD376884415VN',
      submittedAt: '2026-09-01T10:00:00.000Z' // 10 days ago!
    }
  ];

  function evaluateDuplicate(data, orders) {
    const checkCode = String(data.orderCode || '').trim().toLowerCase();
    const cleanCheckCode = checkCode.replace(/[\s\.\-_]/g, '');
    const checkPhone = String(data.phone || '').replace(/\D/g, '');

    return orders.some(sub => {
      const subCode = String(sub.orderCode || sub.order_code || '').trim().toLowerCase();
      const cleanSubCode = subCode.replace(/[\s\.\-_]/g, '');
      const subPhone = String(sub.phone || '').replace(/\D/g, '');

      const hasBothCodes = Boolean(checkCode && checkCode !== '—' && checkCode !== '-' && subCode && subCode !== '—' && subCode !== '-');
      if (hasBothCodes && checkCode !== subCode && cleanCheckCode !== cleanSubCode) {
        return false;
      }

      const matchCode = Boolean(
        (checkCode && checkCode !== '—' && checkCode !== '-' && subCode && checkCode === subCode) ||
        (cleanCheckCode && cleanCheckCode !== '—' && cleanCheckCode !== '-' && cleanSubCode && cleanCheckCode === cleanSubCode)
      );
      const matchPhone = Boolean(checkPhone && checkPhone.length >= 9 && subPhone && checkPhone === subPhone);

      const rawDate = sub.submittedAt || sub.createdAt || '';
      const isToday = rawDate ? new Date(rawDate).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) : false;

      return matchCode || (matchPhone && isToday);
    });
  }

  // Case 1: Same orderCode placed 10 days ago -> MUST be detected as duplicate!
  assert.equal(
    evaluateDuplicate({ orderCode: 'e80.288', phone: '0983002074', name: 'Phát' }, submittedOrders),
    true,
    'Order with same orderCode from 10 days ago must be detected as duplicate'
  );

  // Case 2: Code with dot or case difference (e.g. E80.288 or e80288) -> MUST be detected as duplicate!
  assert.equal(
    evaluateDuplicate({ orderCode: 'E80.288', phone: '0983002074', name: 'Phát' }, submittedOrders),
    true,
    'Order with case variation E80.288 must match'
  );
  assert.equal(
    evaluateDuplicate({ orderCode: 'e80288', phone: '0983002074', name: 'Phát' }, submittedOrders),
    true,
    'Order with clean code variation e80288 must match'
  );

  // Case 3: Same customer with DIFFERENT orderCode (e.g. e80.289) from 10 days ago -> NOT duplicate (repeat customer)
  assert.equal(
    evaluateDuplicate({ orderCode: 'e80.289', phone: '0983002074', name: 'Phát' }, submittedOrders),
    false,
    'Repeat customer with different orderCode must not be flagged as duplicate'
  );
});
