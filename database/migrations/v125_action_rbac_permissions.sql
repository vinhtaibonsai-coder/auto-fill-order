-- =========================================================================
-- Migration v125: Action-based RBAC Permission Catalog & Authorization Helper
-- (Wave 0 Task F01 & F02)
-- =========================================================================

-- 1. BẢNG PERMISSIONS: Seed 13 mã quyền hạn theo danh mục chuẩn
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to permissions" ON public.permissions;
CREATE POLICY "Allow public read access to permissions" ON public.permissions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access to role_permissions" ON public.role_permissions;
CREATE POLICY "Allow public read access to role_permissions" ON public.role_permissions
    FOR SELECT USING (true);

-- Seed 13 Action Permissions
INSERT INTO public.permissions (code, description) VALUES
  ('orders.view', 'Xem danh sách & chi tiết đơn hàng'),
  ('orders.edit', 'Tạo và chỉnh sửa đơn hàng trước submit'),
  ('orders.submit', 'Nộp đơn lên hãng vận chuyển (VNPost, J&T)'),
  ('labels.print', 'In nhãn vận đơn A5/A6'),
  ('labels.reprint', 'In lại nhãn vận đơn (yêu cầu lý do)'),
  ('customers.view_pii', 'Xem số điện thoại và địa chỉ đầy đủ (PII)'),
  ('support.manage', 'Chăm sóc khách hàng & xử lý task CSKH'),
  ('billing.view', 'Xem số dư ví, COD và báo cáo đối soát'),
  ('billing.manage', 'Quản lý nạp tiền, hoàn tiền và cấu hình ví'),
  ('team.manage', 'Mời thành viên, chỉnh sửa vai trò nhân viên'),
  ('channels.manage', 'Quản lý kết nối kênh mạng xã hội (Facebook/Zalo)'),
  ('api_keys.manage', 'Tạo, thu hồi và cấu hình API Key / MCP partner'),
  ('audit.view', 'Xem nhật ký kiểm toán và lịch sử thao tác')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- 2. ĐẢM BẢO 5 VAI TRÒ CHUẨN CỬA HÀNG TRONG public.roles
INSERT INTO public.roles (code, name, description) VALUES
  ('SHOP_OWNER', 'Chủ cửa hàng (Owner)', 'Toàn quyền điều hành mọi hoạt động của shop'),
  ('MANAGER', 'Quản lý (Manager)', 'Quản lý vận hành đơn hàng, nhân viên và cấu hình shop'),
  ('PACKER', 'Đóng gói & Kho (Packer)', 'Xử lý đơn, in nhãn vận đơn và nộp carrier'),
  ('CSKH', 'Chăm sóc khách hàng (CSKH)', 'Xem đơn, giải quyết khiếu nại và tương tác khách'),
  ('ACCOUNTANT', 'Kế toán (Accountant)', 'Theo dõi công nợ COD, dòng tiền và đối soát tài chính')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 3. GÁN MA TRẬN QUYỀN HẠN (ROLE_PERMISSIONS)
DO $$
DECLARE
    v_role_id UUID;
BEGIN
    -- SHOP_OWNER: Toàn bộ quyền
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'SHOP_OWNER';
    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_role_id, p.id FROM public.permissions p
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- MANAGER: Toàn bộ quyền vận hành
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'MANAGER';
    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_role_id, p.id FROM public.permissions p
        WHERE p.code IN (
            'orders.view', 'orders.edit', 'orders.submit', 'labels.print', 'labels.reprint',
            'customers.view_pii', 'support.manage', 'billing.view', 'billing.manage',
            'team.manage', 'channels.manage', 'api_keys.manage', 'audit.view'
        )
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- PACKER: Đơn, Submit, In nhãn, PII
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'PACKER';
    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_role_id, p.id FROM public.permissions p
        WHERE p.code IN (
            'orders.view', 'orders.edit', 'orders.submit', 'labels.print', 'labels.reprint', 'customers.view_pii'
        )
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- CSKH: Xem đơn, Xem PII, Chăm sóc khách hàng
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'CSKH';
    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_role_id, p.id FROM public.permissions p
        WHERE p.code IN (
            'orders.view', 'customers.view_pii', 'support.manage'
        )
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;

    -- ACCOUNTANT: Xem đơn (hạn chế), Đối soát COD, Audit log tài chính
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'ACCOUNTANT';
    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_role_id, p.id FROM public.permissions p
        WHERE p.code IN (
            'orders.view', 'billing.view', 'audit.view'
        )
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
END $$;

-- 4. SERVER AUTHORIZATION HELPER: has_shop_permission_for_user
-- Tuyệt đối không dùng profiles.role làm nguồn quyền (Account Creation Role Invariant)
-- Tuyệt đối không để default values gây mơ hồ overload (PostgreSQL Overload Invariant)
CREATE OR REPLACE FUNCTION public.has_shop_permission_for_user(
    p_shop_id UUID,
    p_permission_code TEXT,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    -- 1. Nếu không có user -> deny
    p_user_id IS NOT NULL
    AND p_shop_id IS NOT NULL
    AND p_permission_code IS NOT NULL
    AND (
      -- 2. System Administrator có toàn quyền
      public.is_system_admin(p_user_id)
      
      -- 3. Chủ cửa hàng thực sự (shops.owner_id) có toàn quyền trong shop của mình
      OR EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = p_shop_id AND s.owner_id = p_user_id
      )
      
      -- 4. Kiểm tra quyền hạn của thành viên shop_members qua bảng role_permissions
      OR EXISTS (
        SELECT 1
        FROM public.shop_members sm
        LEFT JOIN public.roles r ON r.id = sm.role_id OR r.code = UPPER(sm.role)
        LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
        LEFT JOIN public.permissions p ON p.id = rp.permission_id
        WHERE sm.shop_id = p_shop_id
          AND sm.user_id = p_user_id
          AND sm.removed_at IS NULL
          AND COALESCE(sm.status, 'active') = 'active'
          AND (
            -- Owner role trong shop_members có toàn quyền
            UPPER(COALESCE(sm.role, '')) IN ('OWNER', 'SHOP_OWNER')
            -- Hoặc có permission code tương ứng
            OR p.code = p_permission_code
          )
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_shop_permission_for_user(UUID, TEXT, UUID) TO authenticated, anon, service_role;

-- 5. CANONICAL HELPER: has_shop_permission(p_shop_id, p_permission_code)
-- Sử dụng auth.uid(), không có tham số mặc định
CREATE OR REPLACE FUNCTION public.has_shop_permission(
    p_shop_id UUID,
    p_permission_code TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_shop_permission_for_user(p_shop_id, p_permission_code, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.has_shop_permission(UUID, TEXT) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.has_shop_permission(UUID, TEXT) IS 'F02: Server-side authorization helper, deny-by-default, tuân thủ ma trận RBAC và không dùng profiles.role';
