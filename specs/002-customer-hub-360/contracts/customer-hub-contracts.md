# Customer Hub Contracts

## Customer Summary Lookup

**Input**: active shop, normalized phone.  
**Output**: customer id, masked/full phone theo quyền, name, segment, risk level, order counts, LTV, blacklist reason được phép xem, tối đa 3 địa chỉ gần nhất.  
**Failure contract**: timeout/not found trả trạng thái suy giảm; không làm parser hoặc autofill thất bại.

## Backfill Job

**Start**: chỉ Owner/Manager; nhận source và batch size hợp lệ.  
**Progress**: job id, status, processed/total, success/error, cursor.  
**Idempotency**: chạy lại cùng nguồn không tạo duplicate link hoặc tăng metrics trùng.  
**Cancel/Retry**: tiếp tục từ cursor an toàn.

## Customer Mutation

- Notes/tags: thành viên cùng shop theo permission.
- Blacklist: Owner/Manager, reason bắt buộc.
- Export: Owner hoặc permission riêng; audit bắt buộc.
- Mọi mutation phải xác thực customer thuộc active shop.

## Address Suggestion

Extension hiển thị địa chỉ lịch sử cùng lần dùng/tỷ lệ thành công. Việc áp dụng cần click xác nhận; không có contract nào cho phép tự ghi đè địa chỉ parser hiện tại.

## Import File

Luồng `upload → map columns → preview → validate → commit`. Dòng lỗi không chặn dòng hợp lệ; báo cáo lỗi phải cho phép tải xuống. Commit tạo customer/order links theo khóa idempotent.
