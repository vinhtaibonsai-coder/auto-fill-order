import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(
        `${configRes.url}/rest/v1/audit_logs?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&limit=100&select=user_id,action,entity_type,entity_id,details,created_at`,
        {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        setLogs(rows || []);
      }
    } catch (err) {
      console.error('Lỗi tải audit logs:', err);
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
    <div style={{ maxWidth: '900px' }}>
      <h2 className="page-title">Audit Logs</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Lưu vết toàn bộ hoạt động của nhân viên trên hệ thống (Tạo, Sửa, Xóa đơn hàng, cấu hình).
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Thời gian</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Nhân viên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Hành động</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có hoạt động nào được ghi nhận.</td>
              </tr>
            ) : logs.map((log, i) => (
              <tr key={log.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(log.created_at)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                  {log.user_id ? String(log.user_id).slice(0, 8) + '…' : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                    background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb'
                  }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {log.entity_type ? `${log.entity_type}${log.entity_id ? ': ' + log.entity_id : ''}` : (log.details ? JSON.stringify(log.details) : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}