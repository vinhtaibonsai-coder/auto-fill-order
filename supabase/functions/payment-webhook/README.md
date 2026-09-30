# Payment Webhook deployment

Required Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMENT_WEBHOOK_API_KEY`: a randomly generated secret; no default is accepted.
- `PAYMENT_WEBHOOK_HMAC_SECRET` (P0-4): HMAC-SHA256 secret for hardened mode. Khi cấu hình, webhook yêu cầu `X-Signature: sha256=<hex(hmac_sha256(rawBody, secret))>`, `X-Timestamp` (unix sec, ±5m), `X-Nonce` (uuid, chống replay 10m), `Idempotency-Key` (gateway txn id).
- `PAYMENT_WEBHOOK_ALLOWED_ORIGIN`: optional, defaults to `https://my.sepay.vn`.

Auth modes:
1. **HMAC hardened (khuyến nghị P0-4)**: client gửi `X-Signature`, `X-Timestamp`, `X-Nonce`, `Idempotency-Key`. Server verify HMAC `timingSafeEqual`, timestamp ±300s, nonce unique (bảng `webhook_nonces`), idempotency qua `payment_transactions.transaction_code` unique.
2. **Legacy API Key**: `Authorization: Bearer <PAYMENT_WEBHOOK_API_KEY>` hoặc `X-Webhook-Key: <PAYMENT_WEBHOOK_API_KEY>` — giữ để SePay cũ tương thích khi chưa gửi HMAC.

Tokens in query strings are deliberately rejected because URLs commonly leak into logs. Deploy migration `001_baseline_commercial_schema.sql`, `v92_p0_webhook_hardening.sql` và tất cả migrations trước khi deploy function. Test replay (cùng nonce) phải 409 `REPLAY_DETECTED`, lệch timestamp +6m phải 401 `TIMESTAMP_EXPIRED`, trùng Idempotency-Key chỉ ghi 1 ledger.
