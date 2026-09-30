-- =========================================================================
-- Migration v71: Cho phép Master Admin tạo nhiều Shop/Chi nhánh cho tài khoản
-- =========================================================================

CREATE OR REPLACE FUNCTION public.trg_limit_shops_per_owner_func()
RETURNS TRIGGER AS $$
DECLARE
  v_max_shops INT;
  v_current_shops INT;
BEGIN
  -- 1. Nếu người thực hiện là Master Admin (System Admin) -> Bỏ qua giới hạn
  IF public.is_system_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Bỏ qua nếu shop bị xóa mềm (deleted_at IS NOT NULL) hoặc trạng thái không active
  IF NEW.deleted_at IS NOT NULL OR NEW.status = 'inactive' OR NEW.status = 'deleted' THEN
    RETURN NEW;
  END IF;

  -- 3. Lấy giới hạn shop của user
  v_max_shops := public.get_user_max_shops(NEW.owner_id);

  -- 4. Đếm số shop hoạt động hiện tại
  SELECT COUNT(*) INTO v_current_shops
  FROM public.shops
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND status = 'active'
    AND id <> NEW.id;

  IF v_current_shops >= v_max_shops THEN
    RAISE EXCEPTION 'Tài khoản của bạn chỉ được sở hữu tối đa % cửa hàng hoạt động ở gói cước hiện tại. Vui lòng nâng cấp gói cước để thêm chi nhánh/cửa hàng mới.', v_max_shops;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_limit_shops_per_owner ON public.shops;
CREATE TRIGGER trg_limit_shops_per_owner
BEFORE INSERT OR UPDATE OF owner_id, deleted_at, status ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.trg_limit_shops_per_owner_func();
