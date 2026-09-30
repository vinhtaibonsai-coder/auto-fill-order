# Incident: Supabase Auth HTTP 500 after admin password reset

## Symptom

The extension login request to `/auth/v1/token?grant_type=password` returned
HTTP 500 for an account whose password had just been reset in the admin UI.
The UI then showed the generic invalid email/password message.

## Root cause

The login self-healing branch declared the first `fetch` response as `const`
and later assigned the successful retry response to it.  The assignment threw
inside the recovery branch, so a successful retry was discarded.  Separately,
the consolidated SQL installer did not include the `admin_repair_user_auth`
RPC.  Legacy reset functions could also trust `profiles.id` even when it had
drifted from the canonical `auth.users` row, leaving an invalid email identity.

## Required invariants

1. Login retry responses must replace the original response (`let resp`) only
   after a valid `access_token` is present.
2. Auth repair resolves the canonical user from `auth.users.email` first;
   `profiles` is a legacy fallback only.
3. Repair normalizes the password/confirmation metadata and recreates one
   email identity before the token retry.
4. A reset/repair RPC failure must never be reported as success.  HTTP 5xx is
   surfaced as a server/migration issue, not as invalid credentials.

## Regression coverage

- `tests/unit/auth-login-repair.test.mjs` covers 500 → repair → successful
  token retry.
- `tests/unit/auth-login-migration.test.mjs` verifies the standalone and
  consolidated migration contracts.

## Recovery procedure

Run `database/migrations/v81_auth_login_repair.sql` once in the Supabase SQL
Editor (or run the updated `RUN_ALL_MIGRATIONS.sql`), then reload the unpacked
extension.  If login still returns HTTP 500, inspect Supabase Auth logs and
the response from `admin_repair_user_auth`; do not keep changing passwords in
the UI because that cannot repair an absent/mismatched identity row.
