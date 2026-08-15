import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import {
  RefreshCw, ArrowUpRight, ArrowDownRight, AlertTriangle,
  CheckCircle2, Clock, X, Eye, Package, Wallet, Zap, WifiOff, Info, Plus
} from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toISO = d => encodeURIComponent(d.toISOString());
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDay = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('vi-VN');

function compactVND(n) {
  if (n >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'M';
  if (n >= 1e3) return (n / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'K';
  return n.toLocaleString('vi-VN');
}

function pctChange(cur, prev) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * base;
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const CARRIER_LABELS = { vnpost: 'VNPost', jt: 'J&T' };
const carrierLabel = p => CARRIER_LABELS[(p || '').toLowerCase()] || (p || '—').toUpperCase();

function statusInfo(row) {
  const s = String(row.status || '').toLowerCase();
  if (s.includes('fail')) return { label: 'Lỗi', tone: 'failed' };
  if (s.includes('submitted')) return { label: 'Đã gửi', tone: 'submitted' };
  if (s.includes('processing')) return { label: 'Đang xử lý', tone: 'draft' };
  if (row.type === 'submitted') return { label: 'Đã gửi', tone: 'submitted' };
  return { label: 'Nháp', tone: 'draft' };
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDay(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const PRESETS = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: '7d', label: '7 ngày qua' },
  { key: '30d', label: '30 ngày qua' },
  { key: 'custom', label: 'Tùy chỉnh' },
];

function computeRange(preset, customStart, customEnd) {
  const now = new Date();
  const d7 = () => ({ curStart: startOfDay(addDays(now, -6)), curEnd: endOfDay(now), prevStart: startOfDay(addDays(now, -13)), prevEnd: endOfDay(addDays(now, -7)) });
  let r = d7();
  if (preset === 'today') {
    const s = startOfDay(now);
    r = { curStart: s, curEnd: endOfDay(now), prevStart: addDays(s, -1), prevEnd: endOfDay(addDays(now, -1)) };
  } else if (preset === 'yesterday') {
    const y = addDays(now, -1);
    r = { curStart: startOfDay(y), curEnd: endOfDay(y), prevStart: startOfDay(addDays(y, -1)), prevEnd: endOfDay(addDays(y, -1)) };
  } else if (preset === '30d') {
    r = { curStart: startOfDay(addDays(now, -29)), curEnd: endOfDay(now), prevStart: startOfDay(addDays(now, -59)), prevEnd: endOfDay(addDays(now, -30)) };
  } else if (preset === 'custom') {
    const s = customStart ? new Date(customStart + 'T00:00:00') : null;
    const e = customEnd ? new Date(customEnd + 'T00:00:00') : null;
    if (s && e && s <= e) {
      const len = Math.round((endOfDay(e) - startOfDay(s)) / 86400000) + 1;
      r = { curStart: startOfDay(s), curEnd: endOfDay(e), prevStart: startOfDay(addDays(s, -len)), prevEnd: endOfDay(addDays(s, -1)) };
    }
  }
  return { cur: { start: r.curStart, end: r.curEnd }, prev: { start: r.prevStart, end: r.prevEnd } };
}

const W = 800;
const H = 280;
const PAD = { t: 14, r: 14, b: 30, l: 52 };

function TrendChart({ buckets, mode, hover, setHover }) {
  const gradId = useId();
  const baseY = H - PAD.b;
  const plotW = W - PAD.l - PAD.r;
  const values = buckets.map(b => (mode === 'revenue' ? b.revenue : b.orders));
  const maxV = niceMax(Math.max(...values, 0));
  const n = buckets.length;
  const stepX = n > 1 ? plotW / (n - 1) : 0;

  const points = buckets.map((b, i) => ({
    x: PAD.l + (n > 1 ? i * stepX : plotW / 2),
    y: baseY - (values[i] / maxV) * (baseY - PAD.t),
    value: values[i],
    label: b.label
  }));

  const lineD = points.length > 1 ? smoothPath(points) : '';
  const areaD = points.length > 1 ? `${lineD} L ${points[points.length - 1].x.toFixed(2)} ${baseY} L ${points[0].x.toFixed(2)} ${baseY} Z` : '';

  const ticks = [];
  for (let i = 0; i <= 4; i++) {
    const v = (maxV * i) / 4;
    ticks.push({ y: baseY - ((baseY - PAD.t) * i) / 4, v });
  }
  const xStep = Math.max(1, Math.ceil((n - 1) / 6));
  const xTicks = [];
  for (let i = 0; i < n; i += xStep) xTicks.push(i);
  if (xTicks[xTicks.length - 1] !== n - 1) xTicks.push(n - 1);

  const fmtVal = v => (mode === 'revenue' ? compactVND(Math.round(v)) : num.format(Math.round(v)));

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < bestD) { bestD = d; best = i; }
    });
    setHover({ i: best, left: Math.max(8, Math.min(92, (points[best].x / W) * 100)), top: (points[best].y / H) * 100 });
  };

  return (
    <div className="dash-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Đồ thị xu hướng ${mode === 'revenue' ? 'doanh thu' : 'đơn hàng'}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={PAD.l - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              {fmtVal(t.v)}
            </text>
          </g>
        ))}
        {xTicks.map(i => (
          <text key={i} x={points[i].x} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {points[i].label}
          </text>
        ))}
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={lineD} fill="none" stroke="var(--brand-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.length === 1 && (
          <circle cx={points[0].x} cy={points[0].y} r="4" fill="var(--brand-500)" stroke="var(--color-surface)" strokeWidth="2" />
        )}
        {hover && points[hover.i] && (
          <g>
            <line x1={points[hover.i].x} x2={points[hover.i].x} y1={PAD.t} y2={baseY} stroke="var(--brand-200)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={points[hover.i].x} cy={points[hover.i].y} r="5" fill="var(--color-surface)" stroke="var(--brand-600)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover && points[hover.i] && (
        <div className="dash-chart-tooltip" style={{ left: `${hover.left}%`, top: `${hover.top}%` }}>
          <strong>{points[hover.i].label}</strong>
          <div>{mode === 'revenue' ? money.format(points[hover.i].value) : num.format(points[hover.i].value)}</div>
        </div>
      )}
      <div className="sr-only" role="table" aria-label="Bảng dữ liệu xu hướng">
        {buckets.map(b => (
          <div key={b.key}>{b.label}: {mode === 'revenue' ? money.format(b.revenue) : num.format(b.orders)}</div>
        ))}
      </div>
    </div>
  );
}

