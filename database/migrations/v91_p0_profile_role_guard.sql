-- =============================================================================
-- Migration v91: P0-3 Trigger chặn profiles.role lệch
-- Incident: 2026-08-29-admin-create-shop-profiles-role-check
-- Invariant: profiles.role là legacy, chỉ cho phép 'member' hoặc NULL.
-- Real roles thuộc user_roles và shop_members.
-- =============================================================================

-- Guard function
CREATE OR REPLACE FUNCTION public.guard_profiles_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Chỉ cho phép NULL hoặc 'member' (case-sensitive theo legacy)
  IF NEW.role IS NOT NULL AND NEW.role <> 'member' THEN
    RAISE EXCEPTION 'P0_3_GUARD: profiles.role must be ''member'' or NULL (got %). Real roles belong in user_roles/shop_members.', NEW.role
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_guard ON public.profiles;
CREATE TRIGGER trg_profiles_role_guard
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_role();

-- Đảm bảo RUN_ALL_MIGRATIONS có include (append tự động khi build, không cần edit ở đây)

COMMENT ON FUNCTION public.guard_profiles_role() IS 'P0-3: profiles.role legacy guard - only member/NULL allowed';
