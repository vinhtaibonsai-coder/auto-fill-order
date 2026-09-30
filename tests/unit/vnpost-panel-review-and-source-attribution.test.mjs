import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Running VNPost Form vs Panel Comparison and Source Attribution Tests...');

const contentJs = fs.readFileSync(path.join(process.cwd(), 'src/runtime/content/index.js'), 'utf8');
const panelJs = fs.readFileSync(path.join(process.cwd(), 'frontend/panel/panel.js'), 'utf8');
const stylesJs = fs.readFileSync(path.join(process.cwd(), 'frontend/panel/styling/styles.js'), 'utf8');

// ─── 1. BẤM NHẬP ĐƠN: ĐIỀN TRỰC TIẾP, KHÔNG BẬT MODAL ───
// Đảm bảo trong hàm triggerFillForm không hề gọi showOrderApprovalModal
assert.doesNotMatch(contentJs, /function triggerFillForm[\s\S]*?showOrderApprovalModal/,
  'triggerFillForm must NOT open modal when operator clicks Nhập đơn');

// Đảm bảo triggerFillForm gắn cờ __AF_JUST_FILLED__ và snapshot __AF_LAST_FILLED_ORDER__
assert.match(contentJs, /globalThis\.__AF_JUST_FILLED__\s*=\s*true/,
  'triggerFillForm must set globalThis.__AF_JUST_FILLED__ = true');
assert.match(contentJs, /globalThis\.__AF_LAST_FILLED_ORDER__\s*=\s*\{[\s\S]*?timestamp:\s*Date\.now\(\)/,
  'triggerFillForm must snapshot __AF_LAST_FILLED_ORDER__ with timestamp');

// ─── 2. BẤM TẠO ĐƠN BƯU CỤC: BẬT MODAL ĐỐI CHIẾU FORM VS PANEL ───
// handleCarrierSubmitClick phải chuẩn bị panelData từ parsedDataStore / __AF_LAST_FILLED_ORDER__
assert.match(contentJs, /carrierData:\s*scrapedData/,
  'handleCarrierSubmitClick must pass carrierData (scraped from DOM) to showOrderApprovalModal');
assert.match(contentJs, /panelData:\s*panelData/,
  'handleCarrierSubmitClick must pass panelData to showOrderApprovalModal');

// ─── 3. SHOWORDERAPPROVALMODAL: BẢNG ĐỐI CHIẾU 2 CỘT ───
assert.match(panelJs, /carrierData\s*=\s*null/, 'showOrderApprovalModal must accept carrierData option');
assert.match(panelJs, /panelData\s*=\s*null/, 'showOrderApprovalModal must accept panelData option');
assert.match(panelJs, /af-compare-container/, 'Modal must contain .af-compare-container');
assert.match(panelJs, /af-compare-row/, 'Modal must render .af-compare-row');
assert.match(panelJs, /Form bưu điện ⟷ Panel Auto Fill/, 'Modal must display comparison header between Form and Panel');
assert.match(panelJs, /modal-quick-apply-panel-btn/, 'Modal must provide quick sync button from Panel');

// Kiểm tra styling chứa đầy đủ classes cho bảng 2 cột
assert.match(stylesJs, /\.af-compare-container\s*\{/, 'styles.js must include .af-compare-container');
assert.match(stylesJs, /\.af-compare-header\s*\{/, 'styles.js must include .af-compare-header');
assert.match(stylesJs, /\.af-compare-row\.is-mismatch\s*\{/, 'styles.js must include mismatch styling');

// ─── 4. NGUỒN ĐƠN AUTO_FILL VÀ LƯU ĐƠN THÀNH CÔNG ───
// setupAutoSaveOnSubmit phải gán source: orderSource và hiển thị sourceText
assert.match(contentJs, /const isAutoFilled = Boolean\([\s\S]*?globalThis\.__AF_JUST_FILLED__[\s\S]*?\);[\s\S]*?const orderSource = isAutoFilled \? 'AUTO_FILL' : 'MANUAL_ENTRY';/,
  'setupAutoSaveOnSubmit must calculate isAutoFilled and orderSource');
assert.match(contentJs, /submittedOrder[\s\S]*?source:\s*orderSource/,
  'setupAutoSaveOnSubmit must attach source to submittedOrder');

// injectInterceptor phải tính isAutoFilled và gọi OrderStorage.saveSubmittedOrder
assert.match(contentJs, /OrderStorage\.saveSubmittedOrder\(submittedOrder\)\.then\(\((?:savedOrder)?\) => \{[\s\S]*?sourceText/,
  'injectInterceptor must unconditionally call OrderStorage.saveSubmittedOrder and show sourceText');

console.log('✅ ALL VNPOST FORM VS PANEL COMPARISON & SOURCE ATTRIBUTION TESTS PASSED!');
