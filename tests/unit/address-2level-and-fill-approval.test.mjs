import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ─── 1. TEST CHUẨN HÓA VÀ NHẬN DIỆN ĐỊA CHỈ 2 CẤP VS 3 CẤP ───
const contentJs = fs.readFileSync(path.join(process.cwd(), 'src/runtime/content/index.js'), 'utf8');

// Trích xuất hàm detectAddressLevels và formatTwoLevelAddress từ source
assert.match(contentJs, /function detectAddressLevels\(/, 'detectAddressLevels function must be defined in index.js');
assert.match(contentJs, /function formatTwoLevelAddress\(/, 'formatTwoLevelAddress function must be defined in index.js');

// Trích xuất hàm thực thi để test trực tiếp
function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Cannot find ${name}`);
  let depth = 0;
  let inBody = false;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') {
      depth++;
      inBody = true;
    } else if (src[i] === '}') {
      depth--;
      if (inBody && depth === 0) {
        const fnCode = src.slice(start, i + 1);
        return new Function(`return (${fnCode});`)();
      }
    }
  }
  throw new Error(`Cannot parse ${name}`);
}

const detectAddressLevels = extractFunction(contentJs, 'detectAddressLevels');
const formatTwoLevelAddress = extractFunction(contentJs, 'formatTwoLevelAddress');

// Case 1: 339 ngõ quỳnh phường bạch mai hà nội (Đơn thực tế người dùng vừa đưa)
const rawUserOrder = '339 ngõ quỳnh phường bạch mai hà nội';
const addrResultUserOrder = {
  street: '339 Ngõ Quỳnh',
  ward: 'Phường Bạch Mai',
  district: 'Quận Hai Bà Trưng',
  province: 'Thành phố Hà Nội'
};

const level1 = detectAddressLevels(rawUserOrder, addrResultUserOrder);
assert.equal(level1, 2, 'Khách nhập phường + thành phố (không có quận) phải được nhận diện là Địa chỉ 2 Cấp');

const formatted2Level = formatTwoLevelAddress(addrResultUserOrder, rawUserOrder);
assert.equal(formatted2Level, '339 Ngõ Quỳnh, Phường Bạch Mai, Thành phố Hà Nội');
assert.doesNotMatch(formatted2Level, /Hai Bà Trưng/i, 'Địa chỉ 2 cấp không được tự ý chèn Quận Hai Bà Trưng');

// Case 2: số 5 ngõ 122 vĩnh tuy hai bà trưng hà nội (Khách có ghi rõ quận)
const rawWithDistrict = 'số 5 ngõ 122 vĩnh tuy hai bà trưng hà nội';
const addrResultWithDistrict = {
  street: '5 Ngõ 122 Vĩnh Tuy',
  ward: 'Phường Vĩnh Tuy',
  district: 'Quận Hai Bà Trưng',
  province: 'Thành phố Hà Nội'
};

const level2 = detectAddressLevels(rawWithDistrict, addrResultWithDistrict);
assert.equal(level2, 3, 'Khách có ghi rõ quận "hai bà trưng" phải được nhận diện là Địa chỉ 3 Cấp');

// Case 3: 27/7A huỳnh tịnh của ,quận 3 tp hcm (Quận dạng số)
const rawDistrictNum = '27/7A huỳnh tịnh của ,quận 3 tp hcm';
const addrResultDistrictNum = {
  street: '27/7A Huỳnh Tịnh Của',
  ward: 'Phường Võ Thị Sáu',
  district: 'Quận 3',
  province: 'Thành phố Hồ Chí Minh'
};

const level3 = detectAddressLevels(rawDistrictNum, addrResultDistrictNum);
assert.equal(level3, 3, 'Khách có ghi "quận 3" phải được nhận diện là Địa chỉ 3 Cấp');

// Case 4: 122 lê lợi phường bến thành tp hcm (Khách ghi 2 cấp tại TP.HCM)
const rawHcm2Level = '122 lê lợi phường bến thành tp hcm';
const addrResultHcm2Level = {
  street: '122 Lê Lợi',
  ward: 'Phường Bến Thành',
  district: 'Quận 1',
  province: 'Thành phố Hồ Chí Minh'
};

const level4 = detectAddressLevels(rawHcm2Level, addrResultHcm2Level);
assert.equal(level4, 2, 'Khách ghi phường Bến Thành + TP.HCM (không ghi quận 1) phải được nhận diện là Địa chỉ 2 Cấp');

// Case 5: Số 18/189 đường Cầu Diễn, Xuân Phương, Hà Nội (Khách ghi xã/phường không có chữ phường)
const rawXuanPhuong = 'Số 18/189 đường Cầu Diễn, Xuân Phương, Hà Nội';
const addrResultXuanPhuong = {
  street: 'Số 18/189 Đường Cầu Diễn',
  ward: 'Xuân Phương',
  district: 'Quận Nam Từ Liêm',
  province: 'Thành phố Hà Nội'
};

const level5 = detectAddressLevels(rawXuanPhuong, addrResultXuanPhuong);
assert.equal(level5, 2, 'Khách ghi Xuân Phương + Hà Nội (không có quận Nam Từ Liêm) phải được nhận diện là Địa chỉ 2 Cấp');

const formatted2LevelXuanPhuong = formatTwoLevelAddress(addrResultXuanPhuong, rawXuanPhuong);
assert.equal(formatted2LevelXuanPhuong, 'Số 18/189 Đường Cầu Diễn, Phường Xuân Phương, Thành phố Hà Nội');
assert.doesNotMatch(formatted2LevelXuanPhuong, /Nam Từ Liêm/i, 'Địa chỉ 2 cấp không được tự ý chèn Quận Nam Từ Liêm');

// ─── 2. TEST INVARIANT: BẢO LƯU DISTRICT TRONG ADDRESSPARTS ĐỂ CHỌN DROPDOWN BƯU CỤC ───
// Khi khách đưa địa chỉ 2 cấp:
// - address (chuỗi hiển thị/nhãn in) là 2 cấp: "339 Ngõ Quỳnh, Phường Bạch Mai, Thành phố Hà Nội"
// - addressParts.district VẪN PHẢI LÀ "Quận Hai Bà Trưng" để adapter bưu điện chọn được dropdown
assert.match(contentJs, /localResult\.addressParts\s*=\s*\{\s*ward:\s*addrResult\.ward/);
assert.match(contentJs, /district:\s*addrResult\.district/);
assert.match(contentJs, /province:\s*addrResult\.province/);

// ─── 3. TEST CƠ CHẾ ĐỐI CHIẾU FORM BƯU ĐIỆN VS PANEL KHI TẠO ĐƠN ───
// Khi bấm Nhập đơn trên panel: điền trực tiếp, KHÔNG gọi modal
assert.doesNotMatch(contentJs, /function triggerFillForm[\s\S]*?showOrderApprovalModal/,
  'triggerFillForm must NOT open modal so user can observe and fill directly');

// Khi bấm Tạo đơn trên bưu điện: handleCarrierSubmitClick PHẢI gọi showOrderApprovalModal với carrierData và panelData
assert.match(contentJs, /carrierData:\s*scrapedData/,
  'handleCarrierSubmitClick must pass carrierData to showOrderApprovalModal');
assert.match(contentJs, /panelData:\s*panelData/,
  'handleCarrierSubmitClick must pass panelData to showOrderApprovalModal');

// Đảm bảo cờ __AF_JUST_FILLED__ và __AF_LAST_FILLED_ORDER__ được thiết lập sau khi điền
assert.match(contentJs, /globalThis\.__AF_JUST_FILLED__\s*=\s*true/,
  'triggerFillForm must set __AF_JUST_FILLED__ flag on success');
assert.match(contentJs, /globalThis\.__AF_LAST_FILLED_ORDER__\s*=/,
  'triggerFillForm must snapshot __AF_LAST_FILLED_ORDER__ on success');

// ─── 4. TEST PANEL DISPLAY VÀ BẢNG ĐỐI CHIẾU 2 CỘT ───
const panelJs = fs.readFileSync(path.join(process.cwd(), 'frontend/panel/panel.js'), 'utf8');
assert.match(panelJs, /af-compare-container/, 'showOrderApprovalModal must render 2-column compare container');
assert.match(panelJs, /Form bưu điện ⟷ Panel Auto Fill/, 'showOrderApprovalModal must compare Carrier Form vs Panel Auto Fill');
assert.match(panelJs, /modal-quick-apply-panel-btn/, 'showOrderApprovalModal must offer quick sync button from Panel');
assert.match(contentJs, /function checkCarrierFormValidation\(/, 'checkCarrierFormValidation must be defined in index.js');
assert.match(contentJs, /const validation = checkCarrierFormValidation\(activePlatform\);[\s\S]*?if \(!validation\.isValid\)/,
  'handleCarrierSubmitClick must validate carrier form before opening showOrderApprovalModal');

console.log('✅ ALL ADDRESS 2-LEVEL DETECTION & ORDER APPROVAL MODAL TESTS PASSED!');
