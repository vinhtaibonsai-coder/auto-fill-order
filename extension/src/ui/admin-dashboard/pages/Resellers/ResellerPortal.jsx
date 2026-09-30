import React, { useEffect, useMemo, useState } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import { 
  COMMISSION_STATUSES, 
  STATEMENT_STATUSES,
  exportResellerCommissionsCsv 
} from '../../../../domain/admin/reseller.engine.js';
import ExportButton from '../../components/ExportButton';

export default function ResellerPortal() {
  const [activeTab, setActiveTab] = useState('commissions'); // 'commissions' | 'shops' | 'payouts'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    setError('');
    const r = await AdminService.getResellerPortalOverview();
    if (r.success) {
      setData(r.data);
    } else {
      setError(r.error || 'Không tải được thông tin đại lý');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Format currency
  const fmt = (val) => {
    const n = Number(val) || 0;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
  };

  // Filter commissions
  const filteredCommissions = useMemo(() => {
    const list = data?.recent_commissions || [];
    if (commissionStatusFilter === 'ALL') return list;
    return list.filter(c => (c.status || '').toLowerCase() === commissionStatusFilter.toLowerCase());
  }, [data, commissionStatusFilter]);

  // Generate Payout Statement
  const handleGeneratePayout = async () => {
    setActionNotice(null);
    const startDate = prompt('Kỳ đối soát - Ngày bắt đầu (YYYY-MM-DD):', '2026-09-01');
    if (!startDate) return;
    const endDate = prompt('Kỳ đối soát - Ngày kết thúc (YYYY-MM-DD):', '2026-09-30');
    if (!endDate) return;

    const r = await AdminService.generateResellerPayoutStatement(data?.reseller_id, startDate, endDate);
    if (r.success) {
      setActionNotice({
        type: 'success',
        text: `Đã lập bảng kê quyết toán ${r.data?.statement_code || ''} với số tiền thực nhận: ${fmt(r.data?.net_payout_amount)}`
      });
      load();
    } else {
      setActionNotice({ type: 'error', text: r.error || 'Lỗi khi tạo bảng kê quyết toán' });
    }
  };

  // Pay Statement
  const handlePayStatement = async (statement) => {
    setActionNotice(null);
    const ref = prompt(`Nhập mã ủy nhiệm chi / mã giao dịch ngân hàng cho bảng kê ${statement.statement_code}:`, 'UNC-' + Date.now());
    if (!ref) return;

    const r = await AdminService.payResellerStatement(statement.id, ref);
    if (r.success) {
      setActionNotice({
        type: 'success',
        text: `Đã xác nhận chi trả thành công cho bảng kê ${statement.statement_code} (Mã UNC: ${ref})`
      });
      load();
    } else {
      setActionNotice({ type: 'error', text: r.error || 'Lỗi khi ghi nhận thanh toán' });
    }
  };

  if (loading && !data) {
    return <div aria-busy="true" className="card" style={{ padding: 24 }}>Đang tải dữ liệu cổng đại lý Reseller & Affiliate…</div>;
  }

  if (error && !data) {
    return (
      <div role="alert" className="card" style={{ padding: 24, color: '#991b1b', background: '#fef2f2' }}>
        <strong>Lỗi kết nối Cổng Đại Lý:</strong> {error}
        <div style={{ marginTop: 12 }}>
          <button onClick={load} className="btn btn-secondary">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Cổng Đại Lý Phân Phối (Reseller Portal)</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>
            Đối tác: <strong>{data?.name || 'Đại lý'}</strong> ({data?.code}) · Hoa hồng: <strong>{data?.commission_rate}%</strong>
            {data?.bank_name && ` · Ngân hàng: ${data.bank_name} (${data.bank_account_no})`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={handleGeneratePayout} 
            className="btn btn-primary"
            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}
          >
            📋 Lập Bảng Kê Quyết Toán
          </button>
        </div>
      </div>

      {/* Action Notice */}
      {actionNotice && (
        <div 
          role="alert" 
          style={{ 
            padding: '10px 16px', 
            borderRadius: 6, 
            background: actionNotice.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: actionNotice.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${actionNotice.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #3b82f6' }}>
          <small style={{ color: '#64748b' }}>Shop Giới Thiệu</small>
          <strong style={{ display: 'block', fontSize: 24, marginTop: 4 }}>{data?.referred_shops_count || 0}</strong>
        </div>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #6366f1' }}>
          <small style={{ color: '#64748b' }}>Doanh Thu Đủ Điều Kiện</small>
          <strong style={{ display: 'block', fontSize: 20, marginTop: 4 }}>{fmt(data?.eligible_revenue_total)}</strong>
        </div>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
          <small style={{ color: '#64748b' }}>Hoa Hồng Chờ Duyệt</small>
          <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: '#d97706' }}>{fmt(data?.commission_pending)}</strong>
        </div>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #10b981' }}>
          <small style={{ color: '#64748b' }}>Hoa Hồng Đã Duyệt</small>
          <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: '#166534' }}>{fmt(data?.commission_approved)}</strong>
        </div>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #ef4444' }}>
          <small style={{ color: '#64748b' }}>Hoa Hồng Đã Đảo (Refund)</small>
          <strong style={{ display: 'block', fontSize: 20, marginTop: 4, color: '#b91c1c' }}>{fmt(data?.commission_reversed)}</strong>
        </div>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #059669', background: '#f0fdf4' }}>
          <small style={{ color: '#166534', fontWeight: 'bold' }}>Số Dư Quyết Toán (Net)</small>
          <strong style={{ display: 'block', fontSize: 22, marginTop: 4, color: '#15803d' }}>{fmt(data?.net_claimable_commission)}</strong>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button 
          onClick={() => setActiveTab('commissions')} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            background: activeTab === 'commissions' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'commissions' ? '#fff' : '#475569',
            border: 'none',
            fontWeight: activeTab === 'commissions' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          💰 Chi Tiết Hoa Hồng & Giao Dịch
        </button>
        <button 
          onClick={() => setActiveTab('shops')} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            background: activeTab === 'shops' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'shops' ? '#fff' : '#475569',
            border: 'none',
            fontWeight: activeTab === 'shops' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          🏪 Cửa Hàng Giới Thiệu
        </button>
        <button 
          onClick={() => setActiveTab('payouts')} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            background: activeTab === 'payouts' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'payouts' ? '#fff' : '#475569',
            border: 'none',
            fontWeight: activeTab === 'payouts' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          📑 Bảng Kê Quyết Toán (Payout Statements)
        </button>
      </div>

      {/* Tab 1: Commissions */}
      {activeTab === 'commissions' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Trạng thái:</span>
              {['ALL', 'pending', 'approved', 'paid', 'reversed'].map(st => (
                <button
                  key={st}
                  onClick={() => setCommissionStatusFilter(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: commissionStatusFilter === st ? '#0f172a' : '#f8fafc',
                    color: commissionStatusFilter === st ? '#fff' : '#334155',
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {st.toUpperCase()}
                </button>
              ))}
            </div>
            <ExportButton rows={filteredCommissions} filename="reseller-commissions.csv" />
          </div>

          {!filteredCommissions.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Chưa có giao dịch hoa hồng nào phù hợp bộ lọc.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Mã tham chiếu', 'Cửa hàng', 'Doanh thu đủ ĐK', 'Tỷ lệ %', 'Tiền hoa hồng', 'Trạng thái', 'Ngày ghi nhận'].map(x => (
                      <th key={x} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCommissions.map(c => {
                    const isReversal = c.status === 'reversed' || c.commission_amount < 0;
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: isReversal ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{c.reference_id || c.id}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{c.shop_name || c.shop_id}</td>
                        <td style={{ padding: '8px 12px' }}>{fmt(c.eligible_revenue)}</td>
                        <td style={{ padding: '8px 12px' }}>{c.commission_rate}%</td>
                        <td style={{ padding: '8px 12px' }}>
                          <strong style={{ color: isReversal ? '#dc2626' : '#166534' }}>
                            {fmt(c.commission_amount)}
                          </strong>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background: c.status === 'approved' ? '#dcfce7' : c.status === 'paid' ? '#e0e7ff' : c.status === 'reversed' ? '#fee2e2' : '#fef3c7',
                            color: c.status === 'approved' ? '#15803d' : c.status === 'paid' ? '#3730a3' : c.status === 'reversed' ? '#991b1b' : '#b45309'
                          }}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Referred Shops */}
      {activeTab === 'shops' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Danh Sách Cửa Hàng Giới Thiệu</h3>
            <ExportButton rows={data?.referred_shops || []} filename="referred-shops.csv" />
          </div>

          {!data?.referred_shops?.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Chưa có cửa hàng nào được gán cho đại lý này.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tên Cửa Hàng', 'Ngày tham gia', 'Gói dịch vụ', 'Đơn hàng 30 ngày qua'].map(x => (
                      <th key={x} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.referred_shops.map(s => (
                    <tr key={s.shop_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{s.shop_name}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>
                        {s.assigned_at ? new Date(s.assigned_at).toLocaleDateString('vi-VN') : ''}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', fontSize: 12 }}>
                          {s.plan_tier}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{s.orders_30d} đơn</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payout Statements */}
      {activeTab === 'payouts' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Lịch Sử Bảng Kê Quyết Toán (Payout Statements)</h3>
            <ExportButton rows={data?.payout_statements || []} filename="payout-statements.csv" />
          </div>

          {!data?.payout_statements?.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Chưa có bảng kê quyết toán nào được lập.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Mã Bảng Kê', 'Kỳ Đối Soát', 'Doanh Thu', 'Hoa Hồng Ròng', 'Trạng Thái', 'Mã Chuyển Khoản', 'Ngày Chi Trả', 'Thao Tác'].map(x => (
                      <th key={x} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.payout_statements.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{p.statement_code}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>
                        {p.period_start} → {p.period_end}
                      </td>
                      <td style={{ padding: '8px 12px' }}>{fmt(p.total_eligible_revenue)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <strong style={{ color: '#166534' }}>{fmt(p.net_payout_amount)}</strong>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 'bold',
                          background: p.status === 'paid' ? '#dcfce7' : p.status === 'approved' ? '#dbeafe' : '#f3f4f6',
                          color: p.status === 'paid' ? '#15803d' : p.status === 'approved' ? '#1e40af' : '#6b7280'
                        }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'monospace' }}>
                        {p.payout_ref || <span style={{ color: '#94a3b8' }}>-</span>}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {p.status === 'approved' ? (
                          <button
                            onClick={() => handlePayStatement(p)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                          >
                            Xác nhận đã chi
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.status === 'paid' ? 'Đã thanh toán' : 'Bản nháp'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
