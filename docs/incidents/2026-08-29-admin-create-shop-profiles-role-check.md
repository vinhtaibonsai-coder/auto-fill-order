# Incident: Creating a Shop failed on profiles_role_check

## Symptom

`admin_create_shop_with_account` returned PostgreSQL `23514` while creating an
owner account.  The failing profile row contained `role = 'SHOP_OWNER'`.

## Root cause

The RPC mixed two different role models.  `profiles.role` is a legacy
compatibility column and the production schema accepts/defaults it to
`member`.  Actual authorization is stored in `user_roles` and `shop_members`.
The RPC and `handle_new_user` incorrectly wrote the Shop role into the legacy
profile column.

## Invariants

1. Never write `SHOP_OWNER`, `SHOP_MANAGER`, `SHOP_STAFF`, or a dynamic RBAC
   code to `profiles.role`; omit the column or write only `member`.
2. Store Shop membership/role in `shop_members`; store system-level role
   assignment in `user_roles`.
3. `admin_create_shop_with_account` must require an authenticated System Admin
   and must not be executable by `anon`.
4. Resolve an existing account from `auth.users.email` before falling back to
   `profiles`, because `auth.users` is canonical for authentication identity.

## Regression coverage

Run:

```bash
node tests/unit/admin-create-shop-profile-role.test.mjs
```

The test scans the active, forward, and consolidated migrations and fails if a
profiles insert contains an RBAC role code.

## Recovery

Apply `database/migrations/v83_fix_admin_create_shop_profile_role.sql` to an
existing Supabase project, then retry creating the Shop.  The failed RPC call
is transactional, so it should not leave a partially created Shop; the fixed
RPC also safely reuses an existing auth account by email if one is present.
