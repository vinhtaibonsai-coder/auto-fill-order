# Báo Cáo Smoke Test Trình Duyệt Thật (G004)

- **Thời gian thực hiện**: 2026-10-02T00:40:13.527Z
- **Phiên bản Extension**: 1.0.2 (Production Unpacked)
- **Tình trạng tổng thể**: **PASSED (100%)**

## 1. VNPost Carrier
- **Happy Path**: Parse -> Review -> Fill -> Submit -> Nhận mã vận đơn -> Lưu danh sách đơn đã lên: **PASSED**
  - Tracking code mẫu (đã che PII): `EM*******VN`
  - Đã xác thực không lưu trữ PII thô trong nhật ký kiểm thử.
- **Failure Path**: AI trả muộn sau khi đơn đã submit: **PASSED**
  - `asyncResultGate` hủy token cũ ngay khi submit.
  - Phản hồi AI muộn bị chặn an toàn, không ghi đè trạng thái panel.

## 2. J&T Express Carrier
- **Happy Path**: Parse -> Review -> Fill J&T fields (chế độ địa chỉ mới, cân nặng, COD, thanh toán) -> Nhận mã vận đơn: **PASSED**
  - Waybill code mẫu (đã che PII): `84**********`
- **Failure Path**: Lỗi 401 Session Expiry: **PASSED**
  - Panel không treo (`isFrozen: false`).
  - Hiển thị thông báo đăng nhập lại rõ ràng.
  - Dừng ngay lập tức, không retry vô hạn (`retriesCount: 0`).
