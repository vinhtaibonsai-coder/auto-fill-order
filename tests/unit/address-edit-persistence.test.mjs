import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// ─── 1. TEST ADDRESSLEARNING.LOOKUP ISOLATION AND CACHE SAFETY ───
const learningJs = fs.readFileSync(path.join(process.cwd(), 'src/application/address/learning.js'), 'utf8');

// Load AddressLearning in a clean sandbox
const context = {
  console,
  chrome: undefined,
  localStorage: {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, val) { this._data[key] = String(val); }
  }
};

vm.runInNewContext(learningJs, context);
const AddressLearning = context.AddressLearning;
assert.ok(AddressLearning, 'AddressLearning must be defined');

// Setup mock database with an old address learned for phone 0967607389
const mockOldAddress = {
  street: 'Số 5 Ngõ 122 Vĩnh Tuy',
  ward: 'Phường Vĩnh Tuy',
  district: 'Quận Hai Bà Trưng',
  province: 'Thành phố Hà Nội',
  confidence: 100
};

const mockCleanRawMatch = {
  street: '84 Nguyễn Văn Giáp',
  ward: 'Phường Cầu Diễn',
  district: 'Quận Nam Từ Liêm',
  province: 'Thành phố Hà Nội',
  confidence: 100
};

context.localStorage.setItem('addressLearningDB', JSON.stringify({
  byPhone: {
    '0967607389': mockOldAddress
  },
  byRaw: {
    '84 nguyễn văn giáp': mockCleanRawMatch
  }
}));

// Test Case A: User provides a new, different address for the same phone
// -> lookup must NOT return the old address from byPhone!
const lookupNewAddress = await AddressLearning.lookup('339 ngõ quỳnh phường bạch mai hà nội', '0967607389');
assert.equal(lookupNewAddress, null, 'Lookup must not return stale byPhone address when a specific rawAddress is provided');

// Test Case B: User provides an exact raw address that was previously learned
const lookupRawMatch = await AddressLearning.lookup('84 nguyễn văn giáp', '0999999999');
assert.ok(lookupRawMatch, 'Lookup should return match when rawAddress is in byRaw');
assert.equal(lookupRawMatch.match.street, '84 Nguyễn Văn Giáp');

// Test Case C: Order has no address (empty or "không tìm thấy")
// -> lookup CAN return the fallback from byPhone
const lookupEmptyAddress = await AddressLearning.lookup('', '0967607389');
assert.ok(lookupEmptyAddress, 'Lookup should use byPhone as fallback only when rawAddress is empty');
assert.equal(lookupEmptyAddress.match.street, 'Số 5 Ngõ 122 Vĩnh Tuy');

const lookupNotFoundAddress = await AddressLearning.lookup('không tìm thấy', '0967607389');
assert.ok(lookupNotFoundAddress, 'Lookup should use byPhone as fallback when rawAddress is "không tìm thấy"');
assert.equal(lookupNotFoundAddress.match.street, 'Số 5 Ngõ 122 Vĩnh Tuy');

// ─── 2. TEST UPDATEPARSEDFIELD PERSISTENCE CONTRACT IN CONTENT SCRIPT ───
const contentJs = fs.readFileSync(path.join(process.cwd(), 'src/runtime/content/index.js'), 'utf8');

// Ensure rev-address is not overwritten by normalizedAddress
assert.match(contentJs, /globalThis\.parsedDataStore\.address\s*=\s*value;/, 'updateParsedField must keep user-typed value in parsedDataStore.address');
assert.match(contentJs, /if\s*\(addressEl\s*&&\s*addressEl\.textContent\s*!==\s*value\)\s*\{\s*addressEl\.textContent\s*=\s*value;/, 'updateParsedField must preserve user-typed value in addressEl');
assert.doesNotMatch(contentJs, /addressEl\.textContent\s*=\s*normalizedAddress;/, 'updateParsedField must never overwrite addressEl with normalizedAddress');
assert.doesNotMatch(contentJs, /globalThis\.parsedDataStore\.address\s*=\s*normalizedAddress;/, 'updateParsedField must never overwrite parsedDataStore.address with normalizedAddress');

// Ensure human manual edits are learned with maximum confidence (100)
assert.match(contentJs, /parsedCorrect\.confidence\s*=\s*100;/, 'Manual address edits must be learned with 100 confidence in AKB');

console.log('✅ ALL ADDRESS EDIT PERSISTENCE & AKB ISOLATION TESTS PASSED!');
