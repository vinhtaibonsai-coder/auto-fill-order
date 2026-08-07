import React, { useState, useEffect } from 'react';

export default function Carriers() {
  const [carriers, setCarriers] = useState([
    { id: 'vnpost', name: 'VNPost', connected: false, account: '' },
    { id: 'jt', name: 'J&T Express', connected: false, account: '' }
  ]);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  useEffect(() => {
    if (chrome && chrome.storage) {
      chrome.storage.local.get(['af_carrier_config'], (res) => {
        if (res.af_carrier_config) {
          setCarriers(res.af_carrier_config);
        }
      });
    }
  }, []);

  const saveCarriers = (newCarriers) => {
    setCarriers(newCarriers);
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ 'af_carrier_config': newCarriers });
    }
  };

  const handleAutoLogin = (carrierId) => {
    if (!loginForm.username || !loginForm.password) {
      alert("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    
    // Giả lập gửi message cho background worker để tự động đăng nhập và tiêm Cookie
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'autoLoginVnpost', ...loginForm }, (res) => {
        if (res && res.ok) {
          saveCarriers(carriers.map(c => c.id === carrierId ? { ...c, connected: true, account: loginForm.username } : c));
          alert("Đăng nhập và liên kết tài khoản thành công!");
        } else {
          alert("Đăng nhập thất bại: " + (res?.error || "Lỗi không xác định"));
        }
      });
    } else {
      saveCarriers(carriers.map(c => c.id === carrierId ? { ...c, connected: true, account: loginForm.username } : c));
    }
  };

  return (
    <div>
      <h2 className="page-title">Carrier Configurations</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Kết nối tài khoản hãng vận chuyển để Panel có thể tự động điền đơn và đồng bộ trạng thái.
      </p>

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
                  onClick={() => setCarriers(prev => prev.map(c => c.id === carrier.id ? { ...c, connected: false, account: '' } : c))}
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
                  onClick={() => handleAutoLogin(carrier.id)}
                >
                  Connect {carrier.name}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
