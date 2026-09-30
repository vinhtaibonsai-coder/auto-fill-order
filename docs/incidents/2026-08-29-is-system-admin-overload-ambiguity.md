# Incident: `is_system_admin()` was ambiguous

## Symptom

Administrative RPCs such as `get_admin_users_list` failed with PostgreSQL
error `42725`:

```text
function public.is_system_admin() is not unique
Could not choose a best candidate function.
```

## Root cause

Different migration generations left both of these functions in `public`:

```sql
is_system_admin()
is_system_admin(UUID DEFAULT auth.uid())
```

The UUID overload's default makes it callable without an argument. PostgreSQL
therefore had two equally valid candidates for every `is_system_admin()` guard,
including RLS policies and administrative RPCs.

## Invariants

1. A function name must have only one candidate for each callable arity.
2. Keep `is_system_admin()` for the current authenticated user.
3. Keep `is_system_admin(UUID)` for explicit checks, without a parameter default.
4. Never repair authorization helpers with `DROP ... CASCADE`; this can delete
   dependent RLS policies and RPCs.
5. When a defaulted overload may have dependencies, rename it first so its OID
   remains valid, install canonical overloads, and drop the renamed function
   only when PostgreSQL reports no dependencies.

## Recovery

Apply `database/migrations/v84_fix_is_system_admin_overloads.sql` to the
existing Supabase project and reload the Admin portal. The migration is
idempotent after a successful run and does not delete users, Shops, policies,
orders, or devices.

## Regression coverage

Run:

```bash
node tests/unit/is-system-admin-overload-migration.test.mjs
```
