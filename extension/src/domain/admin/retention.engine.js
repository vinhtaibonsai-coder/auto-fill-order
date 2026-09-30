/**
 * Retention & Anti-Churn Intelligence Engine (G009)
 * 
 * Invariants:
 * 1. Single Open Task Per Playbook Invariant:
 *    A shop transitioning segments can have at most ONE open task for the same playbook.
 * 2. Cohort Conversion Denominator Invariant:
 *    Active/open trials are separated from failed trials. Mature conversion rate uses
 *    (total - active_trials) as denominator to prevent false deflation on fresh cohorts.
 *    If no mature trials exist, displays 'N/A' (never a fake 0%).
 * 3. Zero PII leakage in retention notes and exports.
 */

export const PLAYBOOK_CODES = Object.freeze({
  AT_RISK: 'AT_RISK',
  EXPIRING_SOON: 'EXPIRING_SOON',
  CRITICAL: 'CRITICAL',
  MANUAL: 'MANUAL'
});

export const PLAYBOOK_CONFIG = Object.freeze({
  [PLAYBOOK_CODES.AT_RISK]: {
    name: 'At-Risk (Không có đơn)',
    description: 'Shop không phát sinh đơn 3 ngày liên tiếp. Cần kiểm tra kỹ thuật hoặc liên hệ hỗ trợ vận hành.',
    actionType: 'CALL',
    defaultDueDays: 1,
    priority: 'HIGH'
  },
  [PLAYBOOK_CODES.EXPIRING_SOON]: {
    name: 'Expiring Soon (Sắp hết hạn)',
    description: 'Gói dịch vụ hết hạn trong vòng 3 ngày. Tư vấn ưu đãi gia hạn hoặc nâng cấp tính năng.',
    actionType: 'OFFER',
    defaultDueDays: 2,
    priority: 'URGENT'
  },
  [PLAYBOOK_CODES.CRITICAL]: {
    name: 'Critical (Quá hạn / Đã hủy)',
    description: 'Gói quá hạn thanh toán hoặc đã hủy. Kích hoạt quy trình win-back khẩn cấp và tìm hiểu lý do rời bỏ.',
    actionType: 'CALL',
    defaultDueDays: 1,
    priority: 'CRITICAL'
  },
  [PLAYBOOK_CODES.MANUAL]: {
    name: 'CSKH Thủ công',
    description: 'Chăm sóc khách hàng hoặc hỗ trợ kỹ thuật phát sinh theo yêu cầu.',
    actionType: 'NOTE',
    defaultDueDays: 3,
    priority: 'NORMAL'
  }
});

export const TASK_OUTCOMES = Object.freeze({
  RENEWED: 'RENEWED',
  ACTIVE_AGAIN: 'ACTIVE_AGAIN',
  RESOLVED: 'RESOLVED',
  NO_RESPONSE: 'NO_RESPONSE',
  FOLLOW_UP_NEEDED: 'FOLLOW_UP_NEEDED',
  CHURNED: 'CHURNED'
});

export const TASK_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  DONE: 'DONE',
  DISMISSED: 'DISMISSED'
});

/**
 * Enforces the Single-Open-Task Per Playbook Invariant
 * "Một shop chuyển segment tạo tối đa một task đang mở cho cùng playbook."
 */
