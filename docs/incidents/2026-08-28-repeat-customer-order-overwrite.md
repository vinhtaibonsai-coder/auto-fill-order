# Incident: Khách mua lại làm ghi đè đơn cũ

Ngày phát hiện: 2026-08-28  
Phạm vi: đơn nháp, đơn đã gửi, lịch sử bóc tách và cập nhật mã vận đơn.

## Triệu chứng

Một khách hàng mua lại với cùng tên, số điện thoại và có thể cùng COD, nhưng mã đơn mới khác mã đơn cũ. Hệ thống cập nhật dữ liệu mới vào đơn cũ thay vì tạo một đơn mới.

## Nguyên nhân gốc

Logic chống trùng trong `OrderStorage.saveOrder()` và `OrderStorage.saveSubmittedOrder()` dùng thuộc tính khách hàng (`name + phone`, đôi lúc thêm COD) làm khóa nhận diện đơn. Khi tìm thấy dòng này, code chủ động giữ `id` cũ và merge dữ liệu mới. `SplitHistory.add()` có cùng kiểu lỗi. Trình lấy vận đơn nền còn chấp nhận khớp chỉ theo SĐT **hoặc** tên nên có thể gắn vận đơn của lần mua mới vào đơn trước.

## Quy tắc bất biến

1. Khách hàng và đơn hàng là hai thực thể khác nhau. SĐT/tên chỉ dùng liên kết Customer 360, không bao giờ là unique key của đơn.
2. Thứ tự định danh đơn: `tracking_code` → `saved_order_id` → `shop_id + order_code` → `id`.
3. Nếu cả hai bản ghi đều có `order_code` và mã khác nhau, chúng **bắt buộc** là hai đơn khác nhau, kể cả mọi dữ liệu khách hàng/COD giống hệt.
4. Không có mã đơn/mã vận đơn thì ưu tiên tạo bản ghi mới; duplicate dễ sửa hơn mất lịch sử do overwrite.
5. Cập nhật mã vận đơn phải nhắm bằng ID/mã đơn. Nếu có mã đơn, không được fallback sang SĐT hoặc tên.
6. Upsert phải có constraint đúng với identity của đơn; không dùng constraint khách hàng cho bảng đơn hàng.

## Regression test

Chạy:

```bash
npm run test:repeat-order
```

Test bắt buộc chứng minh:

- cùng khách + khác mã đơn → hai đơn;
- cùng mã đơn → idempotent;
- cùng mã vận đơn → cùng shipment;
- lịch sử bóc tách không gộp hai mã đơn khác nhau.

## Checklist khi sửa đồng bộ/dedup lần sau

- Viết bảng truth table cho identity trước khi code.
- Có test “repeat customer, different order code” chạy đỏ trước fix.
- Kiểm tra cả local storage, Supabase upsert, Customer Hub và background waybill matcher.
- Không thêm fallback `name + phone` vào bất kỳ hàm dedup đơn hàng nào.

