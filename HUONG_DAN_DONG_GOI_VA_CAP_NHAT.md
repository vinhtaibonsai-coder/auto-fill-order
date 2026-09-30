# 📘 HƯỚNG DẪN VẬN HÀNH: ĐÓNG GÓI THƯƠNG MẠI & CẬP NHẬT TỪ XA (OTA)

> **Tài liệu lưu trữ nội bộ dành cho Quản trị viên / Nhà phát triển.**  
> Giúp bạn dễ dàng tra cứu quy trình đóng gói phần mềm thành phẩm, phân phối cho khách hàng và đẩy các bản cập nhật / vá lỗi từ xa mà không sợ làm gián đoạn người dùng.

---

## 🧭 1. Sơ Đồ Quy Trình Vận Hành Tổng Thể

```
+-----------------------------------------------------------------------------------+
|  1. MÁY CỦA BẠN (DEVELOPMENT & SỬA LỖI)                                           |
|  - Sửa lỗi, nâng cấp tính năng, chỉnh giao diện, kiểm thử code mới.               |
|  - Khách hàng KHÔNG bị ảnh hưởng bởi những gì bạn đang gõ trên máy.               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v (Chạy lệnh 1-Click)
+-----------------------------------------------------------------------------------+
|  2. ĐÓNG GÓI TỰ ĐỘNG: npm run release:pack -- --bump=patch                        |
|  - Chạy 46+ bài test tự động (bảo vệ RLS, chống trùng lặp, chống đè đơn).         |
|  - Biên dịch Production Bundle sạch sẽ, dọn file rác OS.                          |
|  - Tạo file ZIP thành phẩm tại: dist-release/AutoFillOrder-v1.0.x.zip              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v (Upload ZIP lên Cloud / Drive)
+-----------------------------------------------------------------------------------+
|  3. CỔNG QUẢN TRỊ MASTER ADMIN (/admin.html -> Release Center)                    |
|  - Điền số Version mới + Link tải ZIP + Ghi chú lỗi đã sửa.                       |
|  - Chọn "Cập nhật thường" (gợi ý) HOẶC "Bắt buộc cập nhật" (khóa bản lỗi cũ).      |
|  - Bấm [Phát Hành Phiên Bản].                                                     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v (Tự động thông báo qua Cloud Supabase)
+-----------------------------------------------------------------------------------+
|  4. MÁY KHÁCH HÀNG / NHÂN VIÊN (CLIENT EXTENSIONS)                                |
|  - Service Worker định kỳ 30 phút tự động check phiên bản mới.                    |
|  - Tự động hiện Banner cập nhật trên Panel VNPost / J&T & Trang Options.          |
|  - Khách bấm nút [🚀 Tải Bản Cập Nhật] để lấy bản mới nhất về cài đặt.            |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 2. Các Lệnh Đóng Gói 1-Click (Command Line)

Khi bạn đã sửa xong lỗi hoặc hoàn thành tính năng mới và muốn xuất bản một file `.zip` hoàn chỉnh:

Mở cửa sổ dòng lệnh (Terminal) tại thư mục dự án và chạy một trong các lệnh sau:

### 🔹 Lệnh thông dụng nhất (Vá lỗi / Sửa Bug):
```bash
npm run release:pack -- --bump=patch
```
* **Ý nghĩa:** Tự động tăng số bản vá lỗi nhỏ (Ví dụ: `1.0.0` $\rightarrow$ `1.0.1`, `1.0.1` $\rightarrow$ `1.0.2`).
* Thích hợp dùng khi sửa các lỗi như: sai địa chỉ, nhầm COD, lỗi giao diện, tối ưu tốc độ...

---

### 🔹 Lệnh khi thêm tính năng mới:
```bash
npm run release:pack -- --bump=minor
```
* **Ý nghĩa:** Tăng số phiên bản tính năng (Ví dụ: `1.0.0` $\rightarrow$ `1.1.0`).
* Thích hợp dùng khi thêm tính năng lớn: hỗ trợ thêm hãng vận chuyển mới, thêm báo cáo mới...

---

### 🔹 Lệnh khi nâng cấp cấu trúc đột phá (Đại tu phần mềm):
```bash
npm run release:pack -- --bump=major
```
* **Ý nghĩa:** Tăng số phiên bản chính (Ví dụ: `1.0.0` $\rightarrow$ `2.0.0`).

---

### 🔹 Lệnh đóng gói giữ nguyên phiên bản:
```bash
npm run release:pack
```
* Đóng gói lại file ZIP với số phiên bản hiện tại mà không tăng số.

---

### ⚙️ Script đóng gói sẽ tự động làm gì cho bạn?
1. **Kiểm tra chất lượng (Auto Test Guard):** Tự động chạy toàn bộ 46+ bộ test tự động. Nếu phát hiện code bị lỗi logic, script sẽ **lập tức dừng lại** để ngăn bạn gửi bản lỗi cho khách.
2. **Đồng bộ hóa Version:** Tự động cập nhật số phiên bản vào cả `manifest.json` và `package.json`.
3. **Biên dịch Production (`npm run build`):** Tối ưu hóa dung lượng, loại bỏ mã thừa, đồng bộ sang thư mục `extension/`.
4. **Dọn rác hệ điều hành:** Loại bỏ triệt để các file ngầm như `desktop.ini`, `thumbs.db`, `.DS_Store`.
5. **Nén file ZIP:** Tạo file `dist-release/AutoFillOrder-v{version}.zip` (dung lượng tối ưu chỉ khoảng **2.1 MB**) kèm mã kiểm tra an toàn SHA-256.

---

## 🌐 3. Cách Đưa Bản Cập Nhật Lên Hệ Thống (Master Admin)

Sau khi có file ZIP trong thư mục `dist-release/`:

### Bước 1: Tải file ZIP lên nơi lưu trữ công khai
Bạn có thể upload file `dist-release/AutoFillOrder-v{version}.zip` lên một trong các nguồn:
- **Google Drive:** Đặt quyền chia sẻ *"Bất kỳ ai có đường liên kết đều có thể xem/tải"*.
- **Supabase Storage:** Upload vào bucket công khai của bạn.
- **Website hoặc Hosting riêng.**

> 💡 **Mẹo lấy link tải trực tiếp Google Drive:**  
> Nếu link chia sẻ là: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`  
> Link tải trực tiếp sẽ là: `https://drive.google.com/uc?export=download&id=FILE_ID`

