-- v65: Team 360, device seats, secure invites and session/device management.
-- Additive and idempotent; designed for the current commercial baseline.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS os_info TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS client_version TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS last_location TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_extension_devices_user_device_id ON public.extension_devices(user_id, device_id);

CREATE TABLE IF NOT EXISTS public.shop_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT 'LINK_INVITE',
  role TEXT NOT NULL DEFAULT 'STAFF' CHECK (UPPER(role) IN ('MANAGER','STAFF','VIEWER')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','EXPIRED','REVOKED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_invites_shop_status ON public.shop_invites(shop_id, status, created_at DESC);
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop managers read invites" ON public.shop_invites;
CREATE POLICY "Shop managers read invites" ON public.shop_invites FOR SELECT TO authenticated
USING (public.is_shop_owner_or_manager(shop_id));

CREATE OR REPLACE FUNCTION public.owner_get_members_v3(p_shop_id UUID)
RETURNS TABLE(member_id UUID, user_id UUID, email TEXT, full_name TEXT, avatar_url TEXT, role_code TEXT, status TEXT, created_at TIMESTAMPTZ, orders_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN RAISE EXCEPTION 'Không có quyền quản lý đội ngũ cửa hàng.'; END IF;
  RETURN QUERY SELECT sm.id, sm.user_id, COALESCE(p.email, 'Chưa kích hoạt'), COALESCE(NULLIF(p.full_name,''), split_part(p.email,'@',1), 'Thành viên'), p.avatar_url,
    UPPER(sm.role), UPPER(COALESCE(sm.status,'active')), sm.created_at,
    (SELECT count(*) FROM public.submitted_orders so WHERE so.shop_id=p_shop_id AND so.submitted_by=sm.user_id AND so.deleted_at IS NULL)
  FROM public.shop_members sm LEFT JOIN public.profiles p ON p.id=sm.user_id
  WHERE sm.shop_id=p_shop_id AND sm.removed_at IS NULL
  ORDER BY CASE UPPER(sm.role) WHEN 'OWNER' THEN 1 WHEN 'SHOP_OWNER' THEN 1 WHEN 'MANAGER' THEN 2 WHEN 'SHOP_MANAGER' THEN 2 WHEN 'STAFF' THEN 3 ELSE 4 END, sm.created_at;
END; $$;

CREATE OR REPLACE FUNCTION public.owner_create_invite_link(p_shop_id UUID, p_role TEXT DEFAULT 'STAFF')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token TEXT := encode(gen_random_bytes(24),'hex');
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN RETURN jsonb_build_object('success',false,'message','Không đủ quyền tạo link mời.'); END IF;
  IF UPPER(p_role) NOT IN ('MANAGER','STAFF','VIEWER') THEN RETURN jsonb_build_object('success',false,'message','Vai trò không hợp lệ.'); END IF;
  INSERT INTO public.shop_invites(shop_id,email,role,token,invited_by) VALUES(p_shop_id,'LINK_INVITE',UPPER(p_role),v_token,auth.uid());
  RETURN jsonb_build_object('success',true,'token',v_token,'invite_url','#/join?token='||v_token);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_create_email_invite(p_shop_id UUID, p_email TEXT, p_role TEXT DEFAULT 'STAFF')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token TEXT := encode(gen_random_bytes(24),'hex');
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN RETURN jsonb_build_object('success',false,'message','Không đủ quyền mời thành viên.'); END IF;
  IF p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR UPPER(p_role) NOT IN ('MANAGER','STAFF','VIEWER') THEN RETURN jsonb_build_object('success',false,'message','Email hoặc vai trò không hợp lệ.'); END IF;
  UPDATE public.shop_invites SET status='REVOKED' WHERE shop_id=p_shop_id AND lower(email)=lower(p_email) AND status='PENDING';
  INSERT INTO public.shop_invites(shop_id,email,role,token,invited_by) VALUES(p_shop_id,lower(p_email),UPPER(p_role),v_token,auth.uid());
  RETURN jsonb_build_object('success',true,'token',v_token,'invite_url','#/join?token='||v_token);
END; $$;

CREATE OR REPLACE FUNCTION public.accept_shop_invite(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.shop_invites%ROWTYPE; v_email TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.shop_invites WHERE token=p_token FOR UPDATE;
  IF NOT FOUND OR v_inv.status<>'PENDING' OR v_inv.expires_at<=now() THEN RETURN jsonb_build_object('success',false,'message','Link mời không hợp lệ hoặc đã hết hạn.'); END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid();
  IF v_inv.email<>'LINK_INVITE' AND lower(v_inv.email)<>v_email THEN RETURN jsonb_build_object('success',false,'message','Lời mời không dành cho tài khoản này.'); END IF;
  INSERT INTO public.shop_members(shop_id,user_id,role,status,invited_by,invite_token,invite_expires_at)
  VALUES(v_inv.shop_id,auth.uid(),v_inv.role,'active',v_inv.invited_by,v_inv.token,v_inv.expires_at)
  ON CONFLICT(shop_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active',removed_at=NULL,invited_by=EXCLUDED.invited_by;
  UPDATE public.shop_invites SET status='ACCEPTED',accepted_by=auth.uid(),accepted_at=now() WHERE id=v_inv.id;
  RETURN jsonb_build_object('success',true,'shop_id',v_inv.shop_id);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_update_member_v3(p_shop_id UUID,p_member_id UUID,p_action TEXT,p_value TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_target public.shop_members%ROWTYPE;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN RETURN jsonb_build_object('success',false,'message','Không đủ quyền.'); END IF;
  SELECT * INTO v_target FROM public.shop_members WHERE id=p_member_id AND shop_id=p_shop_id AND removed_at IS NULL;
  IF NOT FOUND OR UPPER(v_target.role) IN ('OWNER','SHOP_OWNER') THEN RETURN jsonb_build_object('success',false,'message','Không thể cập nhật thành viên này.'); END IF;
  CASE UPPER(p_action)
    WHEN 'ROLE' THEN IF UPPER(p_value) NOT IN ('MANAGER','STAFF','VIEWER') THEN RETURN jsonb_build_object('success',false,'message','Vai trò không hợp lệ.'); END IF; UPDATE public.shop_members SET role=UPPER(p_value),updated_at=now() WHERE id=p_member_id;
    WHEN 'SUSPEND' THEN UPDATE public.shop_members SET status='suspended',updated_at=now() WHERE id=p_member_id;
    WHEN 'ACTIVATE' THEN UPDATE public.shop_members SET status='active',updated_at=now() WHERE id=p_member_id;
    WHEN 'REMOVE' THEN UPDATE public.shop_members SET removed_at=now(),status='removed',updated_at=now() WHERE id=p_member_id;
    ELSE RETURN jsonb_build_object('success',false,'message','Thao tác không hợp lệ.');
  END CASE;
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_get_devices_v2(p_shop_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_devices JSONB; v_max INT;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN RAISE EXCEPTION 'Không có quyền quản lý thiết bị.'; END IF;
  SELECT COALESCE(s.max_devices,q.max_devices,1) INTO v_max FROM public.subscriptions s FULL JOIN public.shop_quotas q ON q.shop_id=s.shop_id WHERE COALESCE(s.shop_id,q.shop_id)=p_shop_id LIMIT 1;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.last_seen DESC),'[]'::jsonb) INTO v_devices FROM (
    SELECT d.id,d.device_id,d.device_name,d.browser,d.version AS client_version,d.os_info,d.last_ip,d.last_location,d.last_seen,d.revoked,p.email
    FROM public.extension_devices d JOIN public.shop_members sm ON sm.user_id=d.user_id AND sm.shop_id=p_shop_id AND sm.removed_at IS NULL
    LEFT JOIN public.profiles p ON p.id=d.user_id
  ) t;
  RETURN jsonb_build_object('devices',v_devices,'max_devices',COALESCE(v_max,1));
END; $$;

CREATE OR REPLACE FUNCTION public.owner_update_device_name(p_device_id UUID,p_device_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop UUID;
BEGIN
  SELECT sm.shop_id INTO v_shop FROM public.extension_devices d JOIN public.shop_members sm ON sm.user_id=d.user_id AND sm.removed_at IS NULL WHERE d.id=p_device_id LIMIT 1;
  IF v_shop IS NULL OR NOT public.is_shop_owner_or_manager(v_shop) THEN RETURN jsonb_build_object('success',false,'message','Không đủ quyền hoặc không tìm thấy thiết bị.'); END IF;
  UPDATE public.extension_devices SET device_name=left(trim(p_device_name),80) WHERE id=p_device_id;
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_revoke_device_v2(p_device_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop UUID;
BEGIN
  SELECT sm.shop_id INTO v_shop FROM public.extension_devices d JOIN public.shop_members sm ON sm.user_id=d.user_id AND sm.removed_at IS NULL WHERE d.id=p_device_id LIMIT 1;
  IF v_shop IS NULL OR NOT public.is_shop_owner_or_manager(v_shop) THEN RETURN jsonb_build_object('success',false,'message','Không đủ quyền hoặc không tìm thấy thiết bị.'); END IF;
  UPDATE public.extension_devices SET revoked=true,last_seen=now() WHERE id=p_device_id;
  INSERT INTO public.audit_logs(shop_id,user_id,action,entity_type,entity_id,details) VALUES(v_shop,auth.uid(),'DEVICE_REVOKED','device',p_device_id::text,jsonb_build_object('remote_kill',true));
  RETURN jsonb_build_object('success',true,'revoked',true);
END; $$;

GRANT EXECUTE ON FUNCTION public.owner_get_members_v3(UUID), public.owner_create_invite_link(UUID,TEXT), public.owner_create_email_invite(UUID,TEXT,TEXT), public.accept_shop_invite(TEXT), public.owner_update_member_v3(UUID,UUID,TEXT,TEXT), public.owner_get_devices_v2(UUID), public.owner_update_device_name(UUID,TEXT), public.owner_revoke_device_v2(UUID) TO authenticated;
