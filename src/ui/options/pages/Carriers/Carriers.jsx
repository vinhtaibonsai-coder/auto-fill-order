import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

const DEFAULT_CARRIERS = [
  { id: 'vnpost', name: 'VNPost', connected: false, account: '' },
  { id: 'jt', name: 'J&T Express', connected: false, account: '' }
];

export default function Carriers() {
  const [carriers, setCarriers] = useState(DEFAULT_CARRIERS);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadCarriers();
  }, []);

  const getClient = async () => {
    const configRes = await globalThis.SupabaseCloud.loadConfig();
    const sess = await AuthSession.getSession();
    return { configRes, sess };
  };

  const loadCarriers = async () => {
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(
        `${configRes.url}/rest/v1/carrier_configs?shop_id=eq.${sess.active_shop_id}&select=carrier_id,is_connected,account_username`,
        {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const byId = {};
          rows.forEach(r => { byId[r.carrier_id] = r; });
          setCarriers(DEFAULT_CARRIERS.map(c => {
            const db = byId[c.id];
            return db ? { ...c, connected: !!db.is_connected, account: db.account_username || '' } : c;
          }));
        }
      }
    } catch (err) {
      console.error('Lỗi tải cấu hình carrier:', err);
    }
    setIsLoading(false);
  };

  const saveState = async (carrierId, connected, account) => {
    const { configRes, sess } = await getClient();
    if (!sess || !sess.active_shop_id || !sess.access_token) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }
    const baseHeaders = {
      'apikey': configRes.anonKey,
      'Authorization': `Bearer ${sess.access_token}`,
      'Content-Type': 'application/json'
    };
    const payload = {
      shop_id: sess.active_shop_id,
      carrier_id: carrierId,
      is_connected: connected,
      account_username: account || null
    };
    // Thử UPDATE trước (row đã tồn tại), nếu 0 row -> INSERT mới
    const patchRes = await fetch(
      `${configRes.url}/rest/v1/carrier_configs?shop_id=eq.${sess.active_shop_id}&carrier_id=eq.${carrierId}`,
      {
        method: 'PATCH',
        headers: { ...baseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      }
    );
    if (patchRes.ok) {
      const rows = await patchRes.json();
      if (rows && rows.length > 0) return;
    }
    const postRes = await fetch(`${configRes.url}/rest/v1/carrier_configs`, {
      method: 'POST',
      headers: { ...baseHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!postRes.ok) {
      const data = await postRes.json();
      throw new Error(data.message || 'Không cập nhật được cấu hình carrier (cần quyền OWNER).');
    }
  };

  const handleConnect = async (carrierId) => {
    if (!loginForm.username || !loginForm.password) {
      alert("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    setStatus(`Đang liên kết ${carrierId}...`);
    try {
      // Ưu tiên nhờ background tự động đăng nhập + tiêm cookie (nếu có handler)
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const res = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'autoLoginVnpost', ...loginForm }, resolve);
          });
          if (res && res.ok === false) {
            setStatus(`⚠️ ${res.error || 'Background từ chối đăng nhập'} — vẫn lưu cấu hình tài khoản.`);
          }
        } catch (_) {}
      }
      await saveState(carrierId, true, loginForm.username);
      setCarriers(prev => prev.map(c => c.id === carrierId ? { ...c, connected: true, account: loginForm.username } : c));
      setStatus(`✅ Đã liên kết tài khoản ${loginForm.username} lên Cloud.`);
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('❌ ' + err.message);
    }
  };

  const handleDisconnect = async (carrierId) => {
    try {
      await saveState(carrierId, false, '');
      setCarriers(prev => prev.map(c => c.id === carrierId ? { ...c, connected: false, account: '' } : c));
      setStatus('✅ Đã ngắt kết nối.');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setStatus('❌ ' + err.message);
    }
  };

  return (
    <div>
      <h2 className="page-title">Carrier Configurations</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Kết nối tài khoản hãng vận chuyển để Panel có thể tự động điền đơn và đồng bộ trạng thái. Dữ liệu lưu trên Cloud theo Shop.
      </p>
      {status && <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 600 }}>{status}</div>}

      {isLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải...</div>
      ) : (
        <div className="grid-cols-2">
          {carriers.map(carrier => (
            <div key={carrier.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>{carrier.name}</h3>
                <span style={{
                  padding: '4px 8px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                  background: carrier.connected ? 'rgba(16, 185, 129, 0.1)' : '#f1f5f9',
                  color: carrier.connected ? 'var(--success)' : 'var(--text-muted)'
                }}>
                  {carrier.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {carrier.connected ? (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                    Account: <strong>{carrier.account}</strong>
                  </div>
                  <button
                    style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', width: '100%' }}
                    onClick={() => handleDisconnect(carrier.id)}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                    Nhập tài khoản {carrier.name} để hệ thống tự động đăng nhập ngầm.
                  </div>
                  <input
                    type="text"
                    placeholder="Tên đăng nhập"
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                    style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    style={{ width: '100%', padding: '8px', marginBottom: '16px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  />
                  <button
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', width: '100%' }}
                    onClick={() => handleConnect(carrier.id)}
                  >
                    Connect {carrier.name}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
