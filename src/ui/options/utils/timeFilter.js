/**
 * Time filter & KPI metrics utility for Team & Order Management
 */

export const TIME_PRESETS = [
  { id: 'ALL', label: 'Toàn thời gian', shortLabel: 'Tất cả' },
  { id: 'TODAY', label: 'Hôm nay', shortLabel: 'Hôm nay' },
  { id: 'YESTERDAY', label: 'Hôm qua', shortLabel: 'Hôm qua' },
  { id: 'LAST_7_DAYS', label: '7 ngày qua', shortLabel: '7 ngày' },
  { id: 'THIS_MONTH', label: 'Tháng này', shortLabel: 'Tháng này' }
];

export const getOrderDate = (order) => {
  if (!order) return null;
  const raw = order.submitted_at || order.submittedAt || order.created_at || order.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

export const isOrderInTimePreset = (order, preset, refDate = new Date()) => {
  if (!preset || preset === 'ALL') return true;
  const orderDate = getOrderDate(order);
  if (!orderDate) return false;

  const now = new Date(refDate);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'TODAY':
      return orderDate >= startOfToday && orderDate <= endOfToday;
    case 'YESTERDAY': {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return orderDate >= startOfYesterday && orderDate <= endOfYesterday;
    }
    case 'LAST_7_DAYS': {
      const startOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return orderDate >= startOf7Days && orderDate <= endOfToday;
    }
    case 'THIS_MONTH': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return orderDate >= startOfMonth && orderDate <= endOfToday;
    }
    default:
      return true;
  }
};

export const filterOrdersByTimePreset = (orders, preset, refDate = new Date()) => {
  if (!Array.isArray(orders) || orders.length === 0) return [];
  if (!preset || preset === 'ALL') return orders;
  return orders.filter(o => isOrderInTimePreset(o, preset, refDate));
};

export const calculateOrdersKPI = (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) {
    return {
      count: 0,
      totalCod: 0,
      trackingCount: 0,
      vnpostCount: 0,
      jtCount: 0,
      hasFullTracking: true
    };
  }

  let totalCod = 0;
  let trackingCount = 0;
  let vnpostCount = 0;
  let jtCount = 0;

  for (const o of orders) {
    totalCod += Number(o.cod_amount || o.codAmount || 0);
    const tr = String(o.tracking_code || o.trackingCode || '').trim();
    if (tr && tr !== '-' && tr !== '—' && tr !== 'chờ cập nhật mã') {
      trackingCount++;
    }
    const p = String(o.platform || '').toLowerCase();
    if (p.includes('vnpost') || p.includes('vietnam')) {
      vnpostCount++;
    } else if (p.includes('jt') || p.includes('j&t')) {
      jtCount++;
    }
  }

  return {
    count: orders.length,
    totalCod,
    trackingCount,
    vnpostCount,
    jtCount,
    hasFullTracking: trackingCount === orders.length
  };
};
