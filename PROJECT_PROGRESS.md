# 📊 BẢNG THEO DÕI & ĐỐI CHIẾU TIẾN ĐỘ DỰ ÁN (PROJECT PROGRESS TRACKER)

> **Tài liệu kiểm soát tiến độ & chất lượng triển khai hệ thống Order Auto Fill.**
> Được cập nhật tự động & đối chiếu liên tục giữa Bạn, Tôi và Codex / AI Coding Agent.

---

## 📈 TỔNG QUAN TIẾN ĐỘ (STATUS DASHBOARD)

| Giai đoạn | Hạng mục công việc | Trạng thái | Tỷ lệ hoàn thành |
| :--- | :--- | :---: | :---: |
| **Phase 0** | **Việt hóa 100% Trang Cài Đặt Shop (Options)** | ✅ **HOÀN THÀNH** | **100%** |
| **Phase 1** | **Phím tắt siêu tốc & Tự động nhận diện hãng** | ✅ **HOÀN THÀNH** | **100%** |
| **Phase 2** | **Cảnh báo trùng đơn & Khách bom hàng (Blacklist)** | ✅ **HOÀN THÀNH** | **100%** |
| **Phase 3** | **Bóc tách hàng loạt & Xuất file Excel chuẩn** | ✅ **HOÀN THÀNH** | **100%** |
| **Phase 4** | **Giao diện Dark Mode & Mini Floating Dock** | ✅ **HOÀN THÀNH** | **100%** |
| **Phase 5** | **Tích hợp Carrier mới (Viettel Post, GHTK)** | ✅ **HOÀN THÀNH** | **100%** |
| **Admin Phase 1** | **Admin Foundation & Fast Operations Hub** | ✅ **HOÀN THÀNH MÃ NGUỒN** | **100%** |
| **Commercial Phase 2** | **Billing, Unit Economics, Device Fingerprint, Remote Selectors** | ✅ **HOÀN THÀNH MÃ NGUỒN** | **100%** |
| **Commercial Phase 3** | **Risk Network, Prepaid Wallet, Reseller, Telegram Ops** | ✅ **HOÀN THÀNH NỀN TẢNG MÃ NGUỒN** | **100%** |

> Cập nhật 02/09/2026: Toàn bộ migrations từ `v66` đến `v93` đã được áp dụng thành công lên Supabase Production. Toàn bộ các Phase tính năng từ Phase 1 đến Phase 5 đã được triển khai hoàn tất, pass 100% unit tests và đã được build đồng bộ vào thư mục `extension/`.
>
> **Xác minh 30/09/2026 (đối chiếu thật với Production qua REST, read-only):**
> - 25/25 table sinh ra bởi migration `v94`→`v131` đều tồn tại & đọc được trên Production ⇒ Production đã áp **tối thiểu tới `v131`** (hàm của `v105`, `v114`, `v118` cũng xác nhận tồn tại).
> - Cả 2 hàm của **`v132`** (đều có `GRANT ... TO anon`) trả về `PGRST202` = không tồn tại ⇒ **`v132` CHƯA ĐƯỢC ÁP lên Production**.
> - Repo hiện có `v1`→`v132` (148 file migration). **Còn nợ: chạy `database/migrations/v132_fix_7_features_production_gaps.sql` lên Production rồi probe lại.**

---

## 📑 CHI TIẾT CÁC GIAI ĐOẠN & CHECKLIST KIỂM SOÁT

---