---

### Bước 2: Đăng bản cập nhật trên Cổng Quản Trị
1. Truy cập vào Cổng Quản Trị Master Admin: `admin.html` (hoặc domain web bạn đã deploy).
2. Chọn mục **Trung Tâm Phát Hành** (Release Center) trên thanh menu bên trái.
3. Bấm nút **[+ Phát Hành Phiên Bản Mới]**.
4. Điền các thông tin trong cửa sổ hiện ra:
   - **Phiên bản mới (Target Version):** Điền số phiên bản vừa đóng gói (Ví dụ: `1.0.1`).
   - **Phiên bản tối thiểu hỗ trợ (Min Supported Version):**
     - *Nếu là bản cập nhật bình thường:* Điền phiên bản cũ nhất mà bạn vẫn cho phép dùng (Ví dụ: `1.0.0`).
     - *Nếu là bản vá lỗi nghiêm trọng (muốn cấm tiệt bản cũ):* Điền bằng chính số bản mới (Ví dụ: `1.0.1`).
   - **Đường dẫn tải file ZIP (Download URL):** Dán link bạn đã lấy ở Bước 1.
   - **Bắt buộc cập nhật ngay (Force Update):**
     - ⬜ **Không tích:** Khách hàng vẫn dùng được bản cũ bình thường, trên màn hình chỉ hiện thông báo gợi ý có bản mới.
     - 🟩 **Tích chọn:** Khách hàng mở lên sẽ bị khóa các nút chức năng cũ và hiện thông báo đỏ bắt buộc bấm tải bản mới để tiếp tục sử dụng.
   - **Ghi chú phát hành (Release Notes):** Ghi tóm tắt những gì bạn đã sửa (Ví dụ: *"Sửa triệt để lỗi nhảy tiền COD từ ô trọng lượng, tối ưu hóa nhận diện địa chỉ"*).
5. Bấm nút **[Phát Hành Phiên Bản]**.

$\implies$ **Ngay lập tức, thông tin sẽ được lưu lên Cloud Supabase!**

---

## 💻 4. Trải Nghiệm Của Khách Hàng (Tự Động Nhận Bản Mới)

