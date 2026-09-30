import React, { useCallback, useEffect, useState } from 'react';
import { Shield, ShieldCheck, Key, Lock, Eye, EyeOff, Smartphone, LogOut, CheckCircle2, AlertTriangle, Clock, MapPin, Globe, RefreshCw } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { AuthService } from '../../../../domain/auth/auth.service.esm.js';

const relativeTime = iso => {
  if (!iso) return 'Chưa ghi nhận';
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  if (m < 1440) return `${Math.floor(m / 60)} giờ trước`;
  return `${Math.floor(m / 1440)} ngày trước`;
};

export default function Security() {
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const flash = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4500);
  };

  const context = async () => {
    const config = await globalThis.SupabaseCloud.loadConfig();
    const session = await AuthSession.getSession();
    if (!session?.access_token || !session?.active_shop_id) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }
    return {
      config,
      session,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { config, session, headers } = await context();
      const stored = typeof chrome !== 'undefined' && chrome.storage?.local
        ? await chrome.storage.local.get(['device_id', 'fbDeviceId'])
        : {};
      const devId = stored.device_id || stored.fbDeviceId || '';
      setCurrentDeviceId(devId);

      try {
        const [deviceRes, logRes] = await Promise.all([
          fetch(`${config.url}/rest/v1/rpc/owner_get_devices_v2`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_shop_id: session.active_shop_id })
          }).catch(() => null),
          fetch(`${config.url}/rest/v1/audit_logs?shop_id=eq.${session.active_shop_id}&action=in.(LOGIN,PASSWORD_CHANGED,DEVICE_REVOKED,SESSION_REVOKED)&select=id,action,created_at,ip_address,details&order=created_at.desc&limit=15`, { headers }).catch(() => null)
        ]);

        if (deviceRes && deviceRes.ok) {
          const data = await deviceRes.json();
          setSessions((data.devices || []).filter(x => !x.revoked));
        } else {
          // Fallback direct table query
          const fallbackRes = await fetch(`${config.url}/rest/v1/extension_devices?shop_id=eq.${session.active_shop_id}&select=*&order=created_at.desc`, { headers }).catch(() => null);
          if (fallbackRes && fallbackRes.ok) {
            const tableData = await fallbackRes.json();
            setSessions((tableData || []).filter(x => !x.revoked));
          }
        }
        if (logRes && logRes.ok) {
          setLogs(await logRes.json());
        }
      } catch (err) {
        console.warn('[Security] Error fetching device sessions or logs:', err);
      }
    } catch (e) {
      flash('error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signOutOthers = async () => {
    if (!confirm('Đăng xuất tất cả phiên khác? Các thiết bị đó sẽ phải đăng nhập lại.')) return;
    setBusy('sessions');
    try {
      const { config, headers } = await context();
      const res = await fetch(`${config.url}/auth/v1/logout?scope=others`, { method: 'POST', headers });
      if (!res.ok) throw new Error('Không thể thu hồi các phiên khác.');
      if (globalThis.AuditService?.logAction) {
        await globalThis.AuditService.logAction('SESSION_REVOKED', 'auth_session', 'others', {});
      }
      flash('success', 'Đã đăng xuất khỏi tất cả thiết bị khác.');
      setSessions(x => x.filter(s => s.device_id === currentDeviceId));
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (form.next.length < 8 || !/[A-Za-z]/.test(form.next) || !/\d/.test(form.next)) {
      return flash('error', 'Mật khẩu mới cần ít nhất 8 ký tự, gồm cả chữ và số.');
    }
    if (form.next !== form.confirm) {
      return flash('error', 'Mật khẩu xác nhận không khớp.');
    }

    setBusy('password');
    try {
      const user = await AuthService.getCurrentUser();
      if (!user?.email) throw new Error('Không xác định được email tài khoản.');
      await AuthService.login(user.email, form.current);
      await AuthService.changePassword(form.next);
      if (globalThis.AuditService?.logAction) {
        await globalThis.AuditService.logAction('PASSWORD_CHANGED', 'profile', user.id, {});
      }
      setForm({ current: '', next: '', confirm: '' });
      flash('success', '✅ Đổi mật khẩu thành công!');
      await load();
    } catch (e) {
      flash('error', 'Mật khẩu hiện tại không đúng hoặc không thể cập nhật.');
    } finally {
      setBusy('');
    }
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 36px 10px 12px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--card)',
    color: 'var(--text-main)',
    fontSize: '13.5px',
    outline: 'none'
  };

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 20, width: '100%', boxSizing: 'border-box' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Bảo Mật Tài Khoản & Quản Lý Phiên</h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 13 }}>
          Quản lý các phiên đăng nhập đang hoạt động, đổi mật khẩu và xem lịch sử các sự kiện bảo mật.
        </p>
      </div>

      {notice && (
        <div role="status" style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: notice.type === 'error' ? 'var(--color-danger-text)' : 'var(--color-success-text)',
          background: notice.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
          border: `1px solid ${notice.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {notice.text}
        </div>
      )}

      {/* Active Sessions Card */}
      <section className="card" style={{
        padding: '22px',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone size={18} color="var(--primary)" /> Phiên Đăng Nhập Đang Hoạt Động
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12.5, margin: '3px 0 0 0' }}>
              Danh sách các trình duyệt và thiết bị đang được phép truy cập tài khoản của bạn.
            </p>
          </div>
          <button
            disabled={busy === 'sessions' || sessions.length < 2}
            onClick={signOutOthers}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: (busy === 'sessions' || sessions.length < 2) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: sessions.length < 2 ? 0.6 : 1
            }}
          >
            <LogOut size={14} />
            {busy === 'sessions' ? 'Đang đăng xuất…' : 'Đăng xuất tất cả thiết bị khác'}
          </button>
        </div>

        <div>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <RefreshCw size={18} className="spin" style={{ margin: '0 auto 8px' }} />
              <div>Đang tải thông tin phiên đăng nhập…</div>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
              Không có phiên thiết bị nào được ghi nhận.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map(s => {
                const current = s.device_id === currentDeviceId || s.id === currentDeviceId;
                return (
                  <div key={s.id || s.device_id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: current ? 'var(--primary-light)' : 'var(--bg)',
                    border: `1px solid ${current ? 'rgba(37, 99, 235, 0.25)' : 'var(--border)'}`,
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 13.5, color: 'var(--text-main)' }}>
                          {s.device_name || 'Chrome Extension'}
                        </strong>
                        {current && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'var(--color-success-bg)',
                            color: 'var(--color-success-text)',
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            ● Phiên hiện tại
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                        {s.browser || 'Google Chrome'} · {s.os_info || 'Windows'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-main)', textAlign: 'right' }}>
                        <div>{s.last_location || 'Việt Nam'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                          IP: <code>{s.last_ip || '127.0.0.1'}</code>
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 90, textAlign: 'right' }}>
                        {relativeTime(s.last_seen)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 2-Column Grid: Change Password & Security Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Form Đổi Mật Khẩu */}
        <form onSubmit={changePassword} className="card" style={{
          padding: '22px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={18} color="var(--primary)" /> Đổi Mật Khẩu Tài Khoản
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 12.5, margin: '0 0 16px 0' }}>
            Mật khẩu mới yêu cầu tối thiểu 8 ký tự, bao gồm cả chữ và số.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5 }}>
                Mật khẩu hiện tại <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass.current ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.current}
                  onChange={e => setForm(x => ({ ...x, current: e.target.value }))}
                  placeholder="Nhập mật khẩu đang sử dụng..."
                  style={inputStyle}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => ({ ...p, current: !p.current }))}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                >
                  {showPass.current ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5 }}>
                Mật khẩu mới <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass.next ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.next}
                  onChange={e => setForm(x => ({ ...x, next: e.target.value }))}
                  placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)..."
                  style={inputStyle}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => ({ ...p, next: !p.next }))}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                >
                  {showPass.next ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5 }}>
                Xác nhận mật khẩu mới <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass.confirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={e => setForm(x => ({ ...x, confirm: e.target.value }))}
                  placeholder="Nhập lại mật khẩu mới..."
                  style={inputStyle}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                >
                  {showPass.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy === 'password'}
              style={{
                marginTop: 6,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: busy === 'password' ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
            >
              {busy === 'password' ? <RefreshCw size={14} className="spin" /> : <Lock size={14} />}
              {busy === 'password' ? 'Đang cập nhật…' : 'Cập Nhật Mật Khẩu'}
            </button>
          </div>
        </form>

        {/* Hoạt Động Bảo Mật Gần Đây */}
        <section className="card" style={{
          padding: '22px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--success)" /> Hoạt Động Bảo Mật Gần Đây
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 12.5, margin: '0 0 16px 0' }}>
            Nhật ký các sự kiện đăng nhập, đổi mật khẩu và thu hồi phiên bảo mật.
          </p>

          {logs.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
              <ShieldCheck size={32} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>Chưa có sự kiện bảo mật bất thường nào.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {logs.map(log => {
                const actionLabels = {
                  LOGIN: { label: 'Đăng nhập tài khoản', color: 'var(--primary)' },
                  PASSWORD_CHANGED: { label: 'Đổi mật khẩu', color: 'var(--warning)' },
                  DEVICE_REVOKED: { label: 'Thu hồi thiết bị', color: 'var(--danger)' },
                  SESSION_REVOKED: { label: 'Đăng xuất phiên khác', color: 'var(--danger)' }
                };
                const item = actionLabels[log.action] || { label: log.action, color: 'var(--text-main)' };

                return (
                  <div key={log.id} style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong style={{ fontSize: 13, color: item.color }}>{item.label}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 2 }}>
                        {log.ip_address ? `IP: ${log.ip_address}` : 'Trình duyệt Extension'}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                      {new Date(log.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
