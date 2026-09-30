import React, { useCallback, useEffect, useState } from 'react';
import { AdminService } from '../../../domain/admin/admin.service.js';

export default function QuotaOverview() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await AdminService.getQuotaOverview();
      if (r.success) setRows(r.data || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bulk = async (amount) => {
    if (!selected.length) return;
    const results = await Promise.all(selected.map(id => AdminService.topupQuota(id, amount)));
    if (results.some(r => !r.success)) {
      alert('Một số Shop cấp quota thất bại.');
    } else {
      alert(`Đã cấp +${amount.toLocaleString()} lượt cho ${selected.length} Shop được chọn.`);
      setSelected([]);
      load();
    }
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelected(rows.map(r => r.shop_id));
    } else {
      setSelected([]);
    }
  };

  return (
    <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '17px' }}>📊</span>
            <strong style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>Top 10 Shop Dùng AI & Điều Phối Quota</strong>
            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              {rows.length} Cửa hàng
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
            Cảnh báo tự động: <span style={{ color: '#dc2626', fontWeight: 600 }}>Đỏ ≥90%</span>, <span style={{ color: '#d97706', fontWeight: 600 }}>Vàng ≥70%</span>, <span style={{ color: '#059669', fontWeight: 600 }}>Xanh an toàn</span>. Chọn shop để nạp nhanh quota.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
            {selected.length > 0 ? `Đã chọn ${selected.length} shop:` : 'Chọn shop để nạp:'}
          </span>
          {[500, 1000, 2000].map(n => (
            <button
              key={n}
              disabled={!selected.length}
              onClick={() => bulk(n)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid',
                borderColor: selected.length ? '#bfdbfe' : '#e2e8f0',
                background: selected.length ? '#eff6ff' : '#f8fafc',
                color: selected.length ? '#2563eb' : '#94a3b8',
                cursor: selected.length ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease'
              }}
            >
              + {n.toLocaleString()} lượt
            </button>
          ))}
          <button
            onClick={load}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer'
            }}
            title="Làm mới bảng"
          >
            🔄
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: '#f8fafc', borderRadius: '8px' }}>
          Chưa có dữ liệu sử dụng AI từ các shop.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 140px 80px', gap: '12px', padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>
            <input
              type="checkbox"
              checked={selected.length === rows.length && rows.length > 0}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              title="Chọn tất cả"
              style={{ cursor: 'pointer' }}
            />
            <span>Tên Cửa Hàng (Shop)</span>
            <span>Mức Tiêu Thụ</span>
            <span style={{ textAlign: 'right' }}>Tỷ Lệ</span>
          </div>

          {rows.map(r => {
            const pct = Math.min(100, Math.max(0, Number(r.usage_percent) || 0));
            const barColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#059669';
            const badgeBg = pct >= 90 ? '#fee2e2' : pct >= 70 ? '#fef3c7' : '#dcfce7';

            return (
              <label
                key={r.shop_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr 140px 80px',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: selected.includes(r.shop_id) ? '#f0f7ff' : '#ffffff',
                  border: `1px solid ${selected.includes(r.shop_id) ? '#bfdbfe' : '#f1f5f9'}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(r.shop_id)}
                  onChange={e => setSelected(e.target.checked ? [...selected, r.shop_id] : selected.filter(id => id !== r.shop_id))}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  {r.shop_name}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: barColor,
                    background: badgeBg
                  }}>
                    {pct}%
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

