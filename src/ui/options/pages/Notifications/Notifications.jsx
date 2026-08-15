import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(`${configRes.url}/rest/v1/rpc/system_get_notifications`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_shop_id: sess.active_shop_id })
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Lỗi tải thông báo:', err);
    }
    setIsLoading(false);
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
      <h2 className="page-title">Notifications & Alerts</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Các thông báo hệ thống của Shop (lời mời thành viên, sự kiện, cảnh báo).
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chưa có thông báo nào.
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{n.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{n.content}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                  background: n.level === 'ERROR' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: n.level === 'ERROR' ? '#dc2626' : 'var(--success)', marginBottom: '4px'
                }}>
                  {n.level || 'INFO'}
                </span>
                <div>{formatTime(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Tùy chọn kênh thông báo (email/SMS) sẽ được quản lý tập trung trên Admin Dashboard.
      </div>
    </div>
  );
}