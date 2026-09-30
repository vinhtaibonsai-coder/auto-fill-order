# Incident: Panel Extension không nhận trạng thái Đăng nhập từ Trang Cài đặt (Options)

Ngày phát hiện: 2026-08-28  
Phạm vi: Giao diện nổi trên VNPost/J&T (`content script`), Phiên đăng nhập `AuthSession`, Xác thực `AuthService.isAuthenticated`.

## 1. Triệu chứng
Người dùng đã đăng nhập thành công vào tài khoản tại trang Cài đặt Extension (`options.html`), nhưng khi mở trang tạo đơn VNPost (`my.vnpost.vn/order/domestic/create/`), Bảng nổi (Panel) vẫn hiển thị form `VNPost v1.0 (Xác thực) - Đăng Nhập Hệ Thống`.

## 2. Nguyên nhân gốc
1. **Thiếu hàm `isAuthenticated()` ở tầng Service / Session**:
   - `src/runtime/content/index.js` gọi `AuthService.isAuthenticated()` để kiểm tra phiên đăng nhập trước khi render UI.
   - Hàm `AuthService.isAuthenticated()` và `AuthSession.isAuthenticated()` chưa từng được định nghĩa trong `src/domain/auth/auth.service.js` và `auth.session.js`, khiến `typeof AuthService.isAuthenticated === 'function'` trả về `false`.
   - Kết quả: Biến `isAuth` luôn mang giá trị `false`, buộc hệ thống hiển thị Login Required Panel.
2. **Thiếu cơ chế lắng nghe sự kiện đồng bộ đa Tab (Cross-Tab Real-time Storage Listener)**:
   - Content Script chưa đăng ký `chrome.storage.onChanged` cho khóa `vnpost_session`.
   - Khi người dùng thao tác đăng nhập hoặc chuyển shop trên tab Options (`options.html`), tab VNPost đang mở không nhận được tín hiệu để tự động chuyển sang Input Panel.

## 3. Giải pháp & Quy tắc Bất biến
1. **Quy tắc Bất biến (Invariants)**:
   - `AuthService.isAuthenticated()` và `AuthSession.isAuthenticated()` là API bắt buộc của tầng Auth Domain.
   - Mọi truy vấn phiên trong Content Script phải luôn có fallback đọc `localStorage` nếu `chrome.storage.local` gặp độ trễ hoặc lỗi runtime.
   - Content Script bắt buộc phải có listener `chrome.storage.onChanged` và `storage` event để tự động chuyển đổi trạng thái giao diện trong thời gian thực khi có thay đổi từ tab khác.
2. **Hành động đã khắc phục**:
   - Đã cài đặt `AuthService.isAuthenticated()` và `AuthSession.isAuthenticated()`.
   - Đã thêm bộ lắng nghe `chrome.storage.onChanged` và `AuthEvents.on('AUTH_STATE_CHANGED')` tại `src/runtime/content/index.js`.
   - Đã tối ưu hóa việc hủy form login và vẽ lại Input Panel ngay khi có session hợp lệ.

## 4. Checklist phòng ngừa lỗi tái diễn
- Bất kỳ khi nào mở rộng trạng thái Auth/Session, phải kiểm tra khả năng tương thích trên cả 3 môi trường: Options page, Admin portal, và Injected Content Script.
- Chạy `npm run build` và `node scripts/sync-extension.js` để cập nhật cả `dist/` và `extension/`.
