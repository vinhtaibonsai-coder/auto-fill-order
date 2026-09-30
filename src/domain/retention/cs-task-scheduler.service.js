// =========================================================================
// CUSTOMER SUCCESS TASK SCHEDULER & PLAYBOOK RUNNER (EPIC C)
// Executes periodic and on-demand retention evaluations and task generation.
// =========================================================================

/**
 * Kích hoạt đánh giá sức khỏe và tạo công việc CSKH tự động cho Shop
 */
export async function evaluateShopRetentionTasks(shopId) {
  if (!shopId) return { success: false, error: 'SHOP_ID_REQUIRED' };

  try {
    const clientCloud = typeof SupabaseCloud !== 'undefined' ? SupabaseCloud : (globalThis.SupabaseCloud || null);
    if (clientCloud && typeof clientCloud.rpc === 'function') {
      const res = await clientCloud.rpc('evaluate_and_generate_cs_tasks', { p_shop_id: shopId });
      return res || { success: true };
    }

    // Direct REST API Fallback
    const config = await clientCloud?.loadConfig?.();
    const sess = typeof AuthSession !== 'undefined' ? await AuthSession.getSession() : null;
    if (config?.url && sess?.access_token) {
      const res = await fetch(`${config.url}/rest/v1/rpc/evaluate_and_generate_cs_tasks`, {
        method: 'POST',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_shop_id: shopId })
      });
      if (res.ok) {
        return await res.json();
      }
    }

    return { success: false, reason: 'SUPABASE_CLIENT_NOT_AVAILABLE' };
  } catch (err) {
    console.warn('[CsTaskScheduler] Evaluation failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Kiểm tra và thực thi đánh giá hằng ngày với cơ chế Cooldown (24 giờ)
 * Đảm bảo không spam cơ sở dữ liệu nếu người dùng mở workspace nhiều lần trong ngày.
 */
export async function checkAndRunDailyEvaluation(shopId, force = false) {
  if (!shopId) return { evaluated: false, reason: 'NO_SHOP_ID' };

  const storageKey = `cs_eval_last_run_${shopId}`;
  const lastRun = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  if (!force && lastRun && (now - Number(lastRun) < TWENTY_FOUR_HOURS)) {
    return { evaluated: false, reason: 'COOLDOWN_ACTIVE', lastRun: Number(lastRun) };
  }

  const result = await evaluateShopRetentionTasks(shopId);
  if (result && result.success && typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey, String(now));
  }
  return { evaluated: true, result };
}
