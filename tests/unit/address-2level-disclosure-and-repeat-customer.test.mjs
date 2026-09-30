import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const panelJs = read('frontend/panel/panel.js');
const indexJs = read('src/runtime/content/index.js');
const learningJs = read('src/application/address/learning.js');
const sanitizerJs = read('src/application/address/sanitizer.js');

// 1. Manifest includes data-new-loader.js and sanitizer.js in content_scripts
const contentScripts = manifest.content_scripts[0].js;
assert(contentScripts.includes('src/application/address/database/data-new-loader.js'), 'manifest must include data-new-loader.js in content_scripts');
assert(contentScripts.includes('src/application/address/sanitizer.js'), 'manifest must include sanitizer.js in content_scripts');
assert(contentScripts.indexOf('src/application/address/sanitizer.js') < contentScripts.indexOf('src/application/address/normalizer.js'), 'sanitizer.js must be loaded before normalizer and engine');

// 2. Panel contains id="address-reference-disclosure" without default open
assert.match(panelJs, /<details id="address-reference-disclosure" class="address-reference-disclosure">/, 'Panel must assign id to address disclosure and remove default open');
assert.doesNotMatch(panelJs, /<details id="address-reference-disclosure"[^>]*open/, 'Address disclosure must not be open by default');

// 3. Panel & index hide disclosure when addressLevel === 2
assert.match(panelJs, /refDisclosure\.style\.display = data\.addressLevel === 2 \? 'none' : ''/, 'Panel displayParsedData must hide disclosure when addressLevel === 2');
assert.match(indexJs, /refDisclosure\.style\.display = detectedLevel === 2 \? 'none' : ''/, 'index.js must hide disclosure when 2-level address is detected');

// 4. Learning.js utilizes AddressSanitizer
assert.match(learningJs, /globalThis\.AddressSanitizer\.cleanObject/, 'learning.js must invoke AddressSanitizer.cleanObject');
assert.match(learningJs, /globalThis\.AddressSanitizer\.deduplicate/, 'learning.js must invoke AddressSanitizer.deduplicate');

// 5. Test Sanitizer logic directly
// Evaluate sanitizer.js
const mockGlobal = { window: {}, globalThis: {} };
const fn = new Function('globalThis', 'window', sanitizerJs);
fn(mockGlobal.globalThis, mockGlobal.window);
const Sanitizer = mockGlobal.globalThis.AddressSanitizer;

// Test duplicate removal
const test1 = 'Nguyễn Văn Ngọc Tổ Dân Phố Chùa Phường Nếnh Tỉnh Bắc Ninh, Phường Nếnh';
const dedup1 = Sanitizer.deduplicate(test1);
assert.equal(dedup1, 'Nguyễn Văn Ngọc Tổ Dân Phố Chùa Phường Nếnh Tỉnh Bắc Ninh', 'Must remove trailing duplicate segment');

// Test cleanObject
const testObj = {
  street: 'Nguyễn Văn Ngọc Tổ Dân Phố Chùa Phường Nếnh Tỉnh Bắc Ninh, Phường Nếnh',
  ward: 'Phường Nếnh',
  district: '',
  province: 'Tỉnh Bắc Ninh'
};
const cleaned = Sanitizer.cleanObject(testObj);
assert.equal(cleaned.street, 'Nguyễn Văn Ngọc Tổ Dân Phố Chùa', 'Must strip trailing ward and province from street in cleanObject');
assert.equal(cleaned.ward, 'Phường Nếnh');
assert.equal(cleaned.province, 'Tỉnh Bắc Ninh');
assert.equal(cleaned.fullAddress, 'Nguyễn Văn Ngọc Tổ Dân Phố Chùa, Phường Nếnh, Tỉnh Bắc Ninh');
assert.equal(cleaned.isTwoLevel, true, 'Must identify as two-level address');

console.log('Address 2-level disclosure and repeat customer regression tests passed.');
