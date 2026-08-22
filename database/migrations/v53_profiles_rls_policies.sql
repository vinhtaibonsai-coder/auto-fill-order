-- =========================================================================
-- v53_profiles_rls_policies.sql
-- Thêm chính sách bảo mật RLS cho bảng profiles để cho phép đọc/ghi dữ liệu.
-- Cho phép mỗi người dùng tương tác với profile của họ, và System Admin được quản lý toàn bộ.
-- =========================================================================

-- 1. Cho phép mỗi người dùng đọc profile của chính mình
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 2. Cho phép người dùng cập nhật profile của chính mình
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Cho phép SYSTEM_ADMIN và SUPPORT đọc toàn bộ profile (cần thiết cho trang quản trị Master Admin)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
    )
  );

-- 4. Cho phép SYSTEM_ADMIN cập nhật toàn bộ profile
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

COMMENT ON POLICY "Users can read own profile" ON public.profiles IS 'Cho phép tài khoản tự đọc profile cá nhân.';
COMMENT ON POLICY "Users can update own profile" ON public.profiles IS 'Cho phép tài khoản tự cập nhật profile cá nhân.';
COMMENT ON POLICY "Admins can read all profiles" ON public.profiles IS 'Cho phép Quản trị viên và kỹ thuật đọc toàn bộ danh sách profile.';
COMMENT ON POLICY "Admins can update all profiles" ON public.profiles IS 'Cho phép Quản trị viên cập nhật bất kỳ profile nào.';
