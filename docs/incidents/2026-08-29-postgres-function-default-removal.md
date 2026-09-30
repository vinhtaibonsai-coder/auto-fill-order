# Incident: PostgreSQL rejected removal of a function parameter default

## Symptom

Applying the auth repair migration failed with PostgreSQL error `42P13`:

```text
cannot remove parameter defaults from existing function
HINT: Use DROP FUNCTION admin_repair_user_auth(text,text) first.
```

## Root cause

Migrations `v78` and `v79` created
`public.admin_repair_user_auth(TEXT, TEXT)` with a default value for
`p_password`. Migration `v81` later tightened the API by removing that default,
but attempted the change with `CREATE OR REPLACE FUNCTION`.

Function identity is based on its name and input argument types, not parameter
defaults. PostgreSQL therefore resolved both definitions to the same function
and rejected removal of the existing default.

## Invariants

1. Do not remove an existing parameter default with `CREATE OR REPLACE FUNCTION`.
2. Drop the exact function signature first, without `CASCADE`, then recreate it.
3. Restore all intended `GRANT EXECUTE` and `REVOKE` statements after recreation.
4. Apply the same compatibility step to both the forward migration and the
   consolidated `RUN_ALL_MIGRATIONS.sql` script.

## Recovery

Run the corrected `database/migrations/v81_auth_login_repair.sql`. It drops only
`public.admin_repair_user_auth(TEXT, TEXT)`, immediately recreates it without a
default password, and restores its execution grants. The operation does not
delete user accounts, profiles, Shops, devices, or orders.

## Regression coverage

Run:

```bash
node tests/unit/auth-login-migration.test.mjs
```

The test requires the exact legacy signature to be dropped immediately before
the stricter function is created in both migration entry points.
