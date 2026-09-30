# Runbook: Xử lý Sự cố Nhà Cung cấp AI (AI Provider Outage & Circuit Breaker)

> **Mã quy trình**: RB-AI-01  
> **Mức độ sự cố**: P1 (Lỗi một nhà cung cấp AI, fallback tự động kích hoạt) hoặc P0 (Toàn bộ các nhà cung cấp AI cùng sập)  
> **Thành phần liên quan**: Groq, Google Gemini, OpenAI, Claude, `ProviderResilienceEngine`, `Local-First Fast-Path Parser`, bảng `ai_model_cost_rates`, bảng `system_incidents`.

---

## 1. Triệu chứng & Dấu hiệu Nhận biết (Symptoms)
- Tỷ lệ lỗi phân tích đơn hàng qua AI tăng vọt vượt ngưỡng cảnh báo (Error Rate > 15%).
- Nhật ký ứng dụng ghi nhận các mã lỗi:
  - `HTTP 429 Too Many Requests`: Hết quota / chạm rate limit của API key nhà cung cấp.
  - `HTTP 503 / 500 Service Unavailable`: Nhà cung cấp (Groq Cloud / Google AI Studio) gặp sự cố máy chủ.
  - `Client Timeout (> 8000ms)`: Độ trễ phản hồi quá cao khiến người dùng bị treo bảng điền đơn.
- Trạng thái ngắt mạch (Circuit Breaker) của một hoặc nhiều provider chuyển sang trạng thái `OPEN`.

---

## 2. Nguyên lý Hoạt động của Bộ Ngắt Mạch (Circuit Breaker State Machine)

Hệ thống tích hợp `ProviderResilienceEngine` với máy trạng thái 3 pha tự phục hồi:
```text
           [ Thất bại liên tiếp >= 5 lần ]
   CLOSED ──────────────────────────────────> OPEN
     ▲                                          │
     │                                          │ [ Sau thời gian cooldown 60 giây ]
     │                                          ▼
     └───────────── HALF-OPEN <─────────────────┘
      [ Thử nghiệm thành công 2 lần ]
```

1. **CLOSED (Bình thường)**: Mọi yêu cầu được gửi trực tiếp đến provider ưu tiên (Mặc định: Groq LLaMA 3.3).
2. **OPEN (Ngắt mạch khẩn cấp)**: Khi phát hiện 5 lỗi liên tiếp (429/500/timeout), circuit breaker lập tức ngắt mạch provider này trong vòng 60 giây. Mọi yêu cầu mới sẽ được chuyển hướng tự động sang provider dự phòng tiếp theo trong Fallback Chain mà không mất thời gian chờ timeout.
3. **HALF-OPEN (Thử nghiệm hồi phục)**: Sau khi hết 60s cooldown, hệ thống cho phép 2 request thăm dò đi qua. Nếu cả 2 thành công, mạch đóng lại (`CLOSED`); nếu thất bại, mạch quay lại trạng thái `OPEN` thêm 120s.

---

## 3. Quy trình Xử lý & Ứng phó Sự cố (Remediation Procedure)

### Bước 1: Kích hoạt chế độ Local-First Fast-Path (Không cần AI)
Đa phần đơn hàng tiếng Việt chuẩn cấu trúc có thể được bóc tách hoàn toàn ngoại tuyến:
- Kiểm tra tính năng `localFirstAI` trong cấu hình Extension hoặc Admin Dashboard.
- Khi bật chế độ `Local-First Fast-Path`, engine bóc tách địa chỉ nội bộ (`AddressEngine`) và regex bóc tách số điện thoại/COD sẽ xử lý đơn hàng cục bộ trong 5ms.
- Chỉ những đơn hàng có địa chỉ phức tạp hoặc ngôn ngữ dị biệt mới chuyển tiếp đến AI. Việc này giúp giảm tải tới 80% lưu lượng gửi lên các nhà cung cấp AI.

### Bước 2: Kiểm tra Chuỗi Dự phòng (Cross-Provider Fallback Chain)
Hệ thống tự động thực hiện chuỗi fallback theo thứ tự tối ưu chi phí và độ trễ:
```text
Groq (LLaMA 3.3 70B - Tốc độ cao)
   │ (Gặp lỗi 429 / 503)
   ▼
Google Gemini 1.5 Flash (Ổn định, chi phí thấp)
   │ (Gặp lỗi)
   ▼
OpenAI GPT-4o-mini (Dự phòng độ tin cậy cao)
   │ (Gặp lỗi)
   ▼
Chế độ bóc tách thuần thuật toán Local Heuristic (Zero AI Dependency)
```

### Bước 3: Cập nhật Cấu hình / API Key Khẩn cấp
Nếu API key của một provider bị khóa hoặc cạn tiền:
1. Truy cập `Admin Dashboard -> Quotas -> AI Provider Rates` hoặc bảng `public.ai_model_cost_rates`.
2. Kiểm tra định mức giá và tình trạng của model:
```sql
SELECT model_id, provider, input_cost_per_million, output_cost_per_million, is_active, updated_at
FROM public.ai_model_cost_rates
ORDER BY is_active DESC, updated_at DESC;
```
3. Tạm thời vô hiệu hóa provider bị sự cố nếu cần thiết:
```sql
UPDATE public.ai_model_cost_rates
SET is_active = false
WHERE provider = 'groq';
```

### Bước 4: Ghi nhận sự cố hệ thống vào System Incidents
Ghi vết sự cố vào bảng `system_incidents` để phục vụ giám sát và SLA:
```sql
SELECT public.record_system_incident(
    'provider_outage',
    'HIGH',
    'AI Provider Groq Cloud gặp sự cố HTTP 429 trên toàn cụm. Đã kích hoạt Fallback sang Gemini Flash.',
    jsonb_build_object('provider', 'groq', 'circuit_breaker', 'OPEN', 'fallback_target', 'gemini')
);
```

---

## 4. Tiêu chí Xác minh Phục hồi (Verification Criteria)
- [ ] Bảng trạng thái Circuit Breaker chuyển về trạng thái `CLOSED` trên toàn bộ các provider đang hoạt động.
- [ ] Tỷ lệ bóc tách đơn hàng thành công đạt >= 99.5%.
- [ ] Thời gian xử lý bóc tách trung bình (P95 latency) trở về dưới mức 1200ms.
- [ ] Chi phí và token được ghi nhận đầy đủ, chính xác trong `ai_usage_log` theo bảng giá `ai_model_cost_rates`.
