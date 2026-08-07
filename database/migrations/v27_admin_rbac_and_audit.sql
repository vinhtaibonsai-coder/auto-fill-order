-- =================================================================================
-- v27_admin_rbac_and_audit.sql
-- Master Plan: PHASE 0 - Admin Data Layer + Security
-- =================================================================================

-- 1. TẠO BẢNG ADMIN AUDIT LOGS
-- Lưu vết toàn bộ các hành động nhạy cảm của Master Admin / Shop Admin
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL, -- e.g., 'ADMIN_SUSPEND_SHOP', 'ADMIN_CHANGE_PLAN'
    target_id VARCHAR(255) NOT NULL, -- ID của entity bị tác động (shop_id, user_id, config_key)
    target_type VARCHAR(100) NOT NULL, -- 'shop', 'user', 'config', 'subscription'
    before_state JSONB, -- Trạng thái trước khi đổi (nếu có)
    after_state JSONB, -- Trạng thái sau khi đổi
    result VARCHAR(50) DEFAULT 'SUCCESS', -- 'SUCCESS' hoặc 'FAILED'
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Thêm index cho truy vấn audit
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_id ON public.admin_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- Bật RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admin chỉ được đọc (và Master Admin)
-- Mọi người được phép insert nếu qua RPC hoặc backend có quyền
DROP POLICY IF EXISTS "Allow admin read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Allow admin read audit logs" ON public.admin_audit_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role IN ('ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'))
    )
);

DROP POLICY IF EXISTS "Allow service role write audit logs" ON public.admin_audit_logs;
CREATE POLICY "Allow service role write audit logs" ON public.admin_audit_logs
FOR ALL USING (true) WITH CHECK (true); -- RPC chạy với Security Definer tự động qua

-- 2. TẠO RPC get_admin_kpis()
-- Tối ưu hoá truy vấn lấy tất cả metrics cần cho trang Overview của Master Admin
CREATE OR REPLACE FUNCTION public.get_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Chạy dưới quyền admin/người tạo để bỏ qua RLS
AS $$
DECLARE
    result JSONB;
    _shops_total INT;
    _shops_active INT;
    _shops_trial INT;
    _shops_suspended INT;
    _users_total INT;
    _users_active INT;
    _orders_total INT;
    _orders_today INT;
    _ai_requests_total INT;
    _ai_requests_today INT;
    _ai_tokens_today INT;
    _ai_errors_today INT;
BEGIN
    -- Kiểm tra quyền Admin (Cơ bản)
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Requires Admin role';
    END IF;

    -- Đếm Shops
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'Active'),
        COUNT(*) FILTER (WHERE status = 'Trial'),
        COUNT(*) FILTER (WHERE status = 'Suspended')
    INTO _shops_total, _shops_active, _shops_trial, _shops_suspended
    FROM public.shops;

    -- Đếm Users
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE is_active = true)
    INTO _users_total, _users_active
    FROM public.profiles;

    -- Đếm Orders (nếu bảng orders tồn tại)
    -- *Giả định bảng orders tồn tại hoặc đếm từ logs*
    -- Tạm thời lấy giả định từ logic business nếu chưa có bảng
    _orders_total := 0;
    _orders_today := 0;
    
    BEGIN
        EXECUTE 'SELECT COUNT(*), COUNT(*) FILTER (WHERE created_at >= current_date) FROM public.orders'
        INTO _orders_total, _orders_today;
    EXCEPTION WHEN undefined_table THEN
        _orders_total := 0;
        _orders_today := 0;
    END;

    -- Thống kê AI Usage Logs
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE created_at >= current_date),
        COALESCE(SUM(used_tokens) FILTER (WHERE created_at >= current_date), 0),
        COUNT(*) FILTER (WHERE created_at >= current_date AND status = 'error')
    INTO _ai_requests_total, _ai_requests_today, _ai_tokens_today, _ai_errors_today
    FROM public.ai_usage_logs;

    -- Build JSON Response
    result := jsonb_build_object(
        'shops_total', _shops_total,
        'shops_active', _shops_active,
        'shops_trial', _shops_trial,
        'shops_suspended', _shops_suspended,
        'users_total', _users_total,
        'users_active', _users_active,
        'orders_total', _orders_total,
        'orders_today', _orders_today,
        'ai_requests_total', _ai_requests_total,
        'ai_requests_today', _ai_requests_today,
        'ai_tokens_today', _ai_tokens_today,
        'ai_errors_today', _ai_errors_today,
        'sync_failures', 0, -- Stub for future
        'system_errors', 0  -- Stub for future
    );

    RETURN result;
END;
$$;
