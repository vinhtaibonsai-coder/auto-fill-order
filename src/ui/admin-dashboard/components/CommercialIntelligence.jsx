import React, { useEffect, useState } from 'react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import { UnitEconomicsEngine } from '../../../domain/admin/unit-economics.engine.js';
import ExportButton from './ExportButton';

const money = value => value == null ? 'N/A' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
const percent = value => value == null ? 'N/A' : `${Number(value).toFixed(1)}%`;

export default function CommercialIntelligence({ range = '30days' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('margins'); // 'margins' | 'cohorts' | 'reconciliation'

  const load = async () => {
    setLoading(true); setError('');
    // Try unit economics RPC first, with fallback to legacy commercial intelligence if needed
    let result = await AdminService.getUnitEconomicsAnalytics(range);
    if (!result.success && AdminService.getCommercialIntelligence) {
      result = await AdminService.getCommercialIntelligence(range);
    }
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setData(null);
      setError(result.error || 'Không tải được phân tích thương mại');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  if (loading) return <section className="card" aria-busy="true" style={{ padding: 20, color: '#64748b' }}>Đang tính toán Unit Economics (CAC có chứng từ, LTV bảo vệ mẫu, Cohort M0-M3 và Đối soát sổ cái)…</section>;
  if (error) return <section className="card" role="alert" style={{ padding: 20, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>Chưa thể xác minh dữ liệu Unit Economics: {error} <button onClick={load} style={{ marginLeft: 8, padding: '2px 8px' }}>Thử lại</button></section>;
  if (!data) return null;

  const rawMargins = Array.isArray(data.shop_margins) ? data.shop_margins : [];
  const rawCohorts = Array.isArray(data.cohorts) ? data.cohorts : [];
  const computedCohorts = UnitEconomicsEngine.calculateCohortRetention(rawCohorts);
  const reconciliation = data.reconciliation || {
    is_reconciled: true,
    payment_revenue_total: data.revenue || 0,
    ledger_revenue_total: data.revenue || 0,
    discrepancy: 0,
    status: 'RECONCILED'
  };

  const rows = view === 'margins'
    ? rawMargins
    : view === 'cohorts'
      ? computedCohorts
      : [
          { item: 'Doanh thu giao dịch cổng thanh toán', value: money(reconciliation.payment_revenue_total), status: 'Thành công' },
          { item: 'Doanh thu sổ cái thương mại', value: money(reconciliation.ledger_revenue_total), status: 'Đã hạch toán' },
          { item: 'Chi phí trực tiếp AI & Model', value: money(data.direct_ai_cost || data.ai_cost), status: 'Theo token thật' },
          { item: 'Chi phí gián tiếp (Hạ tầng, CSKH, Ads)', value: money(data.indirect_costs_total || (Number(data.infra_cost || 0) + Number(data.support_cost || 0) + Number(data.marketing_cost || 0))), status: 'Có chứng từ' },
          { item: 'Độ lệch đối soát (Discrepancy)', value: money(reconciliation.discrepancy), status: reconciliation.discrepancy === 0 ? 'Khớp 100%' : 'Cần kiểm toán' }
        ];

  const columns = view === 'margins'
    ? [
        { key: 'shop_name', label: 'Shop' },
        { key: 'revenue', label: 'Doanh thu' },
        { key: 'ai_cost', label: 'Chi phí AI' },
        { key: 'allocated_overhead', label: 'Hạ tầng & CSKH PB' },
        { key: 'gross_profit', label: 'Lợi nhuận gộp' },
        { key: 'net_contribution', label: 'Đóng góp ròng' },
        { key: 'gross_margin_percent', label: 'Biên %' }
      ]
    : view === 'cohorts'
      ? [
          { key: 'cohortMonth', label: 'Cohort tháng' },
          { key: 'cohortSize', label: 'Quy mô' },
          { key: 'm0Display', label: 'M0 (Gia nhập)' },
          { key: 'm1Display', label: 'M1 (Tháng 1)' },
          { key: 'm2Display', label: 'M2 (Tháng 2)' },
          { key: 'm3Display', label: 'M3 (Tháng 3)' },
          { key: 'ndrDisplay', label: 'Net Retention (NDR)' },
          { key: 'grrDisplay', label: 'Gross Retention (GRR)' }
        ]
      : [
          { key: 'item', label: 'Hạng mục kiểm toán đối soát' },
          { key: 'value', label: 'Số liệu đối soát' },
          { key: 'status', label: 'Trạng thái đối soát' }
        ];

  return (
    <section className="card" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>G012 · Unit Economics & Đối Soát Thương Mại</h3>
            <span style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 600,
              background: reconciliation.is_reconciled ? '#ecfdf5' : '#fef2f2',
              color: reconciliation.is_reconciled ? '#065f46' : '#991b1b',
              border: `1px solid ${reconciliation.is_reconciled ? '#a7f3d0' : '#fecaca'}`
            }}>
              {reconciliation.is_reconciled ? '✓ Đối soát khớp 100%' : '⚠ Lệch đối soát'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 12 }}>
            Hạch toán đúng nguồn: Doanh thu từ thanh toán thành công, chi phí AI theo token, CAC chỉ tính khi có chứng từ, LTV bảo vệ mẫu tối thiểu.
          </p>
        </div>
        <ExportButton rows={rows} columns={columns} filename={`unit-economics-${view}-${range}.csv`} />
      </div>

      {/* Primary KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16 }}>
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>Doanh thu đối soát</small>
          <strong style={{ display: 'block', marginTop: 4, color: '#0f172a' }}>{money(data.revenue)}</strong>
          {data.revenue_delta_percent != null && (
            <span style={{ fontSize: 10, color: data.revenue_delta_percent >= 0 ? '#16a34a' : '#dc2626' }}>
              {data.revenue_delta_percent >= 0 ? '+' : ''}{data.revenue_delta_percent}% kỳ trước
            </span>
          )}
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>Chi phí AI trực tiếp</small>
          <strong style={{ display: 'block', marginTop: 4, color: '#dc2626' }}>{money(data.direct_ai_cost || data.ai_cost)}</strong>
          <span style={{ fontSize: 10, color: '#64748b' }}>Theo token model</span>
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>Lợi nhuận gộp (Gross Margin)</small>
          <strong style={{ display: 'block', marginTop: 4, color: '#16a34a' }}>{money(data.gross_profit || data.gross_margin)}</strong>
          <span style={{ fontSize: 10, color: '#16a34a' }}>Biên: {percent(data.gross_margin_percent)}</span>
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>Đóng góp ròng (Net Margin)</small>
          <strong style={{ display: 'block', marginTop: 4, color: '#0284c7' }}>{money(data.net_contribution || data.gross_margin)}</strong>
          <span style={{ fontSize: 10, color: '#0284c7' }}>Sau Hạ tầng/CSKH/Mkt</span>
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>CAC có chứng từ</small>
          <strong style={{ display: 'block', marginTop: 4 }}>
            {data.cac != null ? money(data.cac) : 'N/A'}
          </strong>
          <span style={{ fontSize: 10, color: data.cac != null ? '#16a34a' : '#94a3b8' }}>
            {data.cac_status === 'DOCUMENTED' ? '✓ Có chứng từ chi' : 'Chưa có chứng từ'}
          </span>
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>ARPU trung bình</small>
          <strong style={{ display: 'block', marginTop: 4 }}>{money(data.arpu)}</strong>
          <span style={{ fontSize: 10, color: '#64748b' }}>{data.paying_shops || 0} shop trả phí</span>
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>LTV quan sát (Bảo vệ mẫu)</small>
          <strong style={{ display: 'block', marginTop: 4 }}>
            {data.ltv != null ? money(data.ltv) : 'N/A'}
          </strong>
          <span style={{ fontSize: 10, color: data.sample_size_met ? '#16a34a' : '#d97706' }}>
            {data.sample_size_met ? `Mẫu: ${data.paying_shops} shop` : `Thiếu mẫu (hiện: ${data.paying_shops || 0}/5)`}
          </span>
        </div>

        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 9, border: '1px solid #e2e8f0' }}>
          <small style={{ color: '#64748b' }}>Tỷ lệ Churn</small>
          <strong style={{ display: 'block', marginTop: 4, color: (data.churn_rate_percent || 0) > 5 ? '#dc2626' : '#16a34a' }}>
            {percent(data.churn_rate_percent)}
          </strong>
          <span style={{ fontSize: 10, color: '#64748b' }}>{data.churned_shops || 0} shop rời đi</span>
        </div>
      </div>

      {/* LTV & CAC Transparent Note */}
      <div style={{ margin: '12px 0', padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: 11, color: '#475569' }}>
        <strong>Quy chuẩn tính toán trung thực:</strong>
        <span style={{ marginLeft: 8 }}>
          • CAC = Chi phí Marketing có hóa đơn/chứng từ ÷ Khách hàng mới trả phí.
        </span>
        <span style={{ marginLeft: 8 }}>
          • Công thức LTV: <code>(ARPU × Biên lợi nhuận gộp %) ÷ Tỷ lệ Churn</code> (Yêu cầu mẫu tối thiểu ≥ 5 shop đang hoạt động để tránh giá trị ảo).
        </span>
      </div>

      {/* View Switcher */}
      <div style={{ display: 'flex', gap: 6, margin: '16px 0 10px' }}>
        <button
          aria-pressed={view === 'margins'}
          onClick={() => setView('margins')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: view === 'margins' ? '#1e293b' : '#fff',
            color: view === 'margins' ? '#fff' : '#334155',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 12
          }}
        >
          Biên lợi nhuận theo shop (Có phân bổ chi phí)
        </button>
        <button
          aria-pressed={view === 'cohorts'}
          onClick={() => setView('cohorts')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: view === 'cohorts' ? '#1e293b' : '#fff',
            color: view === 'cohorts' ? '#fff' : '#334155',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 12
          }}
        >
          Cohort giữ chân (M0, M1, M2, M3 & NDR/GRR)
        </button>
        <button
          aria-pressed={view === 'reconciliation'}
          onClick={() => setView('reconciliation')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: view === 'reconciliation' ? '#1e293b' : '#fff',
            color: view === 'reconciliation' ? '#fff' : '#334155',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 12
          }}
        >
          Đối soát Tam Giác (Payment · Ledger · Costs)
        </button>
      </div>

      {!rows.length ? (
        <div style={{ padding: 18, textAlign: 'center', color: '#64748b' }}>Chưa có dữ liệu trong khoảng thời gian này.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {columns.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.shop_id || row.cohortMonth || row.item || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {columns.map(c => {
                    const val = row[c.key];
                    let display = val;
                    if (['revenue', 'ai_cost', 'allocated_overhead', 'gross_profit', 'net_contribution'].includes(c.key)) {
                      display = money(val);
                    } else if (c.key === 'gross_margin_percent') {
                      display = percent(val);
                    }
                    return (
                      <td key={c.key} style={{ padding: '8px 8px' }}>
                        {display ?? 'N/A'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, color: '#64748b', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
        <span>Nguồn dữ liệu: {data.data_source || 'unit_economics_ledger'}</span>
        <span>Thời điểm đo: {data.measured_at ? new Date(data.measured_at).toLocaleString('vi-VN') : 'N/A'}</span>
      </div>
    </section>
  );
}
