# AI Gateway — Supabase Edge Function

Đích di chuyển toàn bộ luồng AI về server-side (review phần 10/11/14).

## Kiến trúc

```
Extension ──raw order──▶ Edge Function ──▶ Groq ──▶ AI response ──▶ Extension
```

Extension gửi:
```json
POST /functions/v1/ai-gateway
Authorization: Bearer <JWT người dùng Supabase>
{
  "text": "chử đơn rau",
  "task": "parse | address",
  "shop_id": "optional UUID"
}
```

Gateway làm:
1. Verify JWT đúng user
2. Xác định shop (member active)
3. Check `shop_feature_flags.ai_parsing_enabled`
4. Rate limit (`check_ai_rate_limit`)
5. Quota atomic (`consume_ai_quota`) — từ v17
6. Chọn Groq key: env `GROQ_API_KEY` ưu tiên, fallback `system_configs.groq_api_keys`
7. Gọi Groq (timeout 30s, retry 1 lần khi 5xx)
8. Ghi `ai_usage_log`
9. Trả result — **key không bao giờ xuất hiện ở client**

## Deploy

```sh
supabase link --project-ref xlgovgynbsahuykyjzcx
supabase functions deploy ai-gateway --project-ref xlgovgynbsahuykyjzcx
supabase secrets set GROQ_API_KEY=gsk_xxx   # tuỳ chọn, nếu trống sẽ dùng system_configs
```

## Cấu hình

- `verify_jwt = true` trong `supabase/config.toml` — bắt buộc JWT, chống anon truyền thẳng.
- `consume_ai_quota()` và `check_ai_rate_limit()` phải chạy từ **v17_quota_rate_limit.sql** trước khi deploy hàm.

## Không được làm

- Không trả Groq key trong response.
- Không để `GET` — hàm chỉ nhận `POST`.
- Không bí `service_role` trong extension — chỉ nằm trong Edge Function env.