### ✅ Phase 0: Việt Hóa 100% Trang Cài Đặt Shop (Options)
- [x] **0.1** Việt hóa thanh Menu Sidebar & Topbar điều hướng (`src/ui/options/App.jsx`)
- [x] **0.2** Việt hóa trang Tổng quan & KPI (`src/ui/options/pages/Overview/Overview.jsx`)
- [x] **0.3** Việt hóa cấu hình AI bóc tách & Hạn mức (`src/ui/options/pages/AISettings/AISettings.jsx`)
- [x] **0.4** Việt hóa kết nối bưu cục VNPost / J&T (`src/ui/options/pages/Carriers/Carriers.jsx`)
- [x] **0.5** Việt hóa cài đặt đơn hàng mặc định (`src/ui/options/pages/General/OrderSettings.jsx`)
- [x] **0.6** Việt hóa quản lý nhân viên & Ma trận phân quyền (`src/ui/options/pages/Team/Team.jsx`, `PermissionMatrix.jsx`)
- [x] **0.7** Việt hóa trung tâm đồng bộ Outbox (`src/ui/options/pages/Sync/SyncSettings.jsx`)
- [x] **0.8** Việt hóa thông báo & cảnh báo hệ thống (`src/ui/options/pages/Notifications/Notifications.jsx`)
- [x] **0.9** Việt hóa bảo mật & quản lý thiết bị (`src/ui/options/pages/Security/Security.jsx`, `DeviceManagement.jsx`)
- [x] **0.10** Việt hóa nhật ký hoạt động Audit Logs (`src/ui/options/pages/Audit/AuditLogs.jsx`)
- [x] **0.11** Việt hóa gói cước & nâng cấp VietQR (`src/ui/options/pages/Subscription/Subscription.jsx`)
- [x] **0.12** Việt hóa quản lý bộ nhớ & dọn cache (`src/ui/options/pages/Database/DatabaseManager.jsx`)
- [x] **0.13** Chạy và pass 100% bộ kiểm thử tự động (`npm test`)

---

### ✅ Phase 1: Phím Tắt Siêu Tốc & Tự Nhận Diện Hãng (Shortcuts & Auto-detect)
- **Mục tiêu**: Bấm `Ctrl + Shift + V` dán & bóc tách tức thì, `Esc` thu nhỏ panel; tự phát hiện trang VNPost/J&T.
- **Tệp liên quan**: `src/runtime/content/index.js`, `src/runtime/content/carrier-runtime.js`, `manifest.json`.
- **Checklist thực hiện**:
  - [x] **1.1** Khai báo quyền `clipboardRead` (nếu cần) trong `manifest.json`.
  - [x] **1.2** Bắt sự kiện bàn phím `Ctrl + Shift + V` / `Cmd + Shift + V` toàn cục trên trang web hãng.
  - [x] **1.3** Gọi `navigator.clipboard.readText()` với cơ chế xử lý lỗi an toàn (try/catch).
  - [x] **1.4** Tự động mở panel và kích hoạt luồng bóc tách dữ liệu AI (`handleParse`).
  - [x] **1.5** Bắt phím `Escape` để thu nhỏ hoặc đóng nhanh Floating Panel.
  - [x] **1.6** Tự nhận diện URL (`donhang.vnpost.vn`, `my.vnpost.vn`, `jtexpress.vn`, `viettelpost.vn`, `ghtk.vn`).
  - [x] **1.7** Kiểm tra `npm test` không bị lỗi hồi quy.

---

### ✅ Phase 2: Cảnh Báo Trùng Đơn & Khách Bom Hàng (Anti-Duplicate & Blacklist)
- **Mục tiêu**: Cảnh báo tức thì nếu SĐT khách hàng đã có đơn trong 24h hoặc nằm trong danh sách đen.
- **Tệp liên quan**: `src/domain/order/order.validator.js`, `frontend/panel/panel.js`, `src/ui/options/pages/General/OrderSettings.jsx`.
- **Checklist thực hiện**:
  - [x] **2.1** Tạo module chuẩn hóa & đối soát SĐT `order.validator.js`.
  - [x] **2.2** Triển khai hàm `checkDuplicatePhone(phone)` kiểm tra đơn trong vòng 24h qua storage.
  - [x] **2.3** Triển khai hàm `checkBlacklist(phone)` đối soát danh sách đen của Shop.
  - [x] **2.4** Thêm banner cảnh báo màu vàng (Trùng đơn) trên Floating Panel.
  - [x] **2.5** Thêm banner cảnh báo màu đỏ (Blacklist / Bom hàng) trên Floating Panel.
  - [x] **2.6** Thêm giao diện quản lý danh sách SĐT Blacklist trong trang Cài đặt đơn hàng.
  - [x] **2.7** Viết Unit Test kiểm tra logic đối soát SĐT và chạy `npm test`.

---

