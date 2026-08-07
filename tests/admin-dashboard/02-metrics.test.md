# 📊 METRICS TEST — Admin Dashboard

> **Mục tiêu:** Xác minh các số liệu thống kê dashboard hiển thị chính xác.
> **File liên quan:** `admin-dashboard/admin.html`, `admin-dashboard/master-admin.js`
> **Supabase tables:** `shops`, `profiles`, `orders` (nếu có)

---

## Test Data

| Item | Value |
|------|-------|
| Master Admin Email | `admin@vietautofill.com` |
| Master Admin Password | `Admin@123456` |

---

## C1. 📈 Tổng số Shop hiển thị đúng

**Steps:**
1. Login master admin thành công (xem B1)
2. Quan sát metric "Tổng số Shop" trên dashboard
3. Mở DevTools Console và chạy:
   ```javascript
   const { count } = await supabase.from('shops').select('*', { count: 'exact', head: true });
   console.log('Total shops:', count);
   ```
4. So sánh với số hiển thị trên UI

**Expected Result:**
- UI metric = count từ DB
- Không có lỗi trong Network tab

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## C2. 👤 Tổng số User hiển thị đúng

**Steps:**
1. Login master admin
2. Quan sát metric "Tổng số User"
3. Chạy trong Console:
   ```javascript
   const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
   console.log('Total users:', count);
   ```

**Expected Result:**
- UI metric = count từ DB (bao gồm cả master admin và các user khác)

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## C3. 📦 Tổng số Orders hiển thị đúng

**Steps:**
1. Login master admin
2. Quan sát metric "Tổng số Orders"
3. Chạy trong Console:
   ```javascript
   const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
   console.log('Total orders:', count);
   ```

**Expected Result:**
- UI metric = count từ DB (hoặc hiển thị 0 nếu chưa có dữ liệu)

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## C4. 🟢 Số Shop Active hiển thị đúng

**Steps:**
1. Login master admin
2. Quan sát metric "Shop Active"
3. Chạy trong Console:
   ```javascript
   const { count } = await supabase
     .from('shops')
     .select('*', { count: 'exact', head: true })
     .eq('status', 'active');
   console.log('Active shops:', count);
   ```

**Expected Result:**
- UI metric = count từ DB

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## C5. 🔄 Loading spinner hiển thị khi đang tải

**Steps:**
1. Mở `admin.html` với Network throttling (Slow 3G)
2. Hoặc xóa cache và hard reload (Ctrl+Shift+R)
3. Quan sát trong 1-2 giây đầu

**Expected Result:**
- Có loading spinner hoặc skeleton screen
- Spinner biến mất khi dữ liệu load xong

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## C6. ❌ Xử lý lỗi khi mất kết nối Supabase

**Steps:**
1. Login master admin
2. Mở DevTools → Network tab → Chọn "Offline"
3. Refresh page (F5)
4. Quan sát UI

**Expected Result:**
- Hiển thị thông báo lỗi (không phải crash trang)
- Có nút "Thử lại" hoặc tự động retry
- Console có log lỗi rõ ràng

**Actual Result:** [Điền sau khi test]

**Status:** ⬜ Chưa test | ✅ Pass | ❌ Fail

---

## Bug Report Template

```
### Bug: [Tiêu đề ngắn gọn]

**Mức độ:** Critical / High / Medium / Low
**Test case:** C1-C6
**Steps to reproduce:**
1. ...
2. ...
3. ...

**Expected:** ...
**Actual:** ...
**Console errors:** [Paste log]
**Screenshot:** [Đính kèm]