// =========================================================================
// CUSTOMER SUCCESS PLAYBOOK ENGINE & RETENTION SEGMENTS (EPIC C)
// =========================================================================

export const RETENTION_SEGMENTS = {
  HEALTHY: 'HEALTHY',
  USAGE_DROP: 'USAGE_DROP',
  AT_RISK: 'AT_RISK',
  EXPIRING_SOON: 'EXPIRING_SOON',
  PAST_DUE: 'PAST_DUE',
  CHURNED: 'CHURNED'
};

export const PLAYBOOK_DEFINITIONS = {
  EXPIRING_RENEWAL_ASSIST: {
    code: 'EXPIRING_RENEWAL_ASSIST',
    name: 'Hỗ trợ gia hạn gói cước',
    priority: 'HIGH',
    slaHours: 24,
    channel: 'ZALO_OA',
    cooldownDays: 7
  },
  EXPIRED_RECOVERY: {
    code: 'EXPIRED_RECOVERY',
    name: 'Khôi phục shop quá hạn',
    priority: 'URGENT',
    slaHours: 12,
    channel: 'PHONE_CALL',
    cooldownDays: 3
  },
  USAGE_DROP_DIAGNOSTIC: {
    code: 'USAGE_DROP_DIAGNOSTIC',
    name: 'Thăm hỏi sụt giảm sản lượng đơn',
    priority: 'HIGH',
    slaHours: 48,
    channel: 'ZALO_OA',
    cooldownDays: 14
  },
  CHECK_IN_ASSISTANCE: {
    code: 'CHECK_IN_ASSISTANCE',
    name: 'Chăm sóc định kỳ phòng ngừa rủi ro',
    priority: 'MEDIUM',
    slaHours: 72,
    channel: 'IN_APP_MESSAGE',
    cooldownDays: 14
  }
};

/**
 * Đánh giá phân khúc sức khỏe (Retention Segment) với baseline 28 ngày
 * Invariant: Shop mới (< 14 ngày hoặc < 10 đơn mẫu) không bao giờ bị gắn cờ USAGE_DROP sai.
 */
export function evaluateRetentionSegment(metrics = {}) {
  const {
    shopAgeDays = 0,
    baselineWeeklyOrders = 0,
    currentWeeklyOrders = 0,
    daysUntilExpiration = 999
  } = metrics;

  // 1. Quá hạn gói cước (Past Due)
  if (daysUntilExpiration <= 0) {
    return {
      segment: RETENTION_SEGMENTS.PAST_DUE,
      priority: 'URGENT',
      riskScore: 95,
      reason: 'Gói cước đã hết hạn'
    };
  }

  // 2. Sắp hết hạn trong vòng 5 ngày
  if (daysUntilExpiration <= 5) {
    return {
      segment: RETENTION_SEGMENTS.EXPIRING_SOON,
      priority: 'HIGH',
      riskScore: 80,
      reason: `Gói cước sắp hết hạn sau ${daysUntilExpiration} ngày`
    };
  }

  // 3. Sụt giảm đơn (Usage Drop) - Chỉ đánh giá khi shop đủ thâm niên >= 14 ngày
  if (shopAgeDays >= 14 && baselineWeeklyOrders >= 5) {
    const dropAmount = baselineWeeklyOrders - currentWeeklyOrders;
    const dropRatio = dropAmount / baselineWeeklyOrders;

    if (dropRatio >= 0.40) {
      const riskScore = Math.min(90, Math.round(50 + dropRatio * 40));
      return {
        segment: RETENTION_SEGMENTS.USAGE_DROP,
        priority: 'HIGH',
        riskScore,
        reason: `Sản lượng tuần giảm ${Math.round(dropRatio * 100)}% so với trung bình 28 ngày (${currentWeeklyOrders} vs ${baselineWeeklyOrders})`
      };
    }
  }

  // 4. Có nguy cơ (At Risk) trong 14 ngày tới
  if (daysUntilExpiration <= 14) {
    return {
      segment: RETENTION_SEGMENTS.AT_RISK,
      priority: 'MEDIUM',
      riskScore: 50,
      reason: `Gói cước đến hạn trong 2 tuần tới (${daysUntilExpiration} ngày)`
    };
  }

  // 5. Khỏe mạnh (Healthy)
  return {
    segment: RETENTION_SEGMENTS.HEALTHY,
    priority: 'LOW',
    riskScore: 15,
    reason: 'Hoạt động ổn định'
  };
}

/**
 * Tạo công việc CSKH tự động theo Playbook với bảo đảm chống trùng lặp (Idempotent)
 */
export function generatePlaybookTask(shopContext = {}, existingOpenTasks = []) {
  const { shopId, segment, riskScore = 50, daysUntilExpiration = 999 } = shopContext;

  let playbookCode = null;
  if (segment === RETENTION_SEGMENTS.PAST_DUE) {
    playbookCode = 'EXPIRED_RECOVERY';
  } else if (segment === RETENTION_SEGMENTS.EXPIRING_SOON) {
    playbookCode = 'EXPIRING_RENEWAL_ASSIST';
  } else if (segment === RETENTION_SEGMENTS.USAGE_DROP) {
    playbookCode = 'USAGE_DROP_DIAGNOSTIC';
  } else if (segment === RETENTION_SEGMENTS.AT_RISK) {
    playbookCode = 'CHECK_IN_ASSISTANCE';
  }

  if (!playbookCode) {
    return { created: false, reason: 'NO_PLAYBOOK_FOR_SEGMENT' };
  }

  // Chống trùng: kiểm tra task đang mở của shop_id + playbook_code
  const hasOpen = existingOpenTasks.some(
    t => t.shop_id === shopId && t.playbook_code === playbookCode && ['NEW', 'IN_PROGRESS', 'WAITING_REPLY'].includes(t.status)
  );

  if (hasOpen) {
    return { created: false, reason: 'TASK_ALREADY_OPEN' };
  }

  const def = PLAYBOOK_DEFINITIONS[playbookCode];
  const now = new Date();
  const dueAt = new Date(now.getTime() + def.slaHours * 60 * 60 * 1000).toISOString();

  const task = {
    shop_id: shopId,
    playbook_code: playbookCode,
    playbook_name: def.name,
    segment,
    priority: def.priority,
    status: 'NEW',
    due_at: dueAt,
    risk_score: riskScore,
    suggested_channel: def.channel,
    reason: `Tự động kích hoạt bởi Playbook ${def.name}`
  };

  return {
    created: true,
    task
  };
}