Khách hàng không cần phải tự đi tìm bản cập nhật:
1. **Kiểm tra tự động ngầm:** Service Worker của tiện ích trên trình duyệt của khách sẽ tự động kiểm tra mỗi 30 phút hoặc ngay khi khách mở trình duyệt.
2. **Thông báo trực quan:**
   - **Trên Panel tạo đơn (VNPost & J&T):** Xuất hiện thông báo bản mới kèm link tải.
   - **Trong Trang Cài Đặt (Options):** Xuất hiện banner nổi bật:
     > 🚀 **Đã có bản cập nhật mới (v1.0.1)**  
     > *Nội dung: Sửa triệt để lỗi nhảy tiền COD, tối ưu nhận diện địa chỉ.*  
     > `[Tải Bản Cập Nhật]`
3. **Thao tác của khách hàng để lên bản mới:**
   - Khách chỉ cần bấm nút **[Tải Bản Cập Nhật]** $\rightarrow$ File ZIP mới sẽ được tải về máy.
   - Giải nén file ZIP đè vào thư mục cũ.
   - Vào `chrome://extensions` bấm nút **Xoay tròn (Reload)** là hoàn tất trong 10 giây!

---

## 📋 5. Bảng Tra Cứu Nhanh (Cheat Sheet)

| Trường Hợp | Lệnh Cần Chạy | Hành Động Tại Admin |
| :--- | :--- | :--- |
| **Sửa lỗi nhỏ / Fix bug** | `npm run release:pack -- --bump=patch` | Tạo release mới, nhập link ZIP, có thể bật hoặc không bật Force Update |
| **Bản vá lỗi nghiêm trọng (P0)** | `npm run release:pack -- --bump=patch` | Bật **Bắt buộc cập nhật ngay** & đặt **Min Supported Version** bằng bản mới |
| **Thêm tính năng lớn** | `npm run release:pack -- --bump=minor` | Tạo release mới, giới thiệu tính năng mới trong Ghi chú phát hành |
| **Kiểm tra lỗi trước khi build** | `npm test` | Kiểm tra xem code hiện tại có vượt qua 46+ bộ test không |
| **Xem file thành phẩm** | Thư mục `dist-release/` | Chứa toàn bộ các file `.zip` qua các đợt phát hành |

---

## 🛠️ 6. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### Q1: Chạy lệnh đóng gói báo lỗi test fail thì sao?
- **Giải thích:** Hệ thống có cơ chế tự bảo vệ. Nếu một tính năng cũ bị hỏng trong quá trình bạn sửa code, script sẽ không cho đóng gói để tránh đưa sản phẩm lỗi cho khách.
- **Cách xử lý:** Đọc thông báo lỗi trên màn hình terminal để biết test nào đang fail, sửa lại cho đúng rồi chạy lại lệnh `npm run release:pack`.

### Q2: Khách hàng báo chưa thấy hiện thông báo cập nhật?
- Tiện ích kiểm tra định kỳ mỗi 30 phút. Khách có thể chủ động kiểm tra ngay bằng cách:
  - Mở trang Cài Đặt (Options) của tiện ích.
  - Hoặc tắt trình duyệt Chrome mở lại.

### Q3: Muốn thu hồi hoặc sửa lại đường link tải ZIP?
- Đơn giản chỉ cần vào lại **Master Admin $\rightarrow$ Release Center**, phát hành một bản cập nhật mới (ví dụ patch tiếp theo) với link tải mới chính xác.

### Q4: Cách cài đặt hoặc giải nén chuẩn nhất trên máy khách?
- **Cách 1 (Khuyên dùng cho mọi máy):**
  1. Giải nén file `.zip` ra một thư mục cố định (ví dụ: `D:\PhanMem\AutoFillOrder` hoặc `C:\AutoFillOrder`).
  2. Mở trình duyệt Chrome/CentBrowser/Cốc Cốc $\rightarrow$ Truy cập `chrome://extensions`.
  3. Bật công tắc **Chế độ cho nhà phát triển (Developer mode)** ở góc trên bên phải.
  4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)** $\rightarrow$ Chọn thư mục vừa giải nén.
- **Cách 2 (Kéo thả file ZIP trên CentBrowser):**
  - Bản đóng gói mới đã được chuẩn hóa 100% đường dẫn theo tiêu chuẩn quốc tế POSIX `/` (loại bỏ hoàn toàn lỗi backslash `\` của Windows). Khi kéo thả file `.zip` vào `chrome://extensions`, trình duyệt sẽ giải nén đúng cấu trúc thư mục mà không còn bị báo lỗi thiếu background script.

---
*Tài liệu được lưu trữ tại `HUONG_DAN_DONG_GOI_VA_CAP_NHAT.md` trong thư mục gốc của dự án.*
