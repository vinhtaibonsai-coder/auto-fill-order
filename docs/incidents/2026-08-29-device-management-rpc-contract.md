# Incident: Device management RPC contract drift (2026-08-29)

## Symptoms

- `owner_get_members_v3` returned HTTP 400.
- `owner_get_members_v2` and `owner_delete_staff_device` returned HTTP 404.
- The Team page then mixed direct table reads with destructive browser-side DELETE.
- Device order counts could be inflated when a staff display name matched `submitted_orders.created_by_name`.

## Root cause

The database migrations defined incompatible contracts for the same RPC names. The v65 version of `owner_get_members_v3` returned a table and counted `submitted_orders.submitted_by`; v77 attempted to replace it with JSONB while referencing the non-existent `submitted_orders.user_id`. PostgreSQL cannot replace a function while changing its return type, so the migration was not a valid deployment path. The delete RPC was therefore absent on projects where v77 had not been applied.

The device KPI RPC also used a mutable display name as an order-ownership fallback. A name is not an order identity and is unsafe for repeat customers, renamed staff, or shared devices.

## Permanent prevention

1. Apply `database/migrations/v80_device_management_v2.sql` as a reviewed, versioned migration.
2. Keep one `owner_get_members_v3(UUID) -> JSONB` contract and revoke anonymous execution.
3. Use `owner_revoke_device` and `owner_remove_shop_member` for all UI removals. These operations are audited and retain rows/history.
4. Attribute device-level orders only by `source_device_id`; use `submitted_by` only for member-level totals. Never use name, phone, address, COD, or a display label as an order identity.
5. Run `node tests/unit/device-management-v2-contract.test.mjs`, `npm run test:repeat-order`, and `npm test` before shipping.
6. If the RPC check is unavailable, the client may use only the bounded offline grace window; it must not fail open indefinitely.

## Verification query

After deployment, verify the exact contracts in Supabase:

```sql
select p.proname, pg_get_function_result(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'owner_get_members_v3',
    'owner_get_shop_staff_and_devices',
    'owner_revoke_device',
    'owner_remove_shop_member',
    'check_device_session_validity'
  );
```
