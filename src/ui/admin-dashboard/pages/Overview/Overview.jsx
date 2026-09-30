import React, { useEffect, useState, useId } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import {
  TrendingUp, Users, Building2, Package, Wallet,
  AlertTriangle, ShieldCheck, Zap, RefreshCw, ArrowUpRight,
  Activity, CheckCircle2, Server
} from 'lucide-react';
import CommercialMetrics from '../../components/CommercialMetrics';
import CommercialIntelligence from '../../components/CommercialIntelligence';
import { SkeletonHeroKpis, SkeletonCard } from '../../components/Skeleton';

const money = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat('vi-VN').format(n || 0);

function SparklineChart({ data, color = 'var(--primary, #2563eb)' }) {
  const gradId = useId();
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 180;
  const h = 48;
  const step = w / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return { x, y };
  });

  const lineD = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  const areaD = `${lineD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: `${h}px`, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Overview({ userRole = 'SYSTEM_ADMIN' }) {
  const isSupportStaff = userRole === 'SUPPORT_STAFF';
  const [metrics, setMetrics] = useState({
    shops_total: 0,
    shops_active: 0,
    shops_trial: 0,
    shops_suspended: 0,
    users_total: 0,
    users_active: 0,
    orders_total: 0,
    orders_today: 0,
    ai_requests_total: 0,
    ai_requests_today: 0,
    ai_tokens_today: 0,
    ai_errors_today: 0,
    quota_risk_count: 0,
    subscription_risk_count: 0,
    mrr: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [datePreset, setDatePreset] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('range');
    return ['today', '7days', '30days', 'thisMonth'].includes(value) ? value : '30days';
  });

  async function loadMetrics() {
    try {
      setLoading(true);
      setError('');
      const res = await AdminService.getOverviewMetrics(datePreset);
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setError(res.error || 'Không thể tải số liệu quản trị.');
      }
      setLastRefreshed(new Date());
    } catch (e) {
      console.error("Lỗi lấy data Admin Overview:", e);
      setError(e?.message || 'Không thể tải số liệu quản trị.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
    const handleRefresh = () => {
      loadMetrics();
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [datePreset]);

  const changeDatePreset = value => {
    setDatePreset(value);
    const url = new URL(window.location.href);
    url.searchParams.set('range', value);
    window.history.replaceState(null, '', url);
  };

  const mrrTrend = Array.isArray(metrics.mrr_trend) ? metrics.mrr_trend : [];
  const aiTrend = Array.isArray(metrics.ai_requests_trend) ? metrics.ai_requests_trend : [];
  const aiSuccessRate = metrics.ai_requests_today > 0
    ? Math.max(0, ((metrics.ai_requests_today - metrics.ai_errors_today) / metrics.ai_requests_today) * 100)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary, #0f172a)' }}>
            Trung Tâm Quản Trị Nền Tảng (Master SaaS Overview)
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
            {isSupportStaff 
              ? 'Màn hình theo dõi hoạt động kỹ thuật, hỗ trợ khách hàng và tình trạng đơn hàng toàn hệ thống.'
              : 'Giám sát toàn bộ khách hàng doanh nghiệp (Shops), người dùng, doanh thu MRR và hạn mức AI toàn hệ thống.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>
              Cập nhật: {lastRefreshed.toLocaleTimeString('vi-VN')}
            </span>
          )}
          <button
            onClick={loadMetrics}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'dash-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      <div aria-label="Khoảng thời gian Overview" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#ffffff', padding: '10px 16px', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['today','Hôm nay'],['7days','7 ngày'],['30days','30 ngày'],['thisMonth','Tháng này']].map(([value,label]) => (
            <button
              key={value}
              onClick={() => changeDatePreset(value)}
              aria-pressed={datePreset === value}
              style={{
                background: datePreset === value ? '#2563eb' : '#f8fafc',
                color: datePreset === value ? '#ffffff' : '#475569',
                border: datePreset === value ? '1px solid #2563eb' : '1px solid #e2e8f0',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: datePreset === value ? '0 2px 4px rgba(37,99,235,0.2)' : 'none'
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}>
          KPI thời điểm hiện tại · xu hướng {datePreset === 'today' ? 'hôm nay' : datePreset === '7days' ? '7 ngày' : datePreset === '30days' ? '30 ngày' : 'tháng này'}
        </span>
      </div>

      {/* Ẩn widget tài chính nếu là Support Staff */}
      {!isSupportStaff && <CommercialMetrics range={datePreset} />}
      {!isSupportStaff && <CommercialIntelligence range={datePreset} />}

      {error && (
        <div role="alert" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span><strong>Không thể xác minh số liệu:</strong> {error}. Hệ thống không thay lỗi bằng số 0.</span>
          <button onClick={loadMetrics} style={{ border: 0, background: 'transparent', color: '#991b1b', fontWeight: 800, cursor: 'pointer' }}>Thử lại</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ marginTop: -12, color: '#64748b', fontSize: 11.5 }}>
          Nguồn: {metrics.data_source === 'admin_kpis_rpc' ? 'KPI máy chủ' : 'tổng hợp trực tiếp (fallback)'}
          {metrics.measured_at ? ` · Đo lúc ${new Date(metrics.measured_at).toLocaleString('vi-VN')}` : ''}
        </div>
      )}

      {/* Hero SaaS Metric Cards */}
      {loading ? (
        <>
          <SkeletonHeroKpis count={isSupportStaff ? 3 : 4} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <SkeletonCard height={200} />
            <SkeletonCard height={200} />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            
            {/* MRR Card with Trend (Chỉ hiển thị cho Master Admin) */}
            {!isSupportStaff && (
              <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '12.5px', fontWeight: 700 }}>
                    <span>DOANH THU THUÊ BAO (MRR)</span>
                    <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px', borderRadius: '6px' }}><Wallet size={16} /></span>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', margin: '8px 0 4px 0' }}>
                    {money(metrics.mrr)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                    <ArrowUpRight size={14} /> {Number.isFinite(Number(metrics.mrr_delta_percent))
                      ? `${Number(metrics.mrr_delta_percent) >= 0 ? '+' : ''}${Number(metrics.mrr_delta_percent).toFixed(1)}% so với kỳ trước`
                      : 'Chưa đủ kỳ dữ liệu để so sánh'}
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <SparklineChart data={mrrTrend} color="#059669" />
                </div>
              </div>
            )}

            {/* Total Shops Card */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '12.5px', fontWeight: 700 }}>
                <span>DOANH NGHIỆP / CỬA HÀNG</span>
                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px', borderRadius: '6px' }}><Building2 size={16} /></span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
                {num(metrics.shops_total)} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>cửa hàng</span>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  {metrics.shops_active} Đang chạy
                </span>
                <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  {metrics.shops_trial} Dùng thử
                </span>
                {metrics.shops_suspended > 0 && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    {metrics.shops_suspended} Tạm khóa
                  </span>
                )}
              </div>
            </div>

            {/* Total Users Card */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '12.5px', fontWeight: 700 }}>
                <span>NGƯỜI DÙNG TOÀN CẦU</span>
                <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '4px', borderRadius: '6px' }}><Users size={16} /></span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
                {num(metrics.users_total)} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>tài khoản</span>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> {metrics.users_active} Tài khoản đang hoạt động
              </div>
            </div>

            {/* Orders Processed */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '12.5px', fontWeight: 700 }}>
                <span>TỔNG ĐƠN ĐÃ XỬ LÝ</span>
                <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px', borderRadius: '6px' }}><Package size={16} /></span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#4338ca', margin: '8px 0 4px 0' }}>
                {num(metrics.orders_total)}
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
                <strong>{num(metrics.orders_today)}</strong> đơn trong khoảng đang chọn
              </div>
            </div>

          </div>

          {/* AI Platform & Health Overview Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            
            {/* AI Quotas Card */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={16} color="#d97706" /> Tiêu Thụ AI Platform (Khoảng đang chọn)
                  </h3>
                </div>
                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  Gemini & OpenAI
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>YÊU CẦU</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {num(metrics.ai_requests_today)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>SỐ TOKEN</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    {num(metrics.ai_tokens_today)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>SỐ LỖI</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: metrics.ai_errors_today > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                    {num(metrics.ai_errors_today)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <span>Tổng lượt AI toàn thời gian: <strong>{num(metrics.ai_requests_total)}</strong></span>
                <span>Tỷ lệ thành công: <strong style={{ color: '#16a34a' }}>{aiSuccessRate === null ? '—' : `${aiSuccessRate.toFixed(1)}%`}</strong></span>
              </div>
            </div>

            {/* Risk & Health Monitoring Card */}
            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} color="#2563eb" /> Cảnh Báo Nguy Cơ & Rủi Ro Hệ Thống
                </h3>
                <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  Ưu tiên cảnh báo
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', background: metrics.quota_risk_count > 0 ? '#fef3c7' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color={metrics.quota_risk_count > 0 ? '#b45309' : '#64748b'} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Nguy cơ vượt Quota AI (80%)</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>Các shop sắp chạm trần gói bóc tách đơn</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: metrics.quota_risk_count > 0 ? '#b45309' : '#64748b' }}>
                    {metrics.quota_risk_count}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', background: metrics.subscription_risk_count > 0 ? '#fee2e2' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color={metrics.subscription_risk_count > 0 ? '#b91c1c' : '#16a34a'} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Nguy cơ hủy gói / Quá hạn thanh toán</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>Các shop có gói cước hết hạn trong 3 ngày</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: metrics.subscription_risk_count > 0 ? '#b91c1c' : '#16a34a' }}>
                    {metrics.subscription_risk_count}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
}
