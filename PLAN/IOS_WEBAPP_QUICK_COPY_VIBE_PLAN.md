# Kế hoạch Vibe Code: Quick Copy iOS cho Webapp Bóc Tách Đơn

## 1. Mục tiêu

Nâng cấp đúng màn hình webapp `/?tab=parse` hiện tại thành luồng thao tác nhanh trên iPhone:

`Facebook/Zalo -> dán nội dung -> bóc tách -> sửa nhanh -> copy lần lượt -> dán vào app J&T/VNPost`

Kết quả cần đạt:

- Không viết lại parser đang hoạt động.
- Một lần chạm để copy mỗi trường.
- Có nút `Copy tiếp theo` để người dùng không phải tìm trường.
- Nhớ trường đã copy khi chuyển qua lại giữa Safari/PWA và app hãng.
- Ưu tiên thao tác một tay trên iPhone.
- Không tự động đọc clipboard sau khi trang tải.

## 2. Phạm vi

### Trong phạm vi

- Tab `parse` tại `src/ui/index/App.jsx`.
- Giao diện kết quả bóc tách và clipboard write.
- Hai thứ tự copy: J&T và VNPost.
- Sửa nhanh kết quả trước khi copy.
- Lưu tạm tiến độ Quick Copy trên thiết bị.
- Kiểm thử logic, build và kiểm tra thủ công trên iPhone.

### Ngoài phạm vi

- Điều khiển app J&T/VNPost native.
- Tự bấm dropdown địa chỉ hoặc nút tạo đơn.
- Accessibility automation.
- Thay đổi auth, phân quyền, database hoặc identity của đơn hàng.
- Viết lại `OrderProcessor` hoặc thay đổi kết quả parser hiện hữu.
- Gọi AI chỉ để phục vụ thao tác copy.

## 3. Hiện trạng cần giữ

- Entry UI: `src/ui/index/App.jsx`.
- Parser hiện tại: `OrderProcessor.parse(parseText)` trong `handleParse`.
- Kết quả hiện có: `name`, `phone`, `address`, `orderCode`, `codAmount`, `productItem`, `extraNote`.
- Hàm lưu nháp hiện tại: `handleSaveDraft`.
- Mobile shell, bottom navigation, safe-area và PWA manifest hiện có phải tiếp tục hoạt động.
- `npm run build` phải tiếp tục build và đồng bộ `extension/` theo invariant của repository.

## 4. Trải nghiệm đích

### 4.1 Sau khi bóc tách

Hiển thị theo thứ tự:

1. Bộ chọn `J&T` / `VNPost`.
2. Các trường có thể sửa trực tiếp.
3. Danh sách copy nhanh, mỗi hàng là toàn bộ vùng bấm tối thiểu 48px.
4. Thanh sticky `Copy tiếp theo` nằm trên bottom navigation.
5. Nút phụ `Copy toàn bộ` và `Làm lại`.

### 4.2 Trạng thái một trường

- `Chưa copy`: nền trung tính, icon copy.
- `Vừa copy`: nền xanh, dấu check, toast ngắn.
- `Thiếu dữ liệu`: cảnh báo vàng, không đưa vào chuỗi Copy Next.
- `Đang sửa`: input lớn, có nút Lưu/Hủy.

### 4.3 Thứ tự mặc định

```js
const QUICK_COPY_PRESETS = {
  jt: ['name', 'phone', 'address', 'codAmount', 'orderCode', 'extraNote'],
  vnpost: ['phone', 'name', 'address', 'codAmount', 'orderCode', 'extraNote']
};
```

Chỉ copy các trường có giá trị. `codAmount` phải copy dạng số thuần, ví dụ `350000`, không copy `350.000 đ`.

### 4.4 Copy toàn bộ

Định dạng:

```text
Người nhận: Nguyễn Văn A
SĐT: 0901234567
Địa chỉ: 12 Nguyễn Trãi, Phường Bến Thành, TP.HCM
Mã đơn: FB1025
COD: 350000
Ghi chú: Giao giờ hành chính
```

## 5. Thiết kế module

### 5.1 Logic thuần

Tạo `src/ui/index/quick-copy.js` với interface nhỏ:

```js
buildQuickCopyFields(parsedResult, carrier)
formatQuickCopyValue(field, value)
formatFullOrderCopy(parsedResult)
getNextCopyIndex(fields, copiedKeys, currentIndex)
```

