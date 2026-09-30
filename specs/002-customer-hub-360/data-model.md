# Data Model: Customer Hub 360

## Customer

- `id`: UUID, primary key
- `shop_id`: UUID, bắt buộc, tenant owner
- `normalized_phone`: TEXT, 9–11 số
- `display_phone`: TEXT
- `name`: TEXT
- `primary_address_id`: UUID nullable
- `segment`: `new | repeat | vip | churn_risk | risk`
- `risk_level`: `safe | warning | blacklist`
- `total_orders`, `successful_orders`, `failed_orders`: INTEGER >= 0
- `total_spent`, `aov`: NUMERIC >= 0
- `delivery_success_rate`: NUMERIC 0–100
- `first_order_at`, `last_order_at`: TIMESTAMPTZ
- `fav_carrier`: nullable `vnpost | jt`
- `is_blacklisted`, `blacklist_reason`
- `metrics_updated_at`, `created_at`, `updated_at`

**Uniqueness**: `(shop_id, normalized_phone)`.

## CustomerAddress

- `id`, `shop_id`, `customer_id`
- `raw_address`, `normalized_address`
- `province`, `district`, `ward`
- `address_fingerprint`
- `use_count`, `successful_delivery_count`
- `first_used_at`, `last_used_at`
- `is_primary`

**Uniqueness**: `(customer_id, address_fingerprint)`.

## CustomerOrderLink

- `id`, `shop_id`, `customer_id`
- `source_type`: `order | submitted_order | import`
- `source_order_id`
- `order_code`, `tracking_code`, `carrier`, `status`, `cod_amount`
- `ordered_at`, `synced_at`

**Uniqueness**: `(shop_id, source_type, source_order_id)`.

## CustomerNote

- `id`, `shop_id`, `customer_id`
- `content`, `created_by`, `created_by_name`
- `created_at`, `updated_at`, `deleted_at`

## CustomerTag

- `id`, `shop_id`, `name`, `color`, `is_system`
- Quan hệ nhiều-nhiều qua `customer_tag_assignments`.

## RiskEvent

- `id`, `shop_id`, `customer_id`, `source_order_link_id`
- `event_type`, `severity`, `reason`, `created_by`, `created_at`

## CustomerSyncJob

- `id`, `shop_id`, `job_type`: `backfill | import`
- `status`: `queued | running | completed | partial | failed | cancelled`
- `cursor`, `total_rows`, `processed_rows`, `success_rows`, `error_rows`
- `error_report`, `created_by`, timestamps

## State Rules

- Segment được rebuild sau thay đổi order link/status.
- Blacklist có ưu tiên cao hơn segment hiển thị và phải có reason.
- Xóa/hoàn/hủy đơn phải cập nhật hoặc loại customer order link khỏi metrics.
- Primary address chỉ có tối đa một bản ghi/customer.
- Mọi bảng có `shop_id` và RLS kiểm tra membership/role.
