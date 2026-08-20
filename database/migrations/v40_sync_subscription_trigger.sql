-- =========================================================================
-- v40_sync_subscription_trigger.sql
-- Trigger tự động đồng bộ hạn ngạch (shop_quotas) khi trạng thái thanh toán
-- / gói cước (subscriptions) thay đổi.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.sync_subscription_to_quotas()
RETURNS TRIGGER AS $$
BEGIN
  -- Nếu subscription không hoạt động (hết hạn hoặc bị hủy), hạ cấp về gói FREE mặc định
  IF NEW.status != 'active' AND NEW.status != 'trialing' THEN
    INSERT INTO public.shop_quotas (
      shop_id,
      max_devices,
      max_users,
      monthly_order_limit,
      daily_ai_limit,
      expires_at,
      notes,
      updated_at
    )
    VALUES (
      NEW.shop_id,
      1, -- FREE limit
      1, -- FREE limit
      300,
      50,
      NEW.current_period_end,
      'Gói cước của bạn đã hết hạn hoặc bị hủy. Hệ thống tự động hạ cấp về gói miễn phí (FREE).',
      now()
    )
    ON CONFLICT (shop_id)
    DO UPDATE SET
      max_devices = 1,
      max_users = 1,
      monthly_order_limit = 300,
      daily_ai_limit = 50,
      expires_at = EXCLUDED.expires_at,
      notes = 'Gói cước đã hết hạn hoặc bị hủy. Hạ cấp về gói miễn phí (FREE).',
      updated_at = now();
  ELSE
    -- Đồng bộ hạn ngạch của gói hoạt động
    INSERT INTO public.shop_quotas (
      shop_id,
      max_devices,
      max_users,
      monthly_order_limit,
      daily_ai_limit,
      expires_at,
      notes,
      updated_at
    )
    VALUES (
      NEW.shop_id,
      NEW.max_devices,
      NEW.max_users,
      CASE 
        WHEN NEW.plan_code = 'FREE' THEN 300
        WHEN NEW.plan_code = 'PRO' THEN 5000
        WHEN NEW.plan_code = 'BUSINESS' THEN 30000
        ELSE 5000
      END,
      NEW.max_ai_requests,
      NEW.current_period_end,
      'Đồng bộ tự động từ cổng thanh toán cho gói ' || NEW.plan_code,
      now()
    )
    ON CONFLICT (shop_id)
    DO UPDATE SET
      max_devices = EXCLUDED.max_devices,
      max_users = EXCLUDED.max_users,
      monthly_order_limit = EXCLUDED.monthly_order_limit,
      daily_ai_limit = EXCLUDED.daily_ai_limit,
      expires_at = EXCLUDED.expires_at,
      notes = EXCLUDED.notes,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger lắng nghe bảng subscriptions
DROP TRIGGER IF EXISTS tr_sync_subscription_to_quotas ON public.subscriptions;
CREATE TRIGGER tr_sync_subscription_to_quotas
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_subscription_to_quotas();

COMMENT ON FUNCTION public.sync_subscription_to_quotas IS 'Đồng bộ hạn ngạch hoạt động của shop từ các bản ghi thanh toán gói cước.';
