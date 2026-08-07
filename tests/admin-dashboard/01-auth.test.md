# 🔐 AUTH TEST — Admin Dashboard

> **Mục tiêu:** Xác minh luồng đăng nhập, đăng xuất, session hoạt động đúng.
> **File liên quan:** `admin-dashboard/login.html`, `admin-dashboard/master-admin.js`
> **Supabase tables:** `profiles`

---

## Test Data

| Item | Value |
|------|-------|
| Master Admin Email | `admin@vietautofill.com` |
| Master Admin Password | `Admin@123456` |
| Wrong Email | `wrong@test.com` |
| Wrong Password | `WrongPass123` |
| Short Password | `12345` |

---

## B1. ✅ Login thành công với credentials đúng

**Steps:**
1. Mở `admin-dashboard/login.html` trong browser
2. Nhập email: `admin@vietautofill.com`
3. Nhập password: `Admin@123456`
4. Click nút "Đăng nhập"
5. Quan sát redirect

**Expected Result:**
- Sau 1-3 giây, redirect sang `admin.html`
- URL hiển thị: `.../admin-dashboard/admin.html`
- Console không có lỗi đỏ
- Network tab: request `signInWithPassword` thành công (status 200)

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

**Notes:**
- Nếu có lỗi CORS, kiểm tra cấu hình Supabase
- Nếu bị redirect về login, kiểm tra session check trong master-admin.js

---

## B2. ❌ Login với email sai

**Steps:**
1. Mở `admin-dashboard/login.html`
2. Nhập email: `wrong@test.com`
3. Nhập password: `Admin@123456`
4. Click "Đăng nhập"

**Expected Result:**
- Hiển thị thông báo lỗi màu đỏ
- Nội dung lỗi: "Invalid login credentials" hoặc "Email không tồn tại"
- Không redirect
- Vẫn ở lại trang login

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## B3. ❌ Login với password sai

**Steps:**
1. Mở `admin-dashboard/login.html`
2. Nhập email: `admin@vietautofill.com` (email đúng)
3. Nhập password: `WrongPass123`
4. Click "Đăng nhập"

**Expected Result:**
- Hiển thị thông báo lỗi màu đỏ
- Nội dung: "Invalid login credentials" hoặc "Mật khẩu không đúng"
- Không redirect

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## B4. ❌ Validation: Email trống

**Steps:**
1. Mở `admin-dashboard/login.html`
2. Để trống ô email
3. Nhập password bất kỳ
4. Click "Đăng nhập"

**Expected Result:**
- Validation chặn submit
- Hiển thị thông báo: "Vui lòng nhập email"
- Hoặc ô email có viền đỏ + focus

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## B5. ❌ Validation: Password < 6 ký tự

**Steps:**
1. Mở `admin-dashboard/login.html`
2. Nhập email hợp lệ
3. Nhập password: `12345` (5 ký tự)
4. Click "Đăng nhập"

**Expected Result:**
- Validation chặn hoặc Supabase trả về lỗi
- Thông báo: "Mật khẩu phải có ít nhất 6 ký tự"

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## B6. 🔄 Session duy trì sau reload

**Steps:**
1. Login thành công (B1)
2. Mở DevTools → Application → Local Storage
3. Tìm key liên quan đến `supabase.auth.token`
4. Reload trang (Ctrl+R hoặc F5)
5. Quan sát xem có bị redirect về login không

**Expected Result:**
- Sau reload, vẫn ở `admin.html`
- LocalStorage vẫn chứa session token
- Dashboard metrics vẫn load bình thường

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## B7. 🚪 Logout xóa session

**Steps:**
1. Đang ở trạng thái đã login (từ B1)
2. Click nút "Đăng xuất" (nếu có) hoặc chạy lệnh sau trong Console:
   ```javascript
   await supabase.auth.signOut();
   localStorage.clear();
   window.location.href = 'login.html';
   ```
3. Kiểm tra Local Storage

**Expected Result:**
- Session bị xóa khỏi localStorage
- Redirect về `login.html`
- Không thể truy cập `admin.html` khi chưa login (nếu RLS đúng)

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## Bug Report Template

Nếu phát hiện lỗi, điền thông tin sau:

```
### Bug: [Tiêu đề ngắn gọn]

**Mức độ:** Critical / High / Medium / Low
**Test case:** B1-B7
**Steps to reproduce:**
1. ...
2. ...
3. ...

**Expected:** ...
**Actual:** ...
**Console errors:**
[Paste console log]
**Network errors:**
[Paste network response]
**Screenshot:** [Đính kèm nếu cần]