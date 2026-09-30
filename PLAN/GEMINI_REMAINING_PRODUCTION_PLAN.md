# Gemini Remaining Production Plan

## Mission

Đưa Auto Fill Order từ trạng thái “đã có nền tảng P1–P5” sang production có bằng chứng. Làm tuần tự từ P0 đến P3. Mỗi task chỉ được đánh dấu hoàn thành khi đạt tiêu chí nghiệm thu và có kết quả test/smoke tương ứng.

> Nhánh triển khai chi tiết cho in nhãn, order timeline, CSKH automation, Facebook/Zalo, image confidence, RBAC và Partner API/MCP nằm tại `PLAN/VIBE_CODE_7_FEATURES_IMPLEMENTATION_PLAN.md`.

## Baseline đã hoàn thành — không làm lại

- P1/P2 analytics: `v109_admin_p1_p2_commercial_intelligence.sql`.
- P3 retention: `v110_admin_p3_retention_engine.sql`.
- P4 device enforcement: `v80`, `v85`, `v89`; contract hiện có đã đạt.
- P5 remote selectors: `v111_remote_selector_release_safety.sql`.
- Admin đã có KPI theo kỳ, trạng thái lỗi, role thật, realtime, global search, CAC/LTV/churn/cohort, margin theo shop và CSV.
- Thư mục `src/` là nguồn; `extension/` là output được đồng bộ bằng `npm run build`.

## Guardrails bắt buộc

1. Đọc `AGENTS.md` và incident liên quan trước khi sửa auth, order identity, PostgreSQL function hoặc build extension.
2. Không dùng tên, SĐT, địa chỉ hoặc COD làm khóa đơn. `order_code` khác nhau luôn là đơn mới.
3. Không hiển thị số giả, không biến API error thành số `0`, không báo success khi mutation chưa ghi thật.
4. Không đưa service-role key, API secret hoặc carrier token vào browser bundle/log.
5. Migration mới phải additive, có RLS/grant rõ ràng và không dùng `DROP ... CASCADE`.
6. Sau thay đổi runtime/UI phải chạy `npm run build`; xác nhận `extension/` chứa production bundle.
7. Giữ thay đổi nhỏ theo task; không refactor phần không liên quan trong dirty worktree.

## P0 — Production verification và data truth

### G001 — Xác minh migration P1–P5 trên Supabase

- Kiểm tra tồn tại bảng/hàm/policy/grant của `v109`, `v110`, `v111` bằng truy vấn read-only.
- Gọi thử bằng `SYSTEM_ADMIN`: `admin_get_commercial_intelligence`, `admin_global_search`, `admin_get_retention_portfolio`, `admin_list_remote_selector_releases`.
- Gọi bằng member thường và xác nhận bị từ chối.
- Ghi bằng chứng vào `PLAN/GEMINI_PRODUCTION_EVIDENCE.md`; che token, email, SĐT và payload nhạy cảm.
- Done khi mọi RPC trả schema đúng, RLS chặn member và không có lỗi PostgREST cache.

### G002 — Chuẩn hóa AI usage và giá vốn

- Kiểm kê cột thật của `ai_usage_log`; thống nhất input/output/total tokens, provider, model, status, latency và estimated cost.
- Tạo migration tương thích ngược nếu schema đang lệch giữa `prompt_tokens`, `input_tokens`, `completion_tokens`, `output_tokens`, `total_tokens`.
- Ghi giá model vào `ai_model_cost_rates`; chi phí phải chọn rate hiệu lực tại thời điểm request.
- Không suy diễn AI requests từ số đơn.
- Thêm test cho Gemini/Groq/Grok/OpenAI, request lỗi và model chưa có rate (`cost = N/A`, không phải 0 giả).
- Done khi tổng chi phí theo log khớp phép tính mẫu và dashboard ghi rõ nguồn/rate.

### G003 — Payment reconciliation và idempotency

- Kiểm tra Edge Function `payment-webhook`, chữ ký HMAC, timestamp/replay window và idempotency theo transaction ID.
- Tạo reconciliation job: giao dịch thành công nhưng subscription/quota chưa cập nhật phải vào hàng đợi xử lý lại.
- Bổ sung Admin view cho `unmatched`, `duplicate`, `failed`, `reconciled` và thao tác retry có audit.
- Không tự động cộng quota cho giao dịch thiếu shop mapping hoặc sai số tiền.
- Done khi cùng một webhook gửi 3 lần chỉ ghi/cộng quyền lợi một lần và retry phục hồi được giao dịch lỗi.

