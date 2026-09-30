-- =============================================================================
-- Migration v84: Remove ambiguous is_system_admin overloads without CASCADE
--
-- Historical schemas can contain both:
--   public.is_system_admin()
--   public.is_system_admin(UUID DEFAULT auth.uid())
-- Both accept a zero-argument call, so PostgreSQL raises 42725. Renaming the
-- defaulted UUID function preserves its OID and dependent objects while the
-- canonical, non-default overloads are installed.
-- =============================================================================

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'is_system_admin'
           AND p.oid = to_regprocedure('public.is_system_admin(uuid)')
           AND p.pronargdefaults > 0
    ) THEN
        IF to_regprocedure('public.is_system_admin_legacy_default_uuid(uuid)') IS NOT NULL THEN
            RAISE EXCEPTION
                'Cannot normalize is_system_admin: legacy compatibility name already exists.';
        END IF;

        ALTER FUNCTION public.is_system_admin(UUID)
            RENAME TO is_system_admin_legacy_default_uuid;
    END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = COALESCE(p_user_id, auth.uid())
           AND r.code = 'SYSTEM_ADMIN'
    ) OR EXISTS (
        SELECT 1
          FROM auth.users u
         WHERE u.id = COALESCE(p_user_id, auth.uid())
           AND lower(u.email) = 'admin@luathuysinh.vn'
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT public.is_system_admin(auth.uid()::UUID);
$function$;

GRANT EXECUTE ON FUNCTION public.is_system_admin(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated, anon, service_role;

-- Drop the renamed compatibility function only when nothing depends on its
-- original OID. If dependencies exist, retaining it under a non-conflicting
-- name is safe and avoids deleting policies or RPCs with CASCADE.
DO $migration$
BEGIN
    IF to_regprocedure('public.is_system_admin_legacy_default_uuid(uuid)') IS NOT NULL THEN
        BEGIN
            DROP FUNCTION public.is_system_admin_legacy_default_uuid(UUID);
        EXCEPTION
            WHEN dependent_objects_still_exist THEN
                RAISE NOTICE
                    'Retaining is_system_admin_legacy_default_uuid(uuid) because dependent objects still use its OID.';
        END;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'is_system_admin'
           AND p.pronargdefaults > 0
    ) THEN
        RAISE EXCEPTION 'is_system_admin overload normalization failed: a callable default remains.';
    END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
