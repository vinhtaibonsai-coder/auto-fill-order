# UI INVENTORY
## Current UI & JS Audit — VNPost & J&T Order Automation Platform

**Status:** AUDITED (Deep JS/CSS level)

> Tài liệu này dùng để kiểm kê giao diện hiện tại trước khi redesign, bao gồm việc map chính xác các file JS và CSS đang xử lý logic để tránh lỗi script.

---

# 1. Mục tiêu

Xác định:
- Page hiện có
- Function và các script JS liên quan
- Logic bị trùng lặp ở mức độ source code
- File JS/CSS cần Remove / Merge
- Tránh lỗi null khi xóa DOM mà quên xóa JS.

---

# 2. Pages hiện có

| ID | File/Page | Portal | JS Entry Point | Status | Ghi chú |
|---|---|---|---|---|---|
| UI-001 | admin-dashboard/login.html | Auth | _inline/auth.service_ | KEEP | |
| UI-002 | admin-dashboard/index.html | Shop Portal | pp.js, shops.js | REVIEW | JS của page này vẫn đang chứa logic gọi Master Admin. Cần gỡ bỏ shops.js. |
| UI-003 | admin-dashboard/admin.html | Admin Portal | master-admin.js | REVIEW | Đây là nơi chứa logic Admin thực sự. |
| UI-004 | frontend/options/options.html | Extension Options | Hàng loạt options-*.js | REVIEW | Đang nhúng tới 10 file JS thừa thãi. |
| UI-005 | frontend/panel/panel.js | Extension Panel | panel.js, styles.js | KEEP | Luồng làm việc chuẩn. |

---

# 3. Function & JS Inventory (Thực trạng rác)

Mỗi function được map với file JS thực tế đang xử lý:

| ID | Function | Tồn tại ở HTML | JS Script đang xử lý | Quyết định (JS Level) |
|---|---|---|---|---|
| F-001 | Metrics / Analytics | admin, index, options | master-admin.js, app.js, options-analytics.js | REMOVE options-analytics.js khỏi options.html. |
| F-002 | Shop CRUD | admin, index, options | master-admin.js, shops.js, options-shops.js | REMOVE shops.js (index) và options-shops.js (options). Chỉ giữ trong master-admin.js. |
| F-003 | User / Roles | admin, index | master-admin.js, app.js | REMOVE đoạn logic User/Role trong app.js. |
| F-004 | Device Management | admin, options | master-admin.js, options-account.js | MERGE/KEEP (Options xem cá nhân, Admin xem toàn bộ). |
| F-005 | Quota & System | admin | master-admin.js | KEEP |
| F-006 | AI Config | admin | master-admin.js | KEEP |
| F-007 | Audit Logs | admin, index | master-admin.js, app.js | REMOVE logic Audit Logs khỏi app.js. |
| F-008 | Order Management | index, options | app.js, options-orders.js, options-submitted.js | REMOVE toàn bộ options-orders.js, options-submitted.js khỏi options.html. Giữ app.js. |
| F-009 | Bulk & Drafts | index, options | app.js, options-bulk.js | REMOVE options-bulk.js khỏi options.html. |
| F-010 | Customer Management | index, options | app.js, options-customers.js | REMOVE options-customers.js khỏi options.html. |
| F-011 | Extension Settings | options | options-config.js, options-address.js | KEEP trên options.html. |

---

# 4. Action Vocabulary

`	ext
KEEP: Giữ nguyên logic JS/CSS
MOVE: Chuyển script sang portal khác
MERGE: Gộp logic JS
REMOVE: Xóa hoàn toàn file JS hoặc xóa việc import file đó
`

---

# 5. Phân tích chi tiết lỗi JS/CSS hiện tại

## 5.1 admin-dashboard/index.html (Shop Portal)

- Thực trạng: File HTML đã được dọn dẹp. Tuy nhiên, index.html vẫn đang import shops.js (dòng 1117) và app.js (chứa vô số event listeners trỏ vào các DOM đã bị xóa).
- Nguy cơ: Lỗi TypeError: Cannot read properties of null (reading 'addEventListener') sẽ xảy ra liên tục khiến app chết hoặc rò rỉ bộ nhớ.
- Giải pháp: Xóa thẻ script src shops.js, sửa lại app.js để loại bỏ các logic liên quan đến Admin.

## 5.2 frontend/options/options.html (Extension Settings)

- Thực trạng: HTML đã được tôi dọn dẹp các tab. Nhưng dòng 1326-1333 vẫn import: options-shops.js, options-orders.js, options-history.js, options-analytics.js, options-customers.js, options-bulk.js, options-submitted.js.
- Nguy cơ: Các script này chạy khi load Options, cố truy cập DOM đã bị xóa, văng lỗi JS toàn tập. Dẫn đến Settings chính có thể không lưu được do JS crash trước đó.
- Giải pháp: Xóa hoàn toàn các thẻ script này khỏi options.html. Xóa các file .js này khỏi source tree luôn để giảm dung lượng Extension.

## 5.3 Css

- Cả admin.html và options.html hiện đang dùng chung frontend/options/options.css (dung lượng 45KB).
- index.html lại dùng Tailwind nhúng CDN.
- Cần có chiến lược quy hoạch lại Styling (như dùng chung 1 Tailwind config hoặc 1 file style chung) trước khi đập đi xây lại giao diện Pro Max.

---

# 6. Final Decision (Chuẩn bị cho Design System)

Trước khi ốp Giao diện Glassmorphism Dark Mode, cần thực hiện bước DỌN DẸP SCRIPT:
1. Xóa các script tag vô dụng khỏi index.html và options.html.
2. Delete cứng các file JS thừa (options-orders.js, v.v.) khỏi ổ đĩa.
3. Chỉnh app.js để chặn crash khi thiếu DOM.
4. Chỉ sau khi dọn xong logic JS, mới tiến hành thay đổi UI.
