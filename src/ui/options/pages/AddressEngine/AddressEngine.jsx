import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

export default function AddressEngine() {
  const [aliases, setAliases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadAliases();
  }, []);

  const getClient = async () => {
    const configRes = await globalThis.SupabaseCloud.loadConfig();
    const sess = await AuthSession.getSession();
    return { configRes, sess };
  };

  const loadAliases = async () => {
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(
        `${configRes.url}/rest/v1/shop_address_aliases?shop_id=eq.${sess.active_shop_id}&order=created_at.asc&select=id,original,mapping`,
        {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        setAliases(rows || []);
      }
    } catch (err) {
      console.error('Lỗi tải từ điển địa chỉ:', err);
    }
    setIsLoading(false);
  };

  const handleAdd = async () => {
    const original = prompt('Nhập từ khóa viết tắt (VD: q1):');
    if (!original) return;
    const mapping = prompt('Nhập địa chỉ chuẩn xác (VD: Quận 1, TP Hồ Chí Minh):');
    if (!mapping) return;

    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setStatus('❌ Phiên đăng nhập không hợp lệ.');
        return;
      }
      const res = await fetch(`${configRes.url}/rest/v1/shop_address_aliases`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          shop_id: sess.active_shop_id,
          original: original.trim(),
          mapping: mapping.trim()
        })
      });
      if (res.ok) {
        const row = await res.json();
        setAliases(prev => [...prev, ...row]);
        setStatus('✅ Đã lưu từ khóa lên Cloud (đồng bộ mọi máy).');
        setTimeout(() => setStatus(''), 3000);
      } else {
        const data = await res.json();
        setStatus('❌ ' + (data.message || 'Không lưu được (có thể trùng từ khóa hoặc mất quyền).'));
      }
    } catch (err) {
      setStatus('❌ Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa từ khóa này?')) return;
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.access_token) return;
      const res = await fetch(`${configRes.url}/rest/v1/shop_address_aliases?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`
        }
      });
      if (res.ok) {
        setAliases(prev => prev.filter(a => a.id !== id));
        setStatus('✅ Đã xóa từ khóa.');
        setTimeout(() => setStatus(''), 3000);
      } else {
        setStatus('❌ Không xóa được từ khóa.');
      }
    } catch (err) {
      setStatus('❌ Lỗi: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">Từ điển địa chỉ (Address Engine)</h2>
        <button onClick={handleAdd} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          + Thêm Từ khóa
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Dạy AI hiểu các từ lóng, viết tắt địa phương để tăng độ chính xác khi nhận diện địa chỉ. Dữ liệu lưu trên Cloud theo Shop — đồng bộ mọi máy.
      </p>
      {status && <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 600 }}>{status}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Từ khóa viết tắt</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Địa chỉ chuẩn xác</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', width: '100px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</td></tr>
            ) : aliases.map(alias => (
              <tr key={alias.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', fontWeight: 600 }}>{alias.original}</td>
                <td style={{ padding: '16px', color: 'var(--primary)' }}>{alias.mapping}</td>
                <td style={{ padding: '16px' }}>
                  <button onClick={() => handleDelete(alias.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
                </td>
              </tr>
            ))}
            {!isLoading && aliases.length === 0 && (
              <tr>
                <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có từ điển nào</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