function SkeletonKpi() {
  return <div className="skeleton-box dash-skeleton-kpi" />;
}

function SkeletonCard({ h }) {
  return <div className="skeleton-box dash-skeleton-card" style={{ height: h }} />;
}

function ErrorState({ title, onRetry }) {
  return (
    <div className="dash-state">
      <AlertTriangle size={28} color="var(--danger)" />
      <div className="dash-state-title">{title}</div>
      <div className="dash-state-desc">Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.</div>
      <button className="dash-btn" onClick={onRetry}><RefreshCw size={14} />Thử lại</button>
    </div>
  );
}

function DeltaBadge({ cur, prev, suffix, rate }) {
  const diff = rate ? cur - prev : pctChange(cur, prev);
  const abs = Math.abs(diff);
  if (abs < 0.05) {
    return <span className="dash-kpi-delta dash-delta-flat">—&nbsp;Không đổi</span>;
  }
  const up = diff > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const text = rate ? `${abs.toFixed(1)}${suffix}` : `${(up ? '' : '-')}${abs.toFixed(1)}${suffix || '%'}`;
  return (
    <span className={`dash-kpi-delta ${up ? 'dash-delta-up' : 'dash-delta-down'}`}>
      <Icon size={13} />
      <span>{text} so với kỳ trước</span>
    </span>
  );
}

