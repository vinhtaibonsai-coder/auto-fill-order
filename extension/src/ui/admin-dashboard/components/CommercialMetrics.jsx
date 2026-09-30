import React, { useEffect, useState } from 'react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import { TrendingUp, Bot, Percent, Wallet, Users, Bell, Plus, DollarSign } from 'lucide-react';

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function CommercialMetrics({ range = '30days' }) {
  const [data, setData] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([AdminService.getUnitEconomics(range), AdminService.getGrowthMetrics(range)])
      .then(([economics, growthResult]) => {
        if (!active) return;
        if (!economics.success) throw new Error(economics.error || 'Không tải được dữ liệu thương mại');
        setData(economics.data);
        if (growthResult.success) setGrowth(growthResult.data);
        else setError(growthResult.error || 'Thiếu một phần dữ liệu tăng trưởng');
      })
      .catch(err => active && setError(err?.message || 'Không tải được dữ liệu thương mại'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [range]);

  if (loading) return <section className="card" aria-busy="true" style={{ padding: 20, color: '#64748b' }}>Đang tải chỉ số thương mại…</section>;
  if (!data) return <section className="card" role="alert" style={{ padding: 20, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca' }}>Không thể hiển thị chỉ số thương mại: {error}</section>;

  const margin = Number(data.mrr) ? Math.round(Number(data.gross_margin) / Number(data.mrr) * 100) : 0;

  const createReseller = async () => {
    const name = prompt('Tên đại lý:');
    if (!name) return;
    const code = prompt('Mã đại lý:');
    if (!code) return;
    const rate = Number(prompt('Hoa hồng (%):', '10'));
    const r = await AdminService.createReseller(name, code, rate);
    alert(r.success ? 'Đã tạo đại lý.' : r.error);
  };

  return (
    <section className="card" style={{ padding: '20px 24px', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="#2563eb" />
            Chỉ số Doanh thu & Vận hành Thương mại
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            Tổng hợp lợi nhuận gộp SaaS, chi phí AI và số dư ví đối tác
          </p>
        </div>
        <button
          onClick={createReseller}
          style={{
            background: '#ffffff',
            color: '#2563eb',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <Plus size={14} /> + Thêm Đại lý
        </button>
      </div>

      {error && <div role="status" style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: 12 }}>Dữ liệu một phần: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {/* MRR */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
            <span>Doanh thu MRR</span>
            <DollarSign size={14} color="#2563eb" />
          </div>
          <strong style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
            {money(data.mrr)}
          </strong>
        </div>

        {/* AI Cost */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
            <span>Chi phí AI ước tính</span>
            <Bot size={14} color="#dc2626" />
          </div>
          <strong style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
            {money(data.estimated_ai_cost)}
          </strong>
        </div>

        {/* Gross Margin */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
            <span>Lợi nhuận gộp</span>
            <Percent size={14} color={margin >= 70 ? '#059669' : '#d97706'} />
          </div>
          <strong style={{ display: 'block', fontSize: 17, fontWeight: 800, color: margin >= 70 ? '#059669' : '#d97706', marginTop: 4 }}>
            {money(data.gross_margin)} <span style={{ fontSize: 12, fontWeight: 600 }}>({margin}%)</span>
          </strong>
        </div>

        {/* Wallet Balance */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
            <span>Ví trả trước</span>
            <Wallet size={14} color="#7c3aed" />
          </div>
          <strong style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
            {money(growth?.wallet_balance_total)}
          </strong>
          <small style={{ color: '#64748b', fontSize: 11, fontWeight: 500 }}>{growth?.wallet_shops || 0} Cửa hàng</small>
        </div>

        {/* Resellers */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
            <span>Đại lý / Cảnh báo</span>
            <Users size={14} color="#0284c7" />
          </div>
          <strong style={{ display: 'block', fontSize: 17, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
            {growth?.resellers || 0} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>đại lý</span>
          </strong>
          <small style={{ color: '#64748b', fontSize: 11, fontWeight: 500 }}>{growth?.risk_reports_30d || 0} cảnh báo 30 ngày</small>
        </div>

        {/* Telegram Pending */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: 11.5, fontWeight: 600 }}>
            <span>Thông báo Telegram</span>
            <Bell size={14} color={growth?.telegram_pending ? '#d97706' : '#059669'} />
          </div>
          <strong style={{ display: 'block', fontSize: 17, fontWeight: 800, color: growth?.telegram_pending ? '#d97706' : '#059669', marginTop: 4 }}>
            {growth?.telegram_pending || 0} <span style={{ fontSize: 12, fontWeight: 600 }}>chờ duyệt</span>
          </strong>
        </div>
      </div>
    </section>
  );
}
