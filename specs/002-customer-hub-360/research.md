# Research Decisions: Customer Hub 360

## 1. Đồng bộ đơn sang khách hàng

**Decision**: Dùng bảng liên kết idempotent giữa khách và đơn nguồn, sau đó rebuild metrics; trigger không cộng dồn mù.  
**Rationale**: `orders` và `submitted_orders` có thể đại diện cùng một đơn, trạng thái có thể thay đổi, backfill có thể chạy lại.  
**Alternatives considered**: Trigger cộng `total_orders + 1` trực tiếp — đơn giản nhưng tạo double count và khó sửa drift.

## 2. Nguồn dữ liệu chuẩn

**Decision**: Supabase là source of truth cho customers, addresses, notes, tags và blacklist.  
**Rationale**: Hỗ trợ nhiều thiết bị, tenant isolation, realtime và audit.  
**Alternatives considered**: localStorage/Chrome Storage — chỉ phù hợp cache cục bộ, không phù hợp CRM chung.

## 3. Tính RFM và rủi ro

**Decision**: Lưu metrics dẫn xuất để đọc nhanh nhưng có hàm rebuild deterministic; thresholds nằm trong cấu hình shop.  
**Rationale**: UI nhanh, đồng thời có thể sửa sai khi mapping trạng thái hoặc quy tắc thay đổi.  
**Alternatives considered**: Tính toàn bộ ở client mỗi lần mở — tốn băng thông và không nhất quán giữa Extension/Options.

## 4. Địa chỉ lịch sử

**Decision**: Lưu raw và normalized; Extension chỉ gợi ý, không tự động thay địa chỉ hiện tại.  
**Rationale**: Tránh tái diễn lỗi địa chỉ bị cắt hoặc dùng nhầm địa chỉ cũ.  
**Alternatives considered**: Auto-fill địa chỉ dùng nhiều nhất — nhanh nhưng rủi ro giao sai.

## 5. Import đa kênh

**Decision**: MVP hỗ trợ CSV/XLSX với mapping cột và preview; connector API trực tiếp để backlog sau.  
**Rationale**: Bao phủ nhiều nguồn mà không phụ thuộc API/credential của từng nền tảng.  
**Alternatives considered**: Xây đồng thời Pancake/KiotViet/Shopee/TikTok connectors — phạm vi và rủi ro vận hành quá lớn cho MVP.

## 6. Extension lookup

**Decision**: Query summary tối thiểu theo shop + phone, timeout và cache TTL ngắn.  
**Rationale**: Không tải hồ sơ 360 vào content script và không chặn luồng lên đơn khi mạng lỗi.  
**Alternatives considered**: Nhúng toàn bộ customer dataset vào Extension — tăng rủi ro lộ dữ liệu và dữ liệu cũ.
