-- Drop older conflicting function signatures to resolve PostgREST overload error
DROP FUNCTION IF EXISTS public.consume_ai_quota(UUID, INT, TEXT, TEXT);
