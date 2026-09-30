# P0-7 — Bằng chứng Đối soát Ví (Reconciliation Evidence) & Chạy Pilot

> **Mục tiêu**: tạo đủ bằng chứng cho gate **P0-7** (7 ngày đối soát `ledger` vs `gateway` chênh **0đ**) và chuẩn bị chạy **Pilot Shop** theo tiêu chí G018.
>
> **Ai chạy**: Master Admin (có quyền SQL Editor trên Supabase Production).
> **Cách chạy**: mở Supabase Dashboard → **SQL Editor** → dán từng khối SQL → **Run**.
> **Bảo mật**: bảng này bật RLS (chỉ `service_role`/`SYSTEM_ADMIN` đọc được) ⇒ **không** query bằng anon key/extension; mọi thao tác dưới đây chạy bằng quyền SQL Editor (postgres).

---

## Phần A — Thu thập bằng chứng P0-7 (4 bước)

### A1. Kiểm tra cron job đã được xếp lịch chưa

```sql
select jobid, schedule, command, active
from cron.job
where jobname = 'reconcile-wallets-daily';
```

- **Đạt** nếu trả về 1 dòng, `schedule = '0 2 * * '`, `active = true`.
- **Trống** ⇒ pg_cron chưa schedule (migration v93 chạy phần `DO $$` bị bỏ qua). Chạy lại phần schedule:

```sql
select cron.schedule('reconcile-wallets-daily', '0 2 * * *', 'SELECT public.reconcile_wallets(CURRENT_DATE - 1)');
```

### A2. Xác nhận cron đã THỰC SỰ chạy (không lỗi)

```sql
select j.jobname, r.start_time, r.end_time, r.status, left(r.return_message, 120) as message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'reconcile-wallets-daily'
order by r.start_time desc
limit 14;
```

- **Đạt** nếu ≥ 1 dòng `status = 'succeeded'` và **không** có dòng `failed` trong 7 ngày gần nhất.

### A3. Chạy đối soát bù (backfill) 30 ngày — AN TOÀN, chạy lại được

> Hàm `reconcile_wallets()` là **idempotent** (`INSERT ... ON CONFLICT (report_date, shop_id) DO UPDATE`) nên chạy bao nhiêu lần cũng không nhân đôi dữ liệu.

```sql
select r.*
from generate_series(current_date - 30, current_date - 1, '1 day') as d
cross join lateral public.reconcile_wallets(d::date) as r
order by d, r.shop_id;
```

### A4. Trích 4 bảng bằng chứng (đây là kết quả cần lưu)

```sql
-- (1) GATE P0-7: 7 ngày gần nhất còn lệch không?  → PHẢI TRẢ VỀ 0 DÒNG
select report_date, shop_id, ledger_sum, gateway_sum, diff, status
from public.reconciliation_runs
where diff <> 0
  and report_date >= current_date - 7
order by report_date;

-- (2) 7 ngày liên tiếp có log đối soát, tổng chênh mỗi ngày → PHẢI ĐỦ 7 DÒNG, `lech_moi_ngay = 0`
select report_date,
       count(*)                         as so_shop_doi_soat,
       sum(diff)                        as lech_moi_ngay,
       case when sum(diff) = 0 then 'PASS' else 'FAIL' end as ket_qua
from public.reconciliation_runs
where report_date >= current_date - 7
group by report_date
order by report_date;

-- (3) Tổng quan 30 ngày sau backfill
select status, count(*) as so_dong, sum(diff) as tong_lech
from public.reconciliation_runs
where report_date >= current_date - 30
group by status
order by status;

-- (4) Alert chưa xử lý trong 30 ngày → PHẢI TRẢ VỀ 0
select *
from public.reconciliation_alerts
where resolved is not true
  and report_date >= current_date - 30;
```

### Tiêu chí PASS (dán kết quả vào `PLAN/GEMINI_PRODUCTION_EVIDENCE.md`)

| # | Truy vấn | Điều kiện PASS |
|---|---|---|
| 1 | A4(1) | **0 dòng** |
| 2 | A4(2) | **7 dòng**, `lech_moi_ngay = 0` tất cả |
| 3 | A4(3) | chỉ có `status='ok'`, `tong_lech = 0` |
| 4 | A4(4) | **0 dòng** |
| 5 | A1/A2 | cron `active=true` + ≥1 `succeeded` trong 7 ngày |

> ⚠️ **Ghi chú trung thực**: backfill (A3) cho thấy số liệu 30 ngày qua chênh 0đ; điều kiện "7 ngày liên tiếp" của P0-7 là để chứng minh **job tự chạy hằng ngày** — vì vậy sau khi chạy A3, tiếp tục giữ cron (A1) và lấy lại A4(1)+(2) sau 7 ngày nữa để có log 7 ngày **do cron tự sinh**.

---

## Phần B — Chạy Pilot Shop (G018)

**Phạm vi**: 5–10 shop test chạy song song trên nền tảng thật.

**Tiêu chí nghiệm thu** (ngoài bằng chứng P0-7 ở trên):

| KPI | Ngưỡng |
|---|---|
| Autofill Success Rate | ≥ 99,0% (kỳ vọng ≥ 99,5%) |
| Crash / Unhandled Exception Rate | ≤ 0,1% |
| Lệch đối soát tiền/ví | **0đ** |
| Lỗi submit nhà xe | 0 lỗi lặp lại (mỗi sự cố phải có incident) |

**Nhật ký pilot (điền tay, 1 dòng/ngày/shop):**

| Ngày | Shop | Đơn điền tự động | Thành công | Tỷ lệ % | Lệch đối soát | Sự cố |
|---|---|---|---|---|---|---|

**Quy trình mỗi ngày trong 7 ngày pilot:**
1. Chạy **A4** (3 truy vấn đầu) → ghi `lech_moi_ngay`.
2. Thống kê đơn của ngày từ trang **Admin → Global Orders** (hoặc bảng `orders`) → tính tỷ lệ autofill.
3. Ghi sự cố (nếu có) vào `docs/incidents/` theo mẫu hiện có.
4. Cả 7 ngày đạt ⇒ pilot PASS → đưa 5 tiêu chí trên vào `PLAN/GEMINI_PRODUCTION_EVIDENCE.md` mục G018.

---

## Phần C — Sau khi có kết quả

Gửi lại kết quả 5 truy vấn (A1, A2, A4(1)–(4)) → đối chiếu PASS/FAIL, ghi vào `PLAN/GEMINI_PRODUCTION_EVIDENCE.md` (mục G003/P0-7) và tick checkbox tương ứng trong `PLAN/P0-GO-NO-GO-CHECKLIST.md`.

**Runbook liên quan**: [PAYMENT_GATEWAY_OUTAGE.md](./PAYMENT_GATEWAY_OUTAGE.md) · [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md) · [BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md)