export function createPlaybookTaskWithDedup(existingTasks = [], newTask = {}) {
  const shopId = newTask.shop_id;
  const playbookCode = (newTask.playbook_code || PLAYBOOK_CODES.MANUAL).toUpperCase();

  if (!shopId) {
    throw new Error('shop_id is required to create a playbook task');
  }

  // Check if an open task already exists for this shop & playbook
  const existingOpenTask = existingTasks.find(
    t => t.shop_id === shopId && 
         (t.playbook_code || '').toUpperCase() === playbookCode && 
         t.status === TASK_STATUSES.OPEN
  );

  if (existingOpenTask) {
    return {
      created: false,
      deduplicated: true,
      task: existingOpenTask,
      message: `Đã có task đang mở cho playbook ${playbookCode} của shop này.`
    };
  }

  const createdTask = {
    id: newTask.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    shop_id: shopId,
    playbook_code: playbookCode,
    action_type: newTask.action_type || PLAYBOOK_CONFIG[playbookCode]?.actionType || 'CALL',
    status: TASK_STATUSES.OPEN,
    assignee_id: newTask.assignee_id || null,
    assignee_name: newTask.assignee_name ? String(newTask.assignee_name).trim() : 'Chưa phân công',
    due_at: newTask.due_at || new Date(Date.now() + (PLAYBOOK_CONFIG[playbookCode]?.defaultDueDays || 2) * 86400000).toISOString(),
    outcome: null,
    next_action: null,
    note: newTask.note ? String(newTask.note).trim() : null,
    segment: newTask.segment || playbookCode,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return {
    created: true,
    deduplicated: false,
    task: createdTask,
    message: 'Tạo task playbook CSKH thành công'
  };
}

/**
 * Calculates cohort conversion metrics separating active trials from failed trials.
 * Denominator for mature conversion excludes active trials to prevent fake low conversion rates
 * for newly onboarded cohorts that haven't concluded their trial window.
 */
export function calculateCohortConversion(cohortData = []) {
  if (!Array.isArray(cohortData)) return [];

  return cohortData.map(c => {
    const total = Number(c.total_shops || 0);
    const activeTrials = Number(c.active_trial_shops || 0);
    const failedTrials = Number(c.failed_trial_shops || 0);
    const converted = Number(c.converted_shops || 0);
    const activeOrders = Number(c.active_orders_shops || 0);

    // Raw conversion: all shops in cohort
    const rawRate = total > 0 ? Number(((converted / total) * 100).toFixed(1)) : null;

    // Mature conversion: denominator = total - active_trials
    const matureDenominator = total - activeTrials;
    const matureRate = matureDenominator > 0 ? Number(((converted / matureDenominator) * 100).toFixed(1)) : null;

    return {
      cohort_month: c.cohort_month,
      total_shops: total,
      active_trial_shops: activeTrials,
      failed_trial_shops: failedTrials,
      converted_shops: converted,
      active_orders_shops: activeOrders,
      raw_conversion_percent: rawRate,
      raw_conversion_display: rawRate !== null ? `${rawRate}%` : 'N/A',
      mature_conversion_percent: matureRate,
      mature_conversion_display: matureRate !== null ? `${matureRate}%` : 'N/A'
    };
  });
}

/**
 * Compares previous snapshot segments to current portfolio health,
 * detecting segment degradation (e.g. HEALTHY -> AT_RISK or EXPIRING_SOON).
 */
export function evaluateSegmentTransitions(previousSnapshots = [], currentPortfolio = []) {
  const prevMap = new Map();
  for (const s of previousSnapshots) {
    if (s.shop_id) {
      prevMap.set(s.shop_id, s.segment);
    }
  }

  const transitions = [];

  for (const shop of currentPortfolio) {
    const prevSegment = prevMap.get(shop.shop_id) || 'HEALTHY';
    const currSegment = shop.segment || 'HEALTHY';

    // Transition into a risk segment
    if (currSegment !== 'HEALTHY' && currSegment !== prevSegment) {
      let recommendedPlaybook = PLAYBOOK_CODES.MANUAL;
      if (currSegment === 'AT_RISK') recommendedPlaybook = PLAYBOOK_CODES.AT_RISK;
      else if (currSegment === 'EXPIRING_SOON') recommendedPlaybook = PLAYBOOK_CODES.EXPIRING_SOON;
      else if (currSegment === 'CRITICAL') recommendedPlaybook = PLAYBOOK_CODES.CRITICAL;

      transitions.push({
        shop_id: shop.shop_id,
        shop_name: shop.shop_name,
        previous_segment: prevSegment,
        current_segment: currSegment,
        recommended_playbook: recommendedPlaybook,
        detected_at: new Date().toISOString()
      });
    }
  }

  return transitions;
}

/**
 * Sanitizes and exports retention tasks or portfolio rows, ensuring zero PII leak in notes.
 */
export function exportRetentionTasksCsv(tasks = []) {
  const headers = ['Task ID', 'Shop Name', 'Playbook', 'Status', 'Assignee', 'Due Date', 'Outcome', 'Next Action', 'Created At'];
  const rows = (tasks || []).map(t => [
    t.id || '',
    (t.shop_name || t.shop_id || '').replace(/"/g, '""'),
    t.playbook_code || '',
    t.status || '',
    (t.assignee_name || '').replace(/"/g, '""'),
    t.due_at ? new Date(t.due_at).toLocaleDateString('vi-VN') : '',
    t.outcome || '',
    (t.next_action || '').replace(/"/g, '""'),
    t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : ''
  ]);

  return [
    headers.join(','),
    ...rows.map(r => r.map(val => `"${val}"`).join(','))
  ].join('\r\n');
}
