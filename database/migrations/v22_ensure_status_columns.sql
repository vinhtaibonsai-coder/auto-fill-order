-- =========================================================================
-- v22_ensure_status_columns.sql
-- FIX: ERROR 42703 "column status does not exist" khi chạy v19.
--
-- Nguyên nhân: DB thực tế thiếu cột `status` (hoặc `removed_at`) trên
-- `profiles` / `shop_members` — thường do DB bắt đầu từ template Supabase
-- mặc định (profiles chỉ có id/email/...) thay vì RUN_ALL_MIGRATIONS.
--
-- Migration này, kể cả khi cột đã tồn tại, đều an toàn (IF NOT EXISTS)
-- và bảo vệ kiểu cũ BOOLEAN => TEXT như phong cách v5.
-- Chạy v22 TRƯỚC v19 rồi chạy lại v19.
-- =========================================================================

-- 1. profiles: đảm bảo có status TEXT
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Chuyển đổi nếu cột cũ là BOOLEAN (template cũ) sang TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'status' AND data_type = 'boolean'
    ) THEN
        ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE public.profiles ALTER COLUMN status TYPE TEXT
            USING (CASE WHEN status THEN 'active' ELSE 'suspended' END);
        ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active';
    END IF;
END $$;

-- profiles: cũng đảm bảo disabled_at (v19 filter p.disabled_at IS NULL)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- 2. shop_members: đảm bảo status + removed_at
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shop_members'
          AND column_name = 'status' AND data_type = 'boolean'
    ) THEN
        ALTER TABLE public.shop_members ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE public.shop_members ALTER COLUMN status TYPE TEXT
            USING (CASE WHEN status THEN 'active' ELSE 'suspended' END);
        ALTER TABLE public.shop_members ALTER COLUMN status SET DEFAULT 'active';
    END IF;
END $$;

-- 3. shops / orders: cũng đảm bảo (một số query legacy tham chiếu)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- =========================================================================
-- XÁC NHẬN: sau khi chạy migration này, query kiểm tra:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('profiles','shop_members') AND column_name IN ('status','removed_at','disabled_at');
-- Rồi chạy lại v19_hardening_gaps.sql (đừng đổi gì ở v19).
-- =========================================================================