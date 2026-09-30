import assert from 'node:assert/strict';
import '../../src/application/address/sanitizer.js';
const AddressSanitizer = globalThis.AddressSanitizer;

console.log('--- Testing AddressSanitizer Deduplication & Normalization ---');

// Test 1: Deduplicate multi-tier repeated administrative segments
{
  const rawAddress = 'Thôn 2, Xã Ea Kao, Thành phố Buôn Ma Thuột, Đắk Lắk, Ea Kao, Buôn Ma Thuột, Đắk Lắk';
  const cleaned = AddressSanitizer.deduplicate(rawAddress);
  console.log('Test 1 Raw:    ', rawAddress);
  console.log('Test 1 Cleaned:', cleaned);
  assert.equal(cleaned, 'Thôn 2, Xã Ea Kao, Thành phố Buôn Ma Thuột, Đắk Lắk');
}

// Test 2: Consecutive duplicate ward / district
{
  const rawAddress = 'Số 10 Nguyễn Huệ, Phường Bến Nghé, Phường Bến Nghé, Quận 1, Hồ Chí Minh';
  const cleaned = AddressSanitizer.deduplicate(rawAddress);
  console.log('Test 2 Cleaned:', cleaned);
  assert.equal(cleaned, 'Số 10 Nguyễn Huệ, Phường Bến Nghé, Quận 1, Hồ Chí Minh');
}

// Test 3: Multiple nested repeats from historical machine learning feedback loops
{
  const rawAddress = '123 Đường 3/2, Phường 12, Quận 10, Hồ Chí Minh, Phường 12, Quận 10, Hồ Chí Minh';
  const cleaned = AddressSanitizer.deduplicate(rawAddress);
  console.log('Test 3 Cleaned:', cleaned);
  assert.equal(cleaned, '123 Đường 3/2, Phường 12, Quận 10, Hồ Chí Minh');
}

// Test 4: cleanObject strips redundant administrative units from street field
{
  const addrObj = {
    street: 'Số 45 Trần Phú, Phường 7, Thành phố Tuy Hòa',
    ward: 'Phường 7',
    district: 'Thành phố Tuy Hòa',
    province: 'Phú Yên'
  };
  const cleanedObj = AddressSanitizer.cleanObject(addrObj);
  console.log('Test 4 Cleaned Object street:      ', cleanedObj.street);
  console.log('Test 4 Cleaned Object full_address:', cleanedObj.full_address);
  assert.equal(cleanedObj.street, 'Số 45 Trần Phú');
  assert.equal(cleanedObj.full_address, 'Số 45 Trần Phú, Phường 7, Thành phố Tuy Hòa, Phú Yên');
}

// Test 5: Empty and falsy values handling
{
  assert.equal(AddressSanitizer.deduplicate(''), '');
  assert.equal(AddressSanitizer.deduplicate(null), '');
  assert.equal(AddressSanitizer.deduplicate(undefined), '');
  assert.equal(AddressSanitizer.cleanObject(null), null);
  const emptyObj = AddressSanitizer.cleanObject({});
  assert.equal(emptyObj.street, '');
  assert.equal(emptyObj.full_address, '');
}

console.log('✅ All AddressSanitizer tests passed successfully!');
