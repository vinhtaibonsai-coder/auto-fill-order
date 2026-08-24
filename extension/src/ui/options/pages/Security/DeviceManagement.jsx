import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [maxDevices, setMaxDevices] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const headers = {
        'apikey': configRes.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const devRes = await fetch(
        `${configRes.url}/rest/v1/devices?shop_id=eq.${sess.active_shop_id}&select=id,user_id,browser_info,location_ip,last_active,status,created_at`,
        { headers }
      );
      if (devRes.ok) {
        const rows = await devRes.json();
        setDevices(rows || []);
      }

      // Hạn mức từ gói cước (RLS: chỉ OWNER đọc; staff giữ mặc định)
      try {
        const subRes = await fetch(
          `${configRes.url}/rest/v1/subscriptions?shop_id=eq.${sess.active_shop_id}&select=max_devices`,
          { headers }
        );
        if (subRes.ok) {
          const rows = await subRes.json();
          if (rows && rows.length > 0 && rows[0].max_devices) setMaxDevices(rows[0].max_devices);
        }
      } catch (_) {}
    } catch (err) {
      console.error('Lỗi tải thiết bị:', err);
    }
    setIsLoading(false);
  };

  const handleRevoke = async (id) => {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất thiết bị này khỏi Shop?")) return;
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.access_token) return;
      const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_revoke_device`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_device_id: id, p_revoked: true })
      });
      if (res.ok) {
        if (globalThis.AuditService?.logAction) {
          await globalThis.AuditService.logAction('DEVICE_REVOKED', 'device', id, {
            reason: 'Revoked from Shop Control'
          });
        }
        setDevices(prev => prev.filter(d => d.id !== id));
        setStatus('✅ Đã thu hồi thiết bị.');
        setTimeout(() => setStatus(''), 3000);
      } else {
        const data = await res.json();
        setStatus('❌ ' + (data.message || 'Không thu hồi được thiết bị.'));
      }
    } catch (err) {
      setStatus('❌ Lỗi: ' + err.message);
    }
  };

  const lastActive = (iso) => {
    if (!iso) return 'Không rõ';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Vừa xong';
      if (mins < 60) return `${mins} phút trước`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} giờ trước`;
      return `${Math.floor(hours / 24)} ngày trước`;
    } catch (_) {
      return 'Không rõ';
    }
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0 }}>💻 Thiết bị đang kết nối (Device Management)</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Quản lý danh sách trình duyệt và thiết bị nhân viên được cấp quyền truy cập Extension.
          </p>
        </div>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
          Hạn mức: {devices.length} / {maxDevices} thiết bị
        </div>
      </div>
      {status && <div style={{ marginBottom: '10px', fontSize: '13px', fontWeight: 600 }}>{status}</div>}

      {isLoading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
      ) : devices.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Chưa có thiết bị nào được liên kết với Shop. Thiết bị sẽ xuất hiện sau khi nhân viên đăng nhập Extension.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {devices.map(device => (
            <div key={device.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                  <span>{device.browser_info || 'Trình duyệt không xác định'}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  IP: {device.location_ip || '—'} • Hoạt động: {lastActive(device.last_active)} • Trạng thái: {device.status || 'ACTIVE'}
                </div>
              </div>

              <div>
                {(device.status || 'ACTIVE').toUpperCase() !== 'REVOKED' && (
                  <button
                    onClick={() => handleRevoke(device.id)}
                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    Thu hồi (Revoke)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
