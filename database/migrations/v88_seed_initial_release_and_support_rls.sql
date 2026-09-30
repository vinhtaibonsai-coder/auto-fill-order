-- ============================================================================
-- Migration v88: Seed Initial Release v1.0.0 & Support Tickets RLS + RPC
-- ============================================================================

-- 1. Ensure release_versions table and initial v1.0.0 release
CREATE TABLE IF NOT EXISTS public.release_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  min_supported_version TEXT,
  is_force_update BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 100,
  release_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.release_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_release_versions" ON public.release_versions;
CREATE POLICY "read_release_versions" ON public.release_versions 
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "admin_manage_release_versions" ON public.release_versions;
CREATE POLICY "admin_manage_release_versions" ON public.release_versions 
  FOR ALL USING (public.is_system_admin());

-- Seed initial GA release v1.0.0 if not exists
INSERT INTO public.release_versions (
  version,
  min_supported_version,
  is_force_update,
  rollout_percentage,
  release_notes
)
VALUES (
  '1.0.0',
  '1.0.0',
  false,
  100,
  'Phiên bản phát hành chính thức đầu tiên (GA). Tích hợp bóc tách đơn hàng AI siêu tốc, tự động điền đơn VNPost & J&T Express, đồng bộ đa máy trạm và Master Admin SaaS Control Plane.'
)
ON CONFLICT (version) DO NOTHING;

-- 2. Support Tickets Table, RLS & RPC
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  description TEXT,
  admin_reply TEXT,
  internal_note TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Allow shop members & owners & creators to view tickets
DROP POLICY IF EXISTS "shop_members_read_support_tickets" ON public.support_tickets;
CREATE POLICY "shop_members_read_support_tickets" ON public.support_tickets
  FOR SELECT USING (
    public.is_system_admin() OR
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = support_tickets.shop_id AND s.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.shop_id = support_tickets.shop_id
        AND sm.user_id = auth.uid()
        AND sm.removed_at IS NULL
    )
  );

-- Allow all authenticated users to submit tickets
DROP POLICY IF EXISTS "shop_members_insert_support_tickets" ON public.support_tickets;
CREATE POLICY "shop_members_insert_support_tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Allow system admin to manage all tickets
DROP POLICY IF EXISTS "admin_manage_support_tickets" ON public.support_tickets;
CREATE POLICY "admin_manage_support_tickets" ON public.support_tickets
  FOR ALL USING (public.is_system_admin());

-- RPC Create Support Ticket (Security Definer)
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_shop_id UUID,
  p_subject TEXT,
  p_category TEXT DEFAULT 'general',
  p_priority TEXT DEFAULT 'normal',
  p_description TEXT DEFAULT ''
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ticket_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NULLIF(trim(p_subject), '') IS NULL THEN
    RAISE EXCEPTION 'SUBJECT_REQUIRED';
  END IF;

  INSERT INTO public.support_tickets (
    shop_id,
    user_id,
    subject,
    category,
    priority,
    description,
    status
  )
  VALUES (
    p_shop_id,
    v_user_id,
    trim(p_subject),
    COALESCE(NULLIF(trim(p_category),''), 'general'),
    COALESCE(NULLIF(trim(p_priority),''), 'normal'),
    trim(COALESCE(p_description, '')),
    'open'
  )
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object('success', true, 'id', v_ticket_id);
END $$;

GRANT EXECUTE ON FUNCTION public.create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated, anon;
GRANT ALL ON public.support_tickets TO service_role;
GRANT SELECT ON public.release_versions TO authenticated, anon;
GRANT ALL ON public.release_versions TO service_role;