### ✅ Phase 3: Bóc Tách Hàng Loạt & Xuất File Excel Chuẩn (Bulk Parsing & Excel Exporter)
- **Mục tiêu**: Dán 5–20 đơn hàng cùng lúc, AI bóc tách vào bảng và xuất file Excel chuẩn nạp bưu cục.
- **Tệp liên quan**: `src/domain/parser/bulk-parser.service.js`, `src/ui/options/pages/Workspace/Bulk.jsx`, `src/ui/options/pages/Orders/SubmittedOrders.jsx`.
- **Checklist thực hiện**:
  - [x] **3.1** Xây dựng thuật toán phân tách đoạn văn bản dài thành các chunk đơn hàng `splitRawTextToChunks`.
  - [x] **3.2** Xây dựng service bóc tách tuần tự có báo cáo tiến độ `parseBulkOrders`.
  - [x] **3.3** Thiết kế giao diện Modal xem trước kết quả bảng lưới (STT, Tên, SĐT, Địa chỉ, COD, Hàng hóa).
  - [x] **3.4** Cho phép chỉnh sửa trực tiếp từng ô dữ liệu trên bảng lưới trước khi xuất.
  - [x] **3.5** Tạo module xuất file CSV/Excel UTF-8 (BOM `\uFEFF`) chuẩn format template VNPost & J&T.
  - [x] **3.6** Thêm nút xuất file Excel lịch sử các đơn đã gửi trong trang Quản lý đơn.
  - [x] **3.7** Kiểm tra `npm test`.

---

### ✅ Phase 4: Giao Diện Dark/Light & Mini Floating Dock (Dark Mode & Widget)
- **Mục tiêu**: Hỗ trợ chế độ nền tối và thu nhỏ panel thành bubble tròn gọn gàng cạnh màn hình.
- **Tệp liên quan**: `frontend/panel/styling/styles.js`, `frontend/panel/panel.js`, `src/ui/panel/App.jsx`.
- **Checklist thực hiện**:
  - [x] **4.1** Bổ sung CSS variables cho 2 theme `--bg-primary`, `--text-primary`, `--border-color`.
  - [x] **4.2** Thêm nút chuyển đổi Dark / Light mode và lưu trạng thái vào `chrome.storage.local`.
  - [x] **4.3** Thêm nút thu nhỏ `_` trên thanh tiêu đề của Floating Panel.
  - [x] **4.4** Tạo giao diện Mini Bubble/Dock tròn (48x48px) hiển thị huy hiệu số đơn nháp.
  - [x] **4.5** Hỗ trợ kéo thả (drag & drop) Mini Dock dọc theo mép màn hình và nhớ vị trí.
  - [x] **4.6** Click vào Mini Dock để phóng to lại Panel nguyên bản.
  - [x] **4.7** Kiểm tra `npm test`.

---

### ✅ Phase 5: Mở Rộng Hãng Vận Chuyển Mới (Viettel Post & GHTK)
- **Mục tiêu**: Hỗ trợ tự động điền form trên web Viettel Post và Giao Hàng Tiết Kiệm.
- **Tệp liên quan**: `src/domain/carrier/viettelpost/*`, `src/domain/carrier/ghtk/*`, `src/runtime/content/carrier-runtime.js`, `manifest.json`.
- **Checklist thực hiện**:
  - [x] **5.1** Cập nhật `manifest.json` thêm match patterns cho Viettel Post và GHTK.
  - [x] **5.2** Khảo sát DOM và tạo bộ selector cho Viettel Post (`viettelpost/selectors.js`).
  - [x] **5.3** Triển khai hàm điền form & autocomplete địa chỉ Viettel Post (`viettelpost/autofill.js`).
  - [x] **5.4** Khảo sát DOM và tạo bộ selector cho GHTK (`ghtk/selectors.js`).
  - [x] **5.5** Triển khai hàm điền form & autocomplete địa chỉ GHTK (`ghtk/autofill.js`).
  - [x] **5.6** Đăng ký 2 Adapter mới vào `src/runtime/content/carrier-runtime.js`.
  - [x] **5.7** Kiểm tra tương thích và chạy toàn bộ test suite `npm test`.