function KpiCard({ label, icon, iconBg, iconColor, value, sub, delta, onClick }) {
  return (
    <div className={`dash-kpi-card${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <div className="dash-kpi-label">
        <span className="dash-kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</span>
        {label}
      </div>
      <div className="dash-kpi-value">{value}</div>
      {delta}
      <span className="dash-kpi-sub">{sub}</span>
    </div>
  );
}

export default function Overview({ setActiveTab, uiRole }) {
  const canConfigure = uiRole !== 'viewer';

  const [preset, setPreset] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [kpiState, setKpiState] = useState('loading');
  const [alertState, setAlertState] = useState('loading');
  const [recentState, setRecentState] = useState('loading');

  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [rangeLabel, setRangeLabel] = useState('');

  const [chartMode, setChartMode] = useState('revenue');
  const [hover, setHover] = useState(null);

  const [drawerOrder, setDrawerOrder] = useState(null);
  const [kpiErrorMsg, setKpiErrorMsg] = useState('');

  const cancelled = useRef(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  const loadAll = useCallback(async () => {
    const loadId = ++loadSeq.current;
    setKpiState('loading');
    setAlertState('loading');
    setRecentState('loading');
    setKpiErrorMsg('');
    setHover(null);

    const sess = await AuthSession.getSession();
    let config = null;
    try { config = await globalThis.SupabaseCloud.loadConfig(); } catch (e) { config = null; }

    const alive = () => !cancelled.current && loadId === loadSeq.current;
    if (!sess || !sess.active_shop_id || !sess.access_token || !config) {
      const msg = 'Chưa đăng nhập hoặc chưa chọn cửa hàng.';
      if (alive()) {
        setKpiState('error'); setAlertState('error'); setRecentState('error');
        setKpiErrorMsg(msg);
      }
      return;
    }

    const headers = {
      'apikey': config.anonKey,
      'Authorization': `Bearer ${sess.access_token}`,
      'Content-Type': 'application/json'
    };

    const range = computeRange(preset, customStart, customEnd);
    const cur = range.cur;
    const prev = range.prev;
    const shop = sess.active_shop_id;
    const base = config.url + '/rest/v1/';
    const shopFilter = `shop_id=eq.${shop}`;
    const curRange = `created_at=gte.${toISO(cur.start)}&created_at=lte.${toISO(cur.end)}`;
    const prevRange = `created_at=gte.${toISO(prev.start)}&created_at=lte.${toISO(prev.end)}`;

    const fetchRows = async (table, params) => {
      const res = await fetch(base + table + '?' + params, { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    };

    const okOr = r => (r.status === 'fulfilled' ? r.value : null);

    const [ordersCur, ordersPrev, subsCur, subsPrev, aiCur, aiPrev] = await Promise.allSettled([
      fetchRows('orders', `${shopFilter}&deleted_at=is.null&${curRange}&select=id,cod_amount,status,created_at`),
      fetchRows('orders', `${shopFilter}&deleted_at=is.null&${prevRange}&select=id,cod_amount,status,created_at`),
      fetchRows('submitted_orders', `${shopFilter}&${curRange}&select=id,cod_amount,status,submitted_at,created_at`),
      fetchRows('submitted_orders', `${shopFilter}&${prevRange}&select=id,cod_amount,status,submitted_at,created_at`),
      fetchRows('ai_usage_log', `${shopFilter}&request_type=eq.parse&status=eq.success&${curRange}&select=id`),
      fetchRows('ai_usage_log', `${shopFilter}&request_type=eq.parse&status=eq.success&${prevRange}&select=id`)
    ]);

    const coreFailed = ordersCur.status !== 'fulfilled' || ordersPrev.status !== 'fulfilled'
      || subsCur.status !== 'fulfilled' || subsPrev.status !== 'fulfilled';

    if (alive()) {
      if (coreFailed) {
        setKpiState('error');
        setKpiErrorMsg('Không thể tải dữ liệu KPI');
      } else {
        const oC = okOr(ordersCur) || [];
        const oP = okOr(ordersPrev) || [];
        const sC = okOr(subsCur) || [];
        const sP = okOr(subsPrev) || [];

        const curTotal = oC.length + sC.length;
        const prevTotal = oP.length + sP.length;
        const curRevenue = sC.reduce((a, r) => a + (Number(r.cod_amount) || 0), 0);
        const prevRevenue = sP.reduce((a, r) => a + (Number(r.cod_amount) || 0), 0);
        const draftsCur = oC.filter(r => !r.status || String(r.status).toLowerCase() === 'draft').length;
        const draftsPrev = oP.filter(r => !r.status || String(r.status).toLowerCase() === 'draft').length;
        const rateCur = curTotal === 0 ? 0 : (sC.length / curTotal) * 100;
        const ratePrev = prevTotal === 0 ? 0 : (sP.length / prevTotal) * 100;
        const aiCurCount = Array.isArray(okOr(aiCur)) ? okOr(aiCur).length : 0;
        const aiPrevCount = Array.isArray(okOr(aiPrev)) ? okOr(aiPrev).length : 0;

        setKpis({
          revenue: curRevenue, revenuePrev: prevRevenue,
          orders: curTotal, ordersPrev: prevTotal,
          rate: rateCur, ratePrev,
          ai: aiCurCount, aiPrev: aiPrevCount
        });

        const buckets = [];
        const d = new Date(cur.start);
        while (d <= cur.end) {
          buckets.push({ key: dateKey(d), label: fmtDay(d), orders: 0, revenue: 0, ts: d.getTime() });
          d.setDate(d.getDate() + 1);
        }
        const idxOf = ts => {
          const k = dateKey(new Date(ts));
          const b = buckets.find(x => x.key === k);
          return b;
        };
        oC.forEach(r => { const b = idxOf(new Date(r.created_at).getTime()); if (b) b.orders += 1; });
        sC.forEach(r => {
          const t = new Date(r.submitted_at || r.created_at).getTime();
          const b = idxOf(t);
          if (b) { b.orders += 1; b.revenue += Number(r.cod_amount) || 0; }
        });
        setTrend(buckets);

        const total = curTotal;
        setBreakdown([
          { key: 'draft', name: 'Nháp', count: draftsCur, color: '#9CA3AF' },
          { key: 'submitted', name: 'Đã gửi', count: sC.length, color: 'var(--color-success-text)' },
          { key: 'failed', name: 'Lỗi', count: 0, color: 'var(--color-danger-text)' }
        ].map(x => ({ ...x, pct: total === 0 ? 0 : (x.count / total) * 100 })));

        setRangeLabel(`${fmtDay(cur.start)} – ${fmtDay(cur.end)} (${buckets.length} ngày)`);
        setKpiState('ready');
      }
    }

    const [cfgRes, failCur, failPrev, fail24h] = await Promise.allSettled([
      fetchRows('carrier_configs', `${shopFilter}&select=carrier_id,is_connected,account_username,last_synced`),
      fetchRows('orders', `${shopFilter}&deleted_at=is.null&status=ilike.*fail*&${curRange}&select=id`),
      fetchRows('orders', `${shopFilter}&deleted_at=is.null&status=ilike.*fail*&${prevRange}&select=id`),
      fetchRows('orders', `${shopFilter}&deleted_at=is.null&status=ilike.*fail*&created_at=gte.${toISO(addDays(new Date(), -1))}&select=id`)
    ]);

    if (alive()) {
      if (cfgRes.status === 'rejected') {
        setAlertState('error');
      } else {
        const cfg = okOr(cfgRes) || [];
        const items = [];
        cfg
          .filter(c => c.is_connected === false)
          .forEach(c => {
            items.push({
              severity: 'critical',
              icon: 'carrier',
              title: `${carrierLabel(c.carrier_id)} mất kết nối`,
              desc: 'Hệ thống sẽ không gửi đơn được qua nhà vận chuyển này.',
              action: canConfigure ? { label: 'Cấu hình', tab: 'carriers' } : null
            });
          });
        if (items.length === 0 && cfg.length > 0 && cfg.every(c => c.is_connected === true)) {
          items.push({
            severity: 'info',
            icon: 'ok',
            title: 'Kết nối nhà vận chuyển bình thường',
            desc: 'VNPost và J&T đều đang hoạt động.'
          });
        }
        const failList = [];
        const seen = new Set();
        [...(okOr(fail24h) || []), ...(okOr(failCur) || []), ...(okOr(failPrev) || [])]
          .forEach(r => {
            if (r && r.id && !seen.has(r.id)) { seen.add(r.id); failList.push(r); }
          });
        const failCount = failList.length;
        if (failCount > 0) {
          items.push({
            severity: 'warning',
            icon: 'fail',
            title: `${num.format(failCount)} đơn gửi lỗi`,
            desc: 'Kiểm tra các đơn hàng bị lỗi để xử lý lại.',
            action: { label: 'Xem', tab: 'orders' }
          });
        }
        setAlerts(items);
        setAlertState('ready');
      }
    }

    const [recentA, recentB] = await Promise.allSettled([
      fetchRows('orders', `${shopFilter}&deleted_at=is.null&order=created_at.desc&limit=5&select=id,order_code,customer_name,phone,address,cod_amount,platform,status,created_at`),
      fetchRows('submitted_orders', `${shopFilter}&order=submitted_at.desc&limit=5&select=id,order_code,tracking_code,customer_name,phone,address,cod_amount,platform,status,submitted_at,created_at`)
    ]);

    if (alive()) {
      const bothFailed = recentA.status === 'rejected' && recentB.status === 'rejected';
      if (bothFailed) {
        setRecentState('error');
      } else {
        const rows = [];
        (okOr(recentA) || []).forEach(r => {
        rows.push({
          key: 'draft-' + r.id,
          type: 'draft',
          id: r.id,
          code: r.order_code || '#' + String(r.id).slice(0, 8),
          customer: r.customer_name || '—',
          phone: r.phone || '—',
          address: r.address || '—',
          cod: Number(r.cod_amount) || 0,
          carrier: carrierLabel(r.platform),
          status: r.status || 'draft',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        });
      });
      (okOr(recentB) || []).forEach(r => {
        rows.push({
          key: 'sub-' + r.id,
          type: 'submitted',
          id: r.id,
          code: r.order_code || '#' + String(r.id).slice(0, 8),
          customer: r.customer_name || '—',
          phone: r.phone || '—',
          address: r.address || '—',
          cod: Number(r.cod_amount) || 0,
          carrier: carrierLabel(r.platform),
          status: r.status || 'submitted',
          trackingCode: r.tracking_code || '',
          createdAt: r.submitted_at || r.created_at,
          submittedAt: r.submitted_at
        });
      });
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentOrders(rows.slice(0, 5));
        setRecentState('ready');
      }
    }

    if (alive()) setLastUpdated(new Date());
  }, [preset, customStart, customEnd, refreshTick, canConfigure]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!drawerOrder) return;
    const onKey = e => { if (e.key === 'Escape') setDrawerOrder(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOrder]);

  useEffect(() => { setHover(null); }, [chartMode, preset, customStart, customEnd, refreshTick]);

  const doRetry = () => setRefreshTick(t => t + 1);

  const allZero = kpis && kpis.orders === 0 && kpis.ai === 0;

  const attentionCard = (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title">Cần chú ý</h3>
          <span className="dash-card-sub">Vấn đề cần xử lý</span>
        </div>
      </div>
      {alertState === 'loading' && <SkeletonCard h={280} />}
      {alertState === 'error' && <ErrorState title="Không thể tải cảnh báo" onRetry={doRetry} />}
      {alertState === 'ready' && (
        alerts.length === 0 ? (
          <div className="dash-state">
            <CheckCircle2 size={28} color="var(--color-success-text)" />
            <div className="dash-state-title">Không có vấn đề</div>
            <div className="dash-state-desc">Chưa phát hiện cảnh báo nào trong khoảng thời gian này.</div>
          </div>
        ) : (
          <div className="dash-alert-list">
            {alerts.map((a, i) => (
              <div key={i} className={`dash-alert-item dash-alert-${a.severity}`}>
                <span className="dash-alert-icon">
                  {a.icon === 'carrier'
                    ? <WifiOff size={16} color="var(--color-danger-text)" />
                    : a.icon === 'fail'
                      ? <AlertTriangle size={16} color="var(--color-warning-text)" />
                      : <CheckCircle2 size={16} color="var(--color-success-text)" />}
                </span>
                <div className="dash-alert-body">
                  <div className="dash-alert-title">{a.title}</div>
                  <div className="dash-alert-desc">{a.desc}</div>
                </div>
                {a.action && (
                  <button
                    className="dash-btn dash-btn-sm"
                    onClick={() => setActiveTab(a.action.tab)}
                  >
                    {a.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );

  return (
    <div>
      <div className="dash-header">
        <div>
          <h2 className="page-title">Shop Overview</h2>
          <p className="dash-subtitle">Theo dõi hiệu quả vận hành cửa hàng của bạn.</p>
        </div>
        <div className="dash-controls">
          <select
            className="dash-range-select"
            value={preset}
            onChange={e => setPreset(e.target.value)}
            aria-label="Khoảng thời gian"
          >
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {preset === 'custom' && (
            <>
              <input
                type="date"
                className="dash-date-input"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                aria-label="Ngày bắt đầu"
              />
              <input
                type="date"
                className="dash-date-input"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                aria-label="Ngày kết thúc"
              />
            </>
          )}
          <button
            className="dash-btn"
            onClick={doRetry}
            disabled={kpiState === 'loading' || alertState === 'loading' || recentState === 'loading'}
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={kpiState === 'loading' ? 'dash-spin' : ''} />
            Làm mới
          </button>
          {lastUpdated && (
            <span className="dash-updated">
              <Clock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Cập nhật lúc {lastUpdated.toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>
      </div>

      <div className="dash-kpi-grid">
        {kpiState === 'loading' && [0, 1, 2, 3].map(i => <SkeletonKpi key={i} />)}
        {kpiState === 'error' && (
          <div className="dash-card" style={{ gridColumn: '1 / -1' }}>
            <ErrorState title={kpiErrorMsg || 'Không thể tải dữ liệu'} onRetry={doRetry} />
          </div>
        )}
        {kpiState === 'ready' && kpis && (
          <>
            <KpiCard
              label="Doanh thu"
              icon={<Wallet size={16} />}
              iconBg="var(--brand-50)"
              iconColor="var(--brand-600)"
              value={compactVND(kpis.revenue)}
              delta={<DeltaBadge cur={kpis.revenue} prev={kpis.revenuePrev} suffix="%" />}
              sub={`Kỳ trước: ${compactVND(kpis.revenuePrev)}`}
            />
            <div className="dash-kpi-card clickable" onClick={() => setActiveTab('orders')}>
              <div className="dash-kpi-label">
                <span className="dash-kpi-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}><Package size={16} /></span>
                Đơn hàng
              </div>
              <div className="dash-kpi-value">{num.format(kpis.orders)}</div>
              <DeltaBadge cur={kpis.orders} prev={kpis.ordersPrev} suffix="%" />
              <span className="dash-kpi-sub">Kỳ trước: {num.format(kpis.ordersPrev)}</span>
            </div>
            <KpiCard
              label="Tỷ lệ thành công"
              icon={<CheckCircle2 size={16} />}
              iconBg="var(--color-success-bg)"
              iconColor="var(--color-success-text)"
              value={`${kpis.rate.toFixed(1)}%`}
              delta={<DeltaBadge cur={kpis.rate} prev={kpis.ratePrev} suffix=" pts" rate />}
              sub={`Kỳ trước: ${kpis.ratePrev.toFixed(1)}%`}
            />
            <KpiCard
              label="AI Parsed"
              icon={<Zap size={16} />}
              iconBg="var(--color-warning-bg)"
              iconColor="var(--color-warning-text)"
              value={num.format(kpis.ai)}
              delta={<DeltaBadge cur={kpis.ai} prev={kpis.aiPrev} suffix="%" />}
              sub="Lượt AI bóc tách đơn thành công"
              onClick={() => setActiveTab('history')}
            />
          </>
        )}
      </div>

      {kpiState === 'ready' && allZero ? (
        <div className="dash-row">
          <div className="dash-card">
            <div className="dash-state" style={{ padding: '56px 24px' }}>
              <Package size={32} color="var(--primary)" />
              <div className="dash-state-title">Chưa có dữ liệu kinh doanh</div>
              <div className="dash-state-desc">
                Tạo đơn hàng đầu tiên hoặc bóc tách đơn bằng AI để bắt đầu thấy dữ liệu trên dashboard.
              </div>
              <button className="dash-btn dash-btn-primary" onClick={() => setActiveTab('orders')}>
                <Plus size={14} /> Tạo đơn hàng đầu tiên
              </button>
            </div>
          </div>
          {attentionCard}
        </div>
      ) : (
        <>
          <div className="dash-row">
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">Xu hướng</h3>
                  <span className="dash-card-sub">{rangeLabel}</span>
                </div>
                <div className="dash-chart-toggle" role="tablist" aria-label="Chọn dữ liệu biểu đồ">
                  <button
                    role="tab"
                    aria-selected={chartMode === 'revenue'}
                    className={chartMode === 'revenue' ? 'active' : ''}
                    onClick={() => setChartMode('revenue')}
                  >
                    Doanh thu
                  </button>
                  <button
                    role="tab"
                    aria-selected={chartMode === 'orders'}
                    className={chartMode === 'orders' ? 'active' : ''}
                    onClick={() => setChartMode('orders')}
                  >
                    Đơn hàng
                  </button>
                </div>
              </div>
              {kpiState === 'loading' && <SkeletonCard h={280} />}
              {kpiState === 'error' && <ErrorState title="Không thể tải dữ liệu xu hướng" onRetry={doRetry} />}
              {kpiState === 'ready' && (
                trend.every(b => b.orders === 0 && b.revenue === 0)
                  ? (
                    <div className="dash-state">
                      <Info size={28} color="var(--text-muted)" />
                      <div className="dash-state-title">Chưa có dữ liệu</div>
                      <div className="dash-state-desc">Không có đơn hàng nào trong khoảng thời gian này.</div>
                    </div>
                  )
                  : (
                    <TrendChart buckets={trend} mode={chartMode} hover={hover} setHover={setHover} />
                  )
              )}
            </div>
            {attentionCard}
          </div>

          <div className="dash-row-2">
            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">Cơ cấu đơn theo trạng thái</h3>
                  <span className="dash-card-sub">{rangeLabel}</span>
                </div>
              </div>
              {kpiState === 'loading' && <SkeletonCard h={200} />}
              {kpiState === 'error' && <ErrorState title="Không thể tải cơ cấu đơn" onRetry={doRetry} />}
              {kpiState === 'ready' && (
                breakdown.reduce((a, b) => a + b.count, 0) === 0 ? (
                  <div className="dash-state">
                    <Info size={28} color="var(--text-muted)" />
                    <div className="dash-state-title">Chưa có đơn hàng</div>
                    <div className="dash-state-desc">Tạo đơn đầu tiên để xem cơ cấu trạng thái.</div>
                  </div>
                ) : (
                  <div className="dash-status-list">
                    {breakdown.map(b => (
                      <div className="dash-status-row" key={b.key}>
                        <span className="dash-status-dot" style={{ background: b.color }} />
                        <span className="dash-status-name">{b.name}</span>
                        <div className="dash-status-bar">
                          <div className="dash-status-fill" style={{ width: `${b.pct}%`, background: b.color }} />
                        </div>
                        <span className="dash-status-count">{num.format(b.count)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">Đơn hàng gần đây</h3>
                  <span className="dash-card-sub">5 đơn mới nhất</span>
                </div>
                <button className="dash-btn dash-btn-sm" onClick={() => setActiveTab('orders')}>
                  Xem tất cả <ArrowUpRight size={13} />
                </button>
              </div>
              {recentState === 'loading' && (
                <div>
                  {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-box dash-skeleton-row" />)}
                </div>
              )}
              {recentState === 'error' && <ErrorState title="Không thể tải đơn hàng" onRetry={doRetry} />}
              {recentState === 'ready' && recentOrders.length === 0 && (
                <div className="dash-state">
                  <Package size={28} color="var(--text-muted)" />
                  <div className="dash-state-title">Chưa có đơn hàng nào</div>
                  <div className="dash-state-desc">Tạo đơn hàng đầu tiên để bắt đầu theo dõi hiệu quả.</div>
                </div>
              )}
              {recentState === 'ready' && recentOrders.length > 0 && (
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Khách hàng</th>
                        <th className="num">Thu hộ (COD)</th>
                        <th>Vận chuyển</th>
                        <th>Trạng thái</th>
                        <th>Thời gian</th>
                        <th aria-label="Xem chi tiết" />
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map(row => {
                        const st = statusInfo(row);
                        return (
                          <tr key={row.key} onClick={() => setDrawerOrder(row)}>
                            <td className="dash-cell-main">{row.code}</td>
                            <td>
                              <div className="dash-cell-main">{row.customer}</div>
                              <div className="dash-cell-sub">{row.phone}</div>
                            </td>
                            <td className="num">{money.format(row.cod)}</td>
                            <td>{row.carrier}</td>
                            <td>
                              <span className={`dash-badge dash-badge-${st.tone}`}>{st.label}</span>
                            </td>
                            <td className="dash-cell-sub">{formatDateTime(row.createdAt)}</td>
                            <td><Eye size={14} color="var(--text-muted)" aria-hidden="true" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {drawerOrder && (
        <>
          <div className="dash-overlay" onClick={() => setDrawerOrder(null)} />
          <Drawer
            order={drawerOrder}
            onClose={() => setDrawerOrder(null)}
            onOpenOrders={() => { setDrawerOrder(null); setActiveTab('orders'); }}
          />
        </>
      )}
    </div>
  );
}

function Drawer({ order, onClose, onOpenOrders }) {
  const st = statusInfo(order);
  const events = buildTimeline(order);
  return (
    <div className="dash-drawer" role="dialog" aria-modal="true" aria-label={`Chi tiết đơn ${order.code}`}>
      <div className="dash-drawer-header">
        <div>
          <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {order.code}
            <span className={`dash-badge dash-badge-${st.tone}`}>{st.label}</span>
          </h3>
          <div className="dash-cell-sub" style={{ marginTop: 4 }}>{order.carrier}</div>
        </div>
        <button className="dash-btn dash-btn-sm" onClick={onClose} aria-label="Đóng">
          <X size={14} />
        </button>
      </div>
      <div className="dash-drawer-body">
        <div className="dash-drawer-section">
          <div className="dash-drawer-section-title">Thông tin đơn hàng</div>
          <div className="dash-drawer-fields">
            <div className="dash-field">
              <div className="dash-field-label">Khách hàng</div>
              <div className="dash-field-value">{order.customer}</div>
            </div>
            <div className="dash-field">
              <div className="dash-field-label">Số điện thoại</div>
              <div className="dash-field-value">{order.phone}</div>
            </div>
            <div className="dash-field wide">
              <div className="dash-field-label">Địa chỉ</div>
              <div className="dash-field-value">{order.address}</div>
            </div>
            <div className="dash-field">
              <div className="dash-field-label">Tiền thu hộ (COD)</div>
              <div className="dash-field-value">{money.format(order.cod)}</div>
            </div>
            <div className="dash-field">
              <div className="dash-field-label">Nhà vận chuyển</div>
              <div className="dash-field-value">{order.carrier}</div>
            </div>
            {order.trackingCode && (
              <div className="dash-field wide">
                <div className="dash-field-label">Mã vận đơn</div>
                <div className="dash-field-value">{order.trackingCode}</div>
              </div>
            )}
            <div className="dash-field">
              <div className="dash-field-label">Đơn tạo lúc</div>
              <div className="dash-field-value">{formatDateTime(order.createdAt)}</div>
            </div>
          </div>
        </div>
        <div className="dash-drawer-section">
          <div className="dash-drawer-section-title">Timeline trạng thái</div>
          <div className="dash-timeline">
            {events.map((e, i) => (
              <div className="dash-timeline-item" key={i}>
                <span className="dash-timeline-dot" style={{ background: e.color }} />
                <div className="dash-timeline-time">{formatDateTime(e.time)}</div>
                <div className="dash-timeline-text">{e.text}</div>
                {e.meta && <div className="dash-timeline-meta">{e.meta}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: 16, borderTop: '1px solid var(--border-default)' }}>
        <button className="dash-btn dash-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onOpenOrders}>
          Mở trang đơn hàng <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}

function buildTimeline(order) {
  const events = [];
  const draftColor = '#9CA3AF';
  const successColor = 'var(--color-success-text)';
  const failColor = 'var(--color-danger-text)';
  if (order.type === 'draft') {
    events.push({ time: order.createdAt, text: 'Đơn được tạo (Nháp)', color: draftColor });
    const s = String(order.status || '').toLowerCase();
    if (s.includes('fail')) {
      events.push({ time: order.updatedAt || order.createdAt, text: 'Gửi đơn thất bại', color: failColor });
    } else if (s.includes('processing')) {
      events.push({ time: order.updatedAt || order.createdAt, text: 'Đang xử lý', color: draftColor });
    }
  } else {
    events.push({ time: order.createdAt, text: 'Đơn được tạo', color: draftColor });
    events.push({
      time: order.submittedAt || order.createdAt,
      text: order.trackingCode ? `Đã gửi lên hệ thống — Mã vận đơn ${order.trackingCode}` : 'Đã gửi lên hệ thống',
      color: successColor
    });
  }
  if (events.length === 0) {
    events.push({ time: order.createdAt, text: 'Đơn được tạo', color: draftColor });
  }
  return events;
}