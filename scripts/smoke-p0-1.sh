#!/usr/bin/env bash
# P0-1 smoke test: v66->v90 + SYSTEM_ADMIN 4 RPC
set -e
echo "== P0-1 Smoke Test: SYSTEM_ADMIN =="
if [ -z "$SB_URL" ] || [ -z "$SB_SERVICE_KEY" ]; then
  echo "SKIP: SB_URL / SB_SERVICE_KEY chưa set - chạy ở chế độ offline (chỉ kiểm tra migration files)"
  echo "Kiểm tra migration files tồn tại..."
  ls -1 database/migrations/v66*.sql database/migrations/v90*.sql >/dev/null 2>&1 || { echo "FAIL: thiếu migration v66/v90"; exit 1; }
  echo "Kiểm tra is_system_admin overload..."
  node tests/unit/is-system-admin-overload-migration.test.mjs
  echo "Kiểm tra admin-create-shop profile role..."
  node tests/unit/admin-create-shop-profile-role.test.mjs
  echo "✅ P0-1 offline PASS"
  exit 0
fi
echo "Running against $SB_URL"
psql "$SB_URL" -c "select admin_create_shop('{\"name\":\"P0 Test Shop\"}'::jsonb);"
psql "$SB_URL" -c "select * from audit_log where action like 'admin_%' order by created_at desc limit 5;"
echo "✅ P0-1 PASS"