### G004 — Smoke test trình duyệt thật

- Chạy Chrome unpacked từ `extension/` trên VNPost và J&T bằng tài khoản test được phép.
- Kiểm tra: parse → review → fill → submit → nhận mã vận đơn → lưu bảng đơn đã lên.
- Kiểm tra AI trả muộn không ghi đè đơn đã submit và không gửi lại dữ liệu vào panel sai trạng thái.
- Kiểm tra J&T 401/session hết hạn: panel không treo; thông báo đăng nhập lại; không retry vô hạn.
- Chụp bằng chứng không chứa PII vào `tests/reports/`.
- Done khi cả hai carrier có một happy path và một failure path đạt.

## P1 — Reliability, observability và vận hành

### G005 — Alert rules và incident center

- Tạo rule cho AI error rate, provider latency, webhook failure, carrier DOM failure, sync backlog và payment reconciliation backlog.
- Alert phải có severity, threshold, window, dedupe key, first/last seen, acknowledged/resolved và owner.
- Admin có trang incident list/detail, acknowledge, resolve, deep-link về log nguồn và CSV export.
- Không gửi PII vào Telegram/Slack/Zalo.
- Done khi fixture kích hoạt đúng một alert, không spam lặp trong dedupe window và resolve được audit.

### G006 — Provider resilience

- Chuẩn hóa timeout, circuit breaker, exponential backoff có jitter và fallback chain cho Gemini/Groq/Grok/OpenAI.
- 429/503 retry hữu hạn; 400/401 không retry mù.
- Ghi provider/model/latency/error class/cache hit, không ghi prompt chứa PII.
- Dashboard hiển thị success rate, p50/p95 latency, error class và chi phí theo provider.
- Done khi test mô phỏng 429, 503, timeout, invalid key và recovery đều đạt.

### G007 — Job/outbox reliability

- Kiểm kê draft sync, order sync, Telegram outbox, webhook retry và retention notification.
- Chuẩn hóa trạng thái `pending/running/succeeded/failed/dead_letter`, attempt count, next retry, lease và idempotency key.
- Thêm Admin action retry/dead-letter replay có quyền và audit.
- Done khi hai worker chạy đồng thời không xử lý trùng một job.

### G008 — Data quality dashboard

- Theo dõi đơn thiếu tracking code, order_code trùng bất hợp lệ, địa chỉ confidence thấp, carrier status stale và payment không khớp.
- Mỗi KPI phải drill-down đến bản ghi nguồn; hỗ trợ range/filter/export.
- Không tự sửa dữ liệu khách hàng hàng loạt nếu chưa preview và xác nhận.
- Done khi số KPI bằng truy vấn đối chứng và drill-down không lệch tổng.

## P2 — Commercial growth

### G009 — Retention automation

- Dùng dữ liệu `v110` tạo daily snapshot để theo dõi lịch sử segment, không chỉ trạng thái hiện tại.
- Tạo playbook At-risk/Expiring/Critical; task CSKH có assignee, due date, outcome và next action.
- Tính conversion theo cohort đúng mẫu số; tách trial còn mở khỏi trial thất bại.
- Done khi một shop chuyển segment tạo tối đa một task đang mở cho cùng playbook.

### G010 — Reseller portal hoàn chỉnh

- Trang reseller: shop giới thiệu, doanh thu đủ điều kiện, commission pending/approved/paid và payout statement.
- Commission lấy từ giao dịch đã reconciled; refund/chargeback phải đảo commission.
- Phân quyền reseller chỉ thấy dữ liệu thuộc mình.
- Done khi test tenant isolation và phép tính payout/refund đạt.

### G011 — Prepaid wallet production

- Hiển thị số dư, immutable ledger, top-up, debit AI, refund và reference idempotency.
- Debit và AI request phải atomic hoặc có cơ chế reservation/compensation.
- Không cho số dư âm; thao tác Admin bắt buộc lý do và audit.
- Done khi concurrency test không double-spend.

### G012 — Unit economics đầy đủ

