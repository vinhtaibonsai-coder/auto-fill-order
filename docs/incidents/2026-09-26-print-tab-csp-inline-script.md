# Incident: Vi phạm Content Security Policy (CSP) khi mở trang in nhãn vận đơn do chứa inline script và onclick

Ngày phát hiện: 2026-09-26  
Phạm vi: `src/application/printing/label-renderer.js`, `src/ui/options/pages/Printing/PrintCenter.jsx`, `extension/assets/PrintCenter-*.js`, `options.html`.

## 1. Triệu chứng
Khi người dùng bấm nút **"In nhãn PDF"** trong Trung tâm in ấn (`PrintCenter`), một cửa sổ/tab in mới (`about:blank`) được mở ra, nhưng trình duyệt lập tức chặn thực thi và báo lỗi đỏ trên DevTools Console:
```text
Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'". Either the 'unsafe-inline' keyword, a hash ('sha256-X2BARMrUpHr5G6QCnunVib6fRgi1u957W85sTSI6S7A='), or a nonce ('nonce-...') is required to enable inline execution.
Context: about:blank
Stack Trace: assets/PrintCenter-DsCZj6kh.js:532 (cn)
```

## 2. Nguyên nhân gốc
1. **Kế thừa CSP của Chrome Extension trong Manifest V3**:
   - Khi `window.open('', '_blank')` được gọi từ trang cấu hình extension (`chrome-extension://<id>/options.html`), cửa sổ mới (`about:blank`) thuộc extension context và kế thừa chính sách CSP nghiêm ngặt:
     `script-src 'self' 'wasm-unsafe-eval' ...`
   - Manifest V3 cấm hoàn toàn từ khóa `'unsafe-inline'`, cấm thực thi thẻ `<script>` không có file nguồn ngoài, và cấm các thuộc tính HTML xử lý sự kiện dạng inline (`onclick="..."`, `onload="..."`).
2. **Template HTML in ấn chứa thẻ `<script>` và `onclick`**:
   - Hàm `renderBulkHtmlDocument()` trong `label-renderer.js` trước đó tạo chuỗi HTML chứa đoạn inline script để tự động kích hoạt `window.print()` sau khi tải xong trang:
     ```html
     <script>
       (function() {
         window.addEventListener('DOMContentLoaded', () => { setTimeout(() => window.print(), 450); });
       })();
     </script>
     ```
   - Đồng thời, các nút toolbar có thuộc tính `onclick="window.print()"` và `onclick="window.close()"`.
   - Khi `printTab.document.write(html)` được gọi, trình duyệt quét thấy thẻ `<script>` và thuộc tính inline event, dẫn đến việc kích hoạt CSP violation chặn đứng script.
3. **Thư mục `extension/` chưa được biên dịch lại đồng bộ**:
   - Bản build cũ trong `extension/assets/` vẫn lưu mã nguồn cũ trước khi loại bỏ inline script.

## 3. Giải pháp & Quy tắc Bất biến (Mandatory Invariant)

### Quy tắc bất biến:
- **KHÔNG BAO GIỜ chèn inline `<script>` hoặc inline handler (`onclick`, `onload`, `onchange`) vào HTML template in ấn**:
  Mọi tài liệu HTML tạo ra để in ấn từ extension (qua `renderBulkHtmlDocument` hoặc tương tự) PHẢI là Pure Semantic HTML + CSS thuần, tuyệt đối không chứa thẻ `<script>` và không chứa các thuộc tính `on*`.
- **Ủy quyền toàn bộ tương tác và kích hoạt in cho `wirePrintTabControls`**:
  Tất cả các thao tác tương tác (bấm nút In, bấm nút Đóng, đổi khổ giấy, đổi lề in, đổi cỡ chữ, phím tắt `Ctrl+P`, tự động mở `win.print()` sau 450ms) PHẢI được gắn bằng DOM API (`addEventListener`, `.onclick`) từ file script của extension bundle thông qua hàm `wirePrintTabControls(printTab, ...)`.
- **Hỗ trợ phóng to cỡ chữ in (Font Scaling)**:
  Phông chữ in nhãn mặc định là **200% (Gấp đôi)** theo yêu cầu chuẩn hóa tem in bưu điện rõ nét, hỗ trợ người dùng chuyển đổi linh hoạt (100%, 150%, 200%, 250%) trực tiếp trên toolbar và tự động lưu mặc định.
- **Tuân thủ Extension Folder Invariant**:
  Sau khi chỉnh sửa, bắt buộc phải chạy `npm run build` (`vite build && node scripts/sync-extension.js`) để đảm bảo thư mục `extension/` mang mã nguồn bundle mới nhất.

## 4. Checklist phòng ngừa lỗi tái diễn
1. **Kiểm tra CSP trước khi xuất chuỗi HTML**:
   - `renderBulkHtmlDocument()` không chứa bất kỳ chuỗi `<script` nào.
   - Các nút bấm dùng `type="button" data-action="print"` thay vì `onclick="window.print()"`.
2. **Chạy bộ kiểm thử tự động**:
   ```bash
   node --test tests/unit/print-center-filter-and-carrier.test.mjs tests/unit/label-renderer.test.mjs
   ```
   Xác nhận tất cả bài kiểm tra (bao gồm bài test CSP Invariant) đều PASS.
3. **Biên dịch và đồng bộ `extension/`**:
   ```bash
   npm run build
   ```
   Kiểm tra `extension/assets/PrintCenter-*.js` không còn chứa `onclick=` hay `<script`.