---

## 📝 NHẬT KÝ HOẠT ĐỘNG & NGHIỆM THU (CHANGELOG)

### 28/08/2026 — Admin Phase 1: Foundation & Fast Operations Hub

- [x] Component dùng chung: phân trang 10/25/50/100, filter debounce 300 ms, CSV UTF-8 BOM, Fast Operations Hub.
- [x] Header/sidebar và route Release Center; banner giả lập Shop có thể thoát.
- [x] Tạo Shop + chủ Shop, tạo tài khoản Admin/RBAC, cấp quota +500/+1000/+2000, chuyển chủ sở hữu.
- [x] Quản lý subscription: đổi gói, gia hạn +1/+3/+12 tháng và cảnh báo hết hạn.
- [x] Top 10 Shop sử dụng AI, màu cảnh báo quota và cấp quota hàng loạt.
- [x] Carrier live probe + lưu lịch sử; lọc thiết bị theo Shop + thu hồi toàn bộ.
- [x] Audit log thật với lọc actor/action và xuất CSV.
- [x] Ticket detail/reply/internal note; publish release version/min/force/rollout/notes.
- [x] RPC ghi nhạy cảm kiểm tra `SYSTEM_ADMIN`, transaction/audit; test hồi quy và production build đạt.
- [ ] Vận hành: áp dụng migration `database/migrations/v66_admin_fast_operations.sql` lên Supabase và smoke-test bằng tài khoản SYSTEM_ADMIN thật.

### 28/08/2026 — Commercial Phase 2 Foundation

- [x] Loại bỏ webhook secret mặc định và token trên query string; webhook fail-closed nếu thiếu cấu hình.
- [x] No-touch VietQR/SePay tiếp tục sử dụng RPC idempotent `process_vietqr_payment`.
- [x] Unit Economics: MRR, AI token/request, chi phí AI ước tính và gross margin trên Overview.
- [x] Device fingerprint SHA-256, giới hạn thiết bị theo subscription và kill-switch với trạng thái revoked/blocked/unapproved.
- [x] Remote Dynamic Selectors: version hóa theo hãng, phát hành có audit, payload allow-list, cache fallback trong Extension.
- [x] Test hợp đồng Phase 2, toàn bộ `npm test` và production build đạt.
- [ ] Vận hành: áp dụng `v67_commercial_phase2_foundation.sql`, cấu hình Edge Function secrets và deploy `payment-webhook`.

### 28/08/2026 — Commercial Phase 3 Growth Foundation

- [x] Mạng lưới cảnh báo bom hàng dùng SHA-256 phone hash, không chia sẻ số điện thoại thô và chỉ trả kết luận khi đủ từ 2 Shop.
- [x] Customer Hub có tra cứu rủi ro liên Shop theo số điện thoại đang tìm kiếm.
- [x] Ví trả trước và immutable ledger; credit/debit có reference idempotency và kiểm tra số dư nguyên tử.
- [x] Reseller accounts, commission rate và chỉ số tăng trưởng trên Admin Overview.
- [x] Telegram Operations outbox, retry/failure tracking và Edge Function fail-closed khi thiếu secret.
- [x] Admin có nạp ví Shop, tạo đại lý và theo dõi wallet/risk/Telegram metrics.
- [ ] Vận hành: áp dụng `v68_commercial_phase3_growth.sql`; cấu hình/deploy `telegram-ops` và scheduler đáng tin cậy.

| Thời gian | Người thực hiện | Hạng mục đã thực hiện | Kết quả kiểm thử |
| :--- | :--- | :--- | :---: |
| **2026-08-26** | **Antigravity AI** | Hoàn thành 100% Việt hóa toàn bộ 13 màn hình trang Cài Đặt Shop (Options) | **45/45 tests PASS** ✅ |
| **2026-08-26** | **Antigravity AI** | Xây dựng kế hoạch Promptable Cards cho Codex (`implementation_plan.md`) | Đã sẵn sàng |
| **2026-08-26** | **Antigravity AI** | Khởi tạo bảng kiểm soát & đối chiếu tiến độ (`PROJECT_PROGRESS.md`) | Đã sẵn sàng |
