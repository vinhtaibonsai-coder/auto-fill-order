import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

export default function SyncSettings() {
  const [outbox, setOutbox] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('Đang kiểm tra...');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadOutbox();
  }, []);

  const loadOutbox = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(
        `${configRes.url}/rest/v1/sync_outbox?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&limit=50&select=operation,table_name,status,error_message,created_at`,
        {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        setOutbox(rows || []);
        setSyncStatus('Đang kết nối');
      } else {
        setSyncStatus('Không truy cập được Cloud');
      }
    } catch (err) {
      console.error('Lỗi tải sync outbox:', err);
      setSyncStatus('Không truy cập được Cloud');
    }
    setIsLoading(false);
  };

  const handleSyncNow = () => {
    setIsSyncing(true);
    // Đẩy outbox là việc của background worker; đây chỉ refresh trạng thái
    setTimeout(() => {
      loadOutbox();
      setIsSyncing(false);
    }, 600);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('vi-VN');
    } catch (_) {
      return '';
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Sync Settings</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Quản lý trạng thái đồng bộ dữ liệu giữa thiết bị hiện tại và Cloud Server (Supabase).
      </p>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Trạng thái Cloud</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Mọi thay đổi cục bộ sẽ được đồng bộ lên hệ thống chung của Shop.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: syncStatus === 'Đang kết nối' ? '#ecfdf5' : '#fef3c7', padding: '8px 16px', borderRadius: '99px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: syncStatus === 'Đang kết nối' ? '#10b981' : '#d97706' }}></div>
            <span style={{ color: syncStatus === 'Đang kết nối' ? '#047857' : '#92400e', fontWeight: 600, fontSize: '14px' }}>{syncStatus}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Hàng chờ đồng bộ (Outbox)</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Khi rớt mạng, các đơn hàng và sửa đổi sẽ nằm ở đây và tự đẩy lên khi có mạng lại.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Thời gian</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Hành động</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</td>
              </tr>
            ) : outbox.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có dữ liệu chờ đồng bộ.</td>
              </tr>
            ) : outbox.map((item, i) => (
              <tr key={item.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{formatTime(item.created_at)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                  <strong>{item.operation}</strong> {item.table_name}
                  {item.error_message && <div style={{ fontSize: '11px', color: '#dc2626' }}>{item.error_message}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                    background: item.status === 'PENDING' ? 'rgba(245, 158, 11, 0.12)' : item.status === 'FAILED' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    color: item.status === 'PENDING' ? '#d97706' : item.status === 'FAILED' ? '#dc2626' : '#10b981'
                  }}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            style={{ background: 'white', color: '#334155', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: isSyncing ? 'default' : 'pointer' }}
          >
            {isSyncing ? '🔄 Đang kiểm tra...' : '🔄 Đồng bộ ngay'}
          </button>
        </div>
      </div>
    </div>
  );
}