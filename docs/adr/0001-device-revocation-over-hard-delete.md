# ADR-0001: Thu hồi thiết bị trước khi xoá vật lý

## Trạng thái

Đề xuất áp dụng cho kế hoạch quản lý thiết bị V2.

## Bối cảnh

Nút “Xoá máy nhân viên” hiện gọi một RPC có thể chưa được triển khai và fallback sang DELETE trực tiếp. Cách này vừa gây lỗi 404 vừa làm mất dấu vết audit, trong khi các đơn cũ vẫn cần quy thuộc về máy đã tạo.

## Quyết định

Mọi thao tác từ UI được hiểu là **thu hồi**: giữ bản ghi Device, đặt trạng thái revoked, vô hiệu các phiên và ghi người/thời điểm/lý do. Xoá vật lý (purge) chỉ là thao tác quản trị riêng, có quyền cao hơn, sau thời gian lưu giữ và có xác nhận.

## Đánh đổi

- Tốn thêm dung lượng lưu trữ nhưng bảo toàn đối soát và điều tra sự cố.
- Luồng khôi phục nhanh hơn, nhưng phải kiểm soát chặt quyền restore.
- Cần migration/API ổn định thay vì dựa vào DELETE trực tiếp và fallback không có hợp đồng.

## Hệ quả

Danh sách thiết bị cần hiển thị trạng thái revoked/retired, audit và số đơn lịch sử. Các đơn không được đổi `source_device_id` chỉ vì nhân viên bị xoá khỏi Shop.
