# Domain glossary

## Shop

Cửa hàng sở hữu dữ liệu đơn hàng, thành viên và các máy được phép kết nối.

## Member (thành viên)

Tài khoản người dùng được cấp quyền trong một Shop. Một Member có thể dùng nhiều Device; xoá hoặc thu hồi một Device không tự động xoá Member.

## Device (máy trạm)

Một cài đặt Extension trên một trình duyệt/máy cụ thể. Device là thực thể độc lập với Member và có vòng đời riêng.

## Device session (phiên thiết bị)

Quyền truy cập đang hoạt động của một Device vào Shop. Phiên có thể bị vô hiệu hoá từ xa mà không làm mất lịch sử Device.

## Revocation (thu hồi)

Chuyển quyền truy cập của Device hoặc Member sang trạng thái không hoạt động, giữ lại định danh và lịch sử để đối soát/audit.

## Order attribution (quy thuộc đơn)

Liên kết bất biến giữa một đơn hàng và định danh tạo đơn (`order id`, `shop`, `source device`, `submitted by`). Tên, số điện thoại và địa chỉ chỉ là dữ liệu khách hàng, không phải định danh đơn.