- Bổ sung hạ tầng, support và marketing cost vào gross margin theo shop/kỳ.
- CAC chỉ dùng acquisition cost có chứng từ; LTV hiển thị công thức và minimum sample size.
- Cohort có retention M0/M1/M2/M3 và revenue retention.
- Done khi dashboard đối chiếu đúng ledger, payment và cost entries.

## P3 — Product quality và mobile

### G013 — iOS/PWA quick-copy workflow

- Tối ưu webapp mobile: paste tin nhắn → parse local-first → review → các nút copy tên/SĐT/địa chỉ/COD/mã đơn.
- Hỗ trợ Share Sheet/PWA trong giới hạn iOS; không tuyên bố autofill app J&T/VNPost nếu iOS không cấp quyền.
- Lưu draft cục bộ có mã hóa phù hợp và nút xóa dữ liệu.
- Done khi thao tác trên viewport 375 px không tràn và hoàn thành copy từng trường bằng một chạm.

### G014 — Vietnamese mojibake cleanup

- Quét toàn bộ source cho chuỗi `Ã`, `Ä`, `Æ`, `áº`, `â€¦` trong UI tiếng Việt.
- Sửa source UTF-8, không sửa bundle sinh trong `extension/` bằng tay.
- Thêm test fail nếu UI source xuất hiện mojibake mới.
- Done khi scan source sạch và build vẫn đạt.

### G015 — Test/build gate

- Thêm các test mới `admin-p1-p2`, `admin-p3`, `admin-p5` vào script test chính hoặc test suite runner.
- Chạy `npm test`, `npm run test:security`, `npm run test:e2e` nếu có môi trường carrier test, rồi `npm run build`.
- Sửa lỗi thật; không xóa assertion để làm xanh test.
- Cập nhật `tests/reports/TEST-RESULTS.json` và `PLAN/GEMINI_PRODUCTION_EVIDENCE.md`.
- Done khi tất cả gate có kết quả, lỗi môi trường được phân biệt với lỗi sản phẩm.

## P4 — Release readiness

### G016 — Security review

- Rà RLS tenant isolation, IDOR, stored XSS, secret exposure, webhook replay, admin audit và dependency vulnerabilities.
- Mọi finding có severity, file/RPC, exploit condition, fix và regression test.
- Done khi không còn Critical/High mở trước release.

### G017 — Backup, rollback và runbook

- Viết runbook payment outage, AI outage, carrier DOM change, Supabase outage và rollback extension/selector/migration.
- Xác minh backup/restore trên môi trường không phải production.
- Done khi người khác có thể chạy runbook bằng lệnh và tiêu chí xác nhận được ghi rõ.

### G018 — Go-live checklist

- Xác nhận domain, privacy/terms, support channel, pricing, billing disclaimer, monitoring, backup và owner trực ca.
- Chạy pilot với shop test trước khi mở rộng rollout.
- Done khi `PLAN/P0-GO-NO-GO-CHECKLIST.md` không còn mục Critical chưa xử lý.

## Trình tự Gemini phải làm

1. Chọn task chưa hoàn thành có ID nhỏ nhất.
2. Viết test/contract đỏ cho hành vi cần sửa.
3. Thực hiện thay đổi nhỏ nhất để test xanh.
4. Chạy test hẹp, sau đó test liên quan và build nếu chạm UI/runtime.
5. Ghi file đã đổi, kết quả test, bằng chứng và blocker vào `PLAN/GEMINI_PRODUCTION_EVIDENCE.md`.
6. Chỉ đánh dấu task hoàn thành khi toàn bộ tiêu chí `Done` đạt; dependency/secrets thiếu phải ghi `BLOCKED`, không giả lập thành công.

## Prompt giao Gemini

```text
Đọc AGENTS.md và PLAN/GEMINI_REMAINING_PRODUCTION_PLAN.md. Thực hiện task chưa hoàn thành có ID nhỏ nhất theo đúng dependency. Trước khi sửa, kiểm tra dirty worktree và incident bắt buộc. Viết regression test trước, không dùng dữ liệu giả, không làm yếu RLS/TLS, không hard-code secret, không sửa extension/ bằng tay. Sau khi hoàn thành, chạy test hẹp, test liên quan và npm run build nếu chạm UI/runtime. Cập nhật PLAN/GEMINI_PRODUCTION_EVIDENCE.md bằng file đã đổi, lệnh test, kết quả và blocker. Không tuyên bố production-ready nếu chưa có smoke evidence thực.
```
