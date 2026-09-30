# Incident: Trang Options trong thư mục Extension bị lỗi Vite Dev Mode khi không chạy dev server

Ngày phát hiện: 2026-08-29  
Phạm vi: Thư mục `extension/`, `options.html`, `scripts/sync-extension.js`, `package.json` (`npm run build`).

## 1. Triệu chứng
Khi người dùng mở trang Cài đặt Extension (`chrome-extension://.../options.html`), màn hình hiển thị lỗi:
> **Vite Dev Mode**  
> Cannot connect to the Vite Dev Server on http://localhost:5173  
> Double-check that Vite is working and reload the extension.

Lỗi này xảy ra khi máy tính không bật terminal chạy `npm run dev` (hoặc server dev bị tắt).

## 2. Nguyên nhân gốc
1. **Người dùng nạp Extension từ thư mục `extension/`**:
   - Thư mục nạp chính thức của tiện ích trên trình duyệt người dùng là: `G:\Other computers\My Computer\WEBAPP\ODER AUTO FILL\extension`.
2. **File `options.html` trong `extension/` bị dính stub Vite Dev Mode**:
   - Trong quá trình phát triển trước đó, file `extension/options.html` chứa mã HTML tải động từ Vite dev server (`<script src="/assets/loading-page-....js">` kết nối tới `localhost:5173`).
3. **Lệnh `npm run build` chưa tự động đồng bộ sang `extension/`**:
   - Trước đây, lệnh `npm run build` chỉ gọi `vite build` ra thư mục `dist/`. Nếu không chạy thêm `node scripts/sync-extension.js`, thư mục `extension/` vẫn giữ các file cũ/dev stub.

## 3. Giải pháp & Quy tắc Bất biến (Mandatory Invariant)

### Quy tắc bất biến:
- **Thư mục `extension/` là thư mục nạp chính thức của User**: Mọi file trong `extension/` (đặc biệt là `options.html`, `index.html`, `admin.html`, `assets/`, `src/`) PHẢI luôn ở trạng thái **Đóng gói Độc lập (Standalone Production)**, tuyệt đối không phụ thuộc vào `localhost:5173` hay tiến trình `npm run dev`.
- **`npm run build` bắt buộc phải tự động đồng bộ sang `extension/`**: Trong `package.json`, kịch bản `"build"` phải luôn là:
  ```json
  "build": "vite build && node scripts/sync-extension.js"
  ```
- **Trước khi hoàn tất bất kỳ thay đổi code UI/Logic nào**: Phải chạy `npm run build` để đảm bảo cả `dist/` và `extension/` được cập nhật đồng nhất.

## 4. Checklist phòng ngừa lỗi tái diễn
1. Sau khi chỉnh sửa component/trang React hoặc parser, chạy `npm run build`.
2. Kiểm tra `extension/options.html` phải chứa `<script type="module" crossorigin src="/assets/index-....js">` và `<link rel="stylesheet" crossorigin href="/assets/index-....css">` (không chứa text "Vite Dev Mode").
3. Chạy `npm test` để xác nhận tất cả các suite kiểm thử hợp lệ.
