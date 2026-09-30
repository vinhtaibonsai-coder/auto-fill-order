import test from 'node:test';
import assert from 'node:assert/strict';

function isOrderLocallyComplete(data) {
  if (!data) return false;
  const name = (data.name || '').trim();
  const phone = (data.phone || '').replace(/[\s.-]/g, '');
  const addr = (data.address || '').trim();
  const hasValidName = name.length >= 2 && !/^(anh|chị|em|bạn|khách|cô|chú)$/i.test(name);
  const hasValidPhone = /^(0|\+84)\d{9,10}$/.test(phone);
  const hasValidAddress = addr.length >= 10 && addr !== 'không tìm thấy';
  const hasCod = data.codAmount !== undefined && data.codAmount !== null && !isNaN(Number(data.codAmount));
  return hasValidName && hasValidPhone && hasValidAddress && hasCod;
}

test('Local-First AI-Last: qualifies clear orders for fast-path without AI call', () => {
  const clearOrder = {
    name: 'Nguyễn Văn An',
    phone: '0901234567',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    codAmount: 250000
  };

  assert.equal(isOrderLocallyComplete(clearOrder), true);
});

test('Local-First AI-Last: flags incomplete or ambiguous orders for AI fallback', () => {
  // Generic customer name
  assert.equal(isOrderLocallyComplete({
    name: 'Chị',
    phone: '0901234567',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    codAmount: 100000
  }), false);

  // Missing / invalid phone
  assert.equal(isOrderLocallyComplete({
    name: 'Trần Bình',
    phone: '12345',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    codAmount: 100000
  }), false);

  // Address not found
  assert.equal(isOrderLocallyComplete({
    name: 'Trần Bình',
    phone: '0912345678',
    address: 'không tìm thấy',
    codAmount: 100000
  }), false);

  // Too short / ambiguous address
  assert.equal(isOrderLocallyComplete({
    name: 'Trần Bình',
    phone: '0912345678',
    address: 'Chợ Mới',
    codAmount: 100000
  }), false);
});

test('Local-First Fast-path simulation: bypasses Groq when AddressEngine confirms valid hierarchy', async () => {
  let groqCalled = false;
  const mockGroqCaller = () => { groqCalled = true; };

  const mockAddressEngine = {
    async process(address) {
      if (address.includes('Bến Nghé')) {
        return {
          province: 'Hồ Chí Minh',
          ward: 'Phường Bến Nghé',
          district: 'Quận 1',
          fullAddress: '123 Lê Lợi, Phường Bến Nghé, Quận 1, Hồ Chí Minh',
          confidence: 95,
          source: 'local_pipeline'
        };
      }
      return { province: '', ward: '', confidence: 40 };
    }
  };

  const processOrder = async (order) => {
    if (isOrderLocallyComplete(order)) {
      const eng = await mockAddressEngine.process(order.address);
      if (eng && eng.province && (eng.ward || eng.district) && eng.confidence >= 80) {
        return {
          ...order,
          address: eng.fullAddress,
          confidence: eng.confidence,
          source: 'local_fastpath'
        };
      }
    }
    mockGroqCaller();
    return { ...order, source: 'ai' };
  };

  // 1. Clear order -> Local fastpath, no Groq
  const result1 = await processOrder({
    name: 'Nguyễn Văn An',
    phone: '0901234567',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    codAmount: 250000
  });

  assert.equal(result1.source, 'local_fastpath');
  assert.equal(groqCalled, false);

  // 2. Incomplete order -> Falls back to AI
  const result2 = await processOrder({
    name: 'Khách quen',
    phone: '0901234567',
    address: 'Giao chỗ cũ giúp em nhé',
    codAmount: 0
  });

  assert.equal(result2.source, 'ai');
  assert.equal(groqCalled, true);
});