Module không được truy cập React, DOM, clipboard, localStorage hoặc Supabase. Đây là test surface cho toàn bộ logic thứ tự và định dạng.

### 5.2 UI

Tạo `src/ui/index/components/QuickCopyPanel.jsx`:

```jsx
<QuickCopyPanel
  value={parsedResult}
  carrier={quickCopyCarrier}
  progress={quickCopyProgress}
  onCarrierChange={...}
  onChange={...}
  onCopyField={...}
  onCopyNext={...}
  onCopyAll={...}
  onReset={...}
/>
```

Component chỉ render và phát sự kiện. `App.jsx` tiếp tục sở hữu state và parser flow.

### 5.3 Clipboard adapter

Tạo một hàm async tại seam UI:

```js
copyToClipboard(text)
```

Thứ tự thực hiện:

1. `await navigator.clipboard.writeText(text)` khi có secure context.
2. Nếu thất bại, dùng textarea tạm, select và `document.execCommand('copy')`.
3. Chỉ đánh dấu thành công sau khi clipboard write thành công.
4. Thất bại phải hiện toast có hướng dẫn chọn và copy thủ công.

Không dùng timer để giả định copy thành công.

### 5.4 Lưu tiến độ

Dùng localStorage key có version:

```text
af_quick_copy_v1
```

Chỉ lưu:

- `parsedResult` đang thao tác.
- Carrier preset.
- Các field đã copy.
- Current step.
- `updatedAt`.

Quy tắc:

- Khôi phục khi reload trong vòng 24 giờ.
- Hết 24 giờ thì tự xóa.
- Nút `Làm lại` xóa toàn bộ dữ liệu Quick Copy.
- Không đồng bộ trạng thái từng bước lên Supabase.

## 6. Bảng công việc

| ID | Công việc | File chính | Phụ thuộc | Hoàn thành khi |
| --- | --- | --- | --- | --- |
| QC-01 | Chụp baseline và thêm test logic Quick Copy ở trạng thái đỏ | `tests/unit/index-quick-copy.test.mjs` | Không | Test mô tả preset, bỏ trường rỗng, COD số thuần, Copy All và Next Step; ít nhất một test fail trước implementation |
| QC-02 | Xây logic thuần Quick Copy | `src/ui/index/quick-copy.js` | QC-01 | Toàn bộ test QC-01 pass, module không dùng browser globals |
| QC-03 | Thay `copyText` hiện tại bằng clipboard adapter có await và fallback | `src/ui/index/App.jsx` hoặc helper sát UI | QC-01 | Thành công/thất bại phản ánh đúng kết quả clipboard; không đánh dấu giả |
| QC-04 | Tạo QuickCopyPanel và field card có thể sửa | `src/ui/index/components/QuickCopyPanel.jsx` | QC-02, QC-03 | Tên, SĐT, địa chỉ, COD, mã đơn, ghi chú sửa và copy độc lập được |
| QC-05 | Tích hợp vào tab parse hiện tại | `src/ui/index/App.jsx` | QC-04 | Sau `OrderProcessor.parse`, panel xuất hiện; parser và Save Draft cũ vẫn hoạt động |
| QC-06 | Thêm selector J&T/VNPost và Copy Next | `QuickCopyPanel.jsx`, `quick-copy.js` | QC-05 | Đổi hãng đổi thứ tự; nút Copy Next luôn trỏ tới trường hợp lệ tiếp theo |
| QC-07 | Thêm sticky action và responsive iPhone | `src/ui/index/index-styles.css` | QC-05 | Không che bottom nav/safe area; thao tác chính cao tối thiểu 48px; dùng tốt ở 320px width |
| QC-08 | Lưu/khôi phục tiến độ 24 giờ | `src/ui/index/App.jsx` hoặc `quick-copy.persistence.js` | QC-05 | Reload không mất đơn/bước; dữ liệu quá hạn và Reset bị xóa |
| QC-09 | Cập nhật test mobile/PWA | `tests/unit/index-mobile-pwa.test.mjs` | QC-07 | Test khóa safe-area, touch target, QuickCopyPanel và không có auto clipboard read |
| QC-10 | Build và kiểm thử hồi quy | Không sửa ngoài phạm vi | QC-01..QC-09 | Test Quick Copy, test mobile PWA, `npm test`, `npm run build`, build guard đều pass |
| QC-11 | Kiểm thử iPhone thật | Checklist thủ công bên dưới | QC-10 | Pass Safari và Add to Home Screen; copy/paste được vào ít nhất app J&T hoặc VNPost |

