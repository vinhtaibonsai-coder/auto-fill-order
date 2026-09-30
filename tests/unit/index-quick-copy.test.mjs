import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_COPY_PRESETS,
  buildQuickCopyFields,
  formatQuickCopyValue,
  formatFullOrderCopy,
  getNextCopyIndex
} from '../../src/ui/index/quick-copy.js';

test('QC-01.1: QUICK_COPY_PRESETS matches J&T and VNPost order requirements', () => {
  assert.deepEqual(QUICK_COPY_PRESETS.jt, ['name', 'phone', 'address', 'codAmount', 'orderCode', 'extraNote']);
  assert.deepEqual(QUICK_COPY_PRESETS.vnpost, ['phone', 'name', 'address', 'codAmount', 'orderCode', 'extraNote']);
});

test('QC-01.2: buildQuickCopyFields filters empty fields and formats values correctly', () => {
  const sample = {
    name: 'Nguyễn Văn A',
    phone: '0901234567',
    address: '12 Nguyễn Trãi, Bến Thành, Q1, HCM',
    orderCode: 'FB1025',
    codAmount: 350000,
    extraNote: '' // Empty note should be omitted
  };

  const jtFields = buildQuickCopyFields(sample, 'jt');
  assert.equal(jtFields.length, 5);
  assert.equal(jtFields[0].key, 'name');
  assert.equal(jtFields[0].value, 'Nguyễn Văn A');
  assert.equal(jtFields[1].key, 'phone');
  assert.equal(jtFields[1].value, '0901234567');
  assert.equal(jtFields[2].key, 'address');
  assert.equal(jtFields[3].key, 'codAmount');
  assert.equal(jtFields[3].value, '350000'); // Pure digits
  assert.equal(jtFields[4].key, 'orderCode');
  assert.equal(jtFields[4].value, 'FB1025');

  const vnpostFields = buildQuickCopyFields(sample, 'vnpost');
  assert.equal(vnpostFields.length, 5);
  assert.equal(vnpostFields[0].key, 'phone');
  assert.equal(vnpostFields[1].key, 'name');
});

test('QC-01.3: formatQuickCopyValue formats pure numeric digits for COD', () => {
  assert.equal(formatQuickCopyValue('codAmount', 350000), '350000');
  assert.equal(formatQuickCopyValue('codAmount', '350.000 đ'), '350000');
  assert.equal(formatQuickCopyValue('codAmount', 0), '0');
  assert.equal(formatQuickCopyValue('codAmount', '0'), '0');
  assert.equal(formatQuickCopyValue('name', '  Trần Bình  '), 'Trần Bình');
  assert.equal(formatQuickCopyValue('phone', '0987.654.321'), '0987654321');
});

test('QC-01.4: formatFullOrderCopy formats standard multi-line text without empty or undefined lines', () => {
  const sample = {
    name: 'Nguyễn Văn A',
    phone: '0901234567',
    address: '12 Nguyễn Trãi, Phường Bến Thành, TP.HCM',
    orderCode: 'FB1025',
    codAmount: 350000,
    extraNote: 'Giao giờ hành chính'
  };

  const expected = [
    'Người nhận: Nguyễn Văn A',
    'SĐT: 0901234567',
    'Địa chỉ: 12 Nguyễn Trãi, Phường Bến Thành, TP.HCM',
    'Mã đơn: FB1025',
    'COD: 350000',
    'Ghi chú: Giao giờ hành chính'
  ].join('\n');

  assert.equal(formatFullOrderCopy(sample), expected);

  // Partial sample without extraNote and orderCode
  const partial = {
    name: 'Lê Thị B',
    phone: '0912345678',
    address: 'Hà Nội',
    codAmount: 0
  };

  const partialExpected = [
    'Người nhận: Lê Thị B',
    'SĐT: 0912345678',
    'Địa chỉ: Hà Nội',
    'COD: 0'
  ].join('\n');

  assert.equal(formatFullOrderCopy(partial), partialExpected);
});

test('QC-01.5: getNextCopyIndex finds the next uncopied valid field index', () => {
  const fields = [
    { key: 'phone', value: '0901234567' },
    { key: 'name', value: 'Nguyễn Văn A' },
    { key: 'address', value: '123 Đường 1' },
    { key: 'codAmount', value: '150000' }
  ];

  // Starting at begin, none copied
  assert.equal(getNextCopyIndex(fields, new Set(), 0), 0);

  // Phone already copied, should point to index 1 (name)
  assert.equal(getNextCopyIndex(fields, new Set(['phone']), 0), 1);

  // Phone and name copied, currently at index 1 -> next is 2 (address)
  assert.equal(getNextCopyIndex(fields, new Set(['phone', 'name']), 1), 2);

  // All copied -> returns -1
  assert.equal(getNextCopyIndex(fields, new Set(['phone', 'name', 'address', 'codAmount']), 3), -1);
});

test('QC-08: Quick Copy persistence saves, loads within 24h, and expires properly', async () => {
  const {
    saveQuickCopyProgress,
    loadQuickCopyProgress,
    clearQuickCopyProgress,
    QUICK_COPY_STORAGE_KEY
  } = await import('../../src/ui/index/quick-copy.persistence.js');

  // Giả lập localStorage
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  const sampleState = {
    parsedResult: { name: 'Nguyễn Văn C', phone: '0933333333' },
    carrier: 'vnpost',
    copiedKeys: ['phone'],
    currentIndex: 1
  };

  // 1. Lưu và khôi phục
  saveQuickCopyProgress(sampleState);
  const loaded = loadQuickCopyProgress();
  assert.ok(loaded);
  assert.equal(loaded.parsedResult.name, 'Nguyễn Văn C');
  assert.equal(loaded.carrier, 'vnpost');
  assert.ok(loaded.copiedKeys.has('phone'));
  assert.equal(loaded.currentIndex, 1);

  // 2. Dữ liệu quá hạn 24 giờ
  const expiredPayload = {
    ...sampleState,
    updatedAt: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
  };
  store.set(QUICK_COPY_STORAGE_KEY, JSON.stringify(expiredPayload));
  assert.equal(loadQuickCopyProgress(), null, 'Dữ liệu quá 24h phải bị xóa và trả về null');

  // 3. Clear progress
  saveQuickCopyProgress(sampleState);
  clearQuickCopyProgress();
  assert.equal(loadQuickCopyProgress(), null);

  delete globalThis.localStorage;
});