## 7. Test cases bắt buộc

### Logic

1. Preset J&T trả đúng thứ tự.
2. Preset VNPost trả đúng thứ tự.
3. Trường rỗng không xuất hiện trong Copy Next.
4. COD `350000` copy thành `350000`.
5. COD `0` vẫn là giá trị hợp lệ nếu parser xác nhận COD 0.
6. Copy Next bỏ qua trường đã copy.
7. Đổi carrier reset con trỏ nhưng không xóa dữ liệu đơn.
8. Copy All không sinh dòng rỗng hoặc `undefined`.
9. Sửa một field cập nhật cả field card và Copy All.
10. Reload khôi phục đúng bước trong 24 giờ; dữ liệu cũ hơn 24 giờ bị bỏ.

### Hồi quy

1. `handleParse` vẫn dùng `OrderProcessor.parse`.
2. `handleSaveDraft` vẫn lưu được đơn.
3. Chuyển tab không làm crash.
4. Bottom navigation không bị sticky action che.
5. Không thay đổi logic order identity, auth hoặc Supabase.

### iPhone thủ công

1. Mở bằng Safari qua HTTPS.
2. Add to Home Screen và mở standalone.
3. Dán một tin nhắn Zalo/Facebook mẫu.
4. Bóc tách, sửa tên và COD.
5. Copy từng trường và paste vào Notes.
6. Chuyển qua lại giữa PWA và J&T/VNPost; quay lại vẫn giữ đúng bước.
7. Kiểm tra iPhone SE width và iPhone có Dynamic Island/safe area.
8. Tắt mạng sau khi trang đã tải; trạng thái đơn đang làm không bị mất.

## 8. Guardrails cho agent vibe code

- Giữ thay đổi tập trung ở tab parse và các file Quick Copy mới.
- Tái sử dụng `OrderProcessor.parse`; nâng giao diện kết quả, không xây parser song song.
- Mỗi đơn mới có identity riêng; dữ liệu khách hàng không phải identity đơn.
- Clipboard write chỉ chạy sau thao tác người dùng.
- Ưu tiên CSS class trong `index-styles.css`; không tiếp tục mở rộng khối inline style lớn.
- Không thêm dependency nếu bài toán giải được bằng Web API và React hiện có.
- Giữ copy tiếng Việt đúng UTF-8.
- Sau thay đổi UI/runtime, bắt buộc chạy `npm run build` để đồng bộ `extension/`.
- Không sửa file ngoài danh sách khi chưa chứng minh dependency trực tiếp.

## 9. Lệnh xác minh

```powershell
node tests/unit/index-quick-copy.test.mjs
node tests/unit/index-mobile-pwa.test.mjs
npm test
npm run build
node scripts/check-extension-build.js
```

## 10. Definition of Done

- Người dùng có thể dán và bóc tách đơn như trước.
- Kết quả có thể chỉnh sửa trước khi copy.
- Có preset J&T/VNPost, Copy Next, Copy All và Reset.
- Copy báo thành công dựa trên kết quả thật của Clipboard API.
- Chuyển sang app hãng rồi quay lại không mất tiến độ.
- Giao diện không che bottom navigation và đạt touch target tối thiểu 48px.
- Không phát sinh network request hoặc AI request chỉ vì copy.
- Mọi test và build trong mục 9 pass.
- Kiểm thử thủ công thành công trên iPhone Safari và PWA Add to Home Screen.

## 11. Prompt khởi động cho agent

```text
Thực hiện lần lượt các task QC-01 đến QC-11 trong PLAN/IOS_WEBAPP_QUICK_COPY_VIBE_PLAN.md.

Giữ nguyên OrderProcessor.parse, auth, Supabase và order identity. Viết test logic Quick Copy trước implementation. Chỉ sửa tab parse của src/ui/index/App.jsx, tạo module/helper/component đã chỉ định và thêm CSS/test tương ứng. Sau mỗi task, chạy test hẹp của task. Trước khi hoàn tất, chạy đầy đủ các lệnh ở mục 9 và báo kết quả từng lệnh. Không đánh dấu hoàn thành nếu chưa qua checklist iPhone; nếu không có thiết bị thật, ghi rõ QC-11 đang chờ kiểm thử thủ công.
```
