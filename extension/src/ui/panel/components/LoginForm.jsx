import React, { useState, useRef, useEffect } from 'react';
import { KeyRound, UserCheck, Shield, RefreshCw, ChevronRight, Store, User, Lock, AlertCircle } from 'lucide-react';

export default function LoginForm({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('PIN'); // 'PIN' hoặc 'OWNER'
  const [isTrusted, setIsTrusted] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  // PIN mode fields
  const [shopCode, setShopCode] = useState('');
  const [shopName, setShopName] = useState('');
  const [loginName, setLoginName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [pin, setPin] = useState('');
  const [deviceName, setDeviceName] = useState('Máy trạm lên đơn');

  // Owner mode fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'last_shop_code', 'last_login_name', 'staff_name', 'shop_name', 'fbDeviceName', 'device_pending_approval'
      ], (res) => {
        if (res?.last_shop_code && res?.last_login_name) {
          setShopCode(res.last_shop_code);
          setLoginName(res.last_login_name);
          setStaffName(res.staff_name || res.last_login_name);
          setShopName(res.shop_name || '');
          setIsTrusted(true);
        }
        if (res?.fbDeviceName) setDeviceName(res.fbDeviceName);
        if (res?.device_pending_approval) setIsPendingApproval(true);
      });
    }
  }, []);

  useEffect(() => {
    setErrorMsg('');
    if (activeTab === 'PIN' && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [activeTab, isTrusted, isPendingApproval]);

  // Xử lý đăng nhập PIN 6 số
  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    const cleanShop = (shopCode || '').trim().toUpperCase();
    const cleanUser = (loginName || '').trim().toLowerCase();
    const cleanPin = (pin || '').trim();

    if (!cleanShop || !cleanUser) {
      setErrorMsg('Vui lòng nhập Mã Shop & Tên đăng nhập');
      return;
    }
    if (!cleanPin || cleanPin.length !== 6) {
      setErrorMsg('Mã PIN phải bao gồm 6 chữ số');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const authService = window.AuthService || globalThis.AuthService;
      if (authService && typeof authService.loginWithPin === 'function') {
        const res = await authService.loginWithPin({
          shopCode: cleanShop,
          loginName: cleanUser,
          pin: cleanPin,
          deviceName: deviceName
        });
        if (res && onLoginSuccess) onLoginSuccess();
      } else {
        throw new Error('Dịch vụ xác thực PIN chưa sẵn sàng');
      }
    } catch (err) {
      if (err.code === 'DEVICE_PENDING_APPROVAL') {
        setIsPendingApproval(true);
        setErrorMsg('');
      } else {
        setErrorMsg(err.message || 'Mã PIN không đúng');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Kiểm tra lại trạng thái duyệt
  const handleCheckPending = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const authService = window.AuthService || globalThis.AuthService;
      if (authService && typeof authService.loginWithPin === 'function') {
        await authService.loginWithPin({
          shopCode: shopCode,
          loginName: loginName,
          pin: pin || '000000',
          deviceName: deviceName
        });
        setIsPendingApproval(false);
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      if (err.code === 'DEVICE_PENDING_APPROVAL') {
        setErrorMsg('Máy trạm đang chờ Chủ Shop duyệt.');
      } else if (err.message && err.message.includes('PIN')) {
        setIsPendingApproval(false);
        setErrorMsg('Thiết bị đã được duyệt! Nhập mã PIN 6 số để vào ca.');
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý đăng nhập Chủ Shop
  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const authService = window.AuthService || globalThis.AuthService;
      if (authService) {
        const res = await authService.login(email, password);
        if (res && onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Đăng nhập thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOptions = (e) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    }
  };

  return (
    <div style={{
      marginTop: '10px',
      padding: '12px',
      background: '#f8fafc',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '6px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => { setActiveTab('PIN'); setErrorMsg(''); setIsPendingApproval(false); }}
          style={{
            flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: 700, border: 'none', borderRadius: '4px',
            cursor: 'pointer', background: activeTab === 'PIN' ? '#ffffff' : 'transparent',
            color: activeTab === 'PIN' ? '#16a34a' : '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
          }}
        >
          <KeyRound size={13} /> Nhân Viên (PIN)
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('OWNER'); setErrorMsg(''); setIsPendingApproval(false); }}
          style={{
            flex: 1, padding: '6px 8px', fontSize: '11px', fontWeight: 700, border: 'none', borderRadius: '4px',
            cursor: 'pointer', background: activeTab === 'OWNER' ? '#ffffff' : 'transparent',
            color: activeTab === 'OWNER' ? '#16a34a' : '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
          }}
        >
          <UserCheck size={13} /> Chủ Shop
        </button>
      </div>

      {errorMsg && (
        <div style={{ padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px', fontSize: '11px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} /> {errorMsg}
        </div>
      )}

      {/* ─── TAB 1: NHÂN VIÊN PIN ─────────────── */}
      {activeTab === 'PIN' && (
        <div>
          {isPendingApproval ? (
            <div style={{ textAlign: 'center', padding: '8px 4px' }}>
              <RefreshCw size={24} color="#d97706" style={{ margin: '0 auto 6px', animation: 'spin 3s linear infinite' }} />
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
                Thiết Bị Đang Chờ Duyệt
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                Chủ Shop cần duyệt máy trong <strong>Quản lý thiết bị</strong>.
              </div>
              <button
                type="button"
                onClick={handleCheckPending}
                disabled={isLoading}
                style={{
                  width: '100%', padding: '8px', background: '#16a34a', color: '#fff', border: 'none',
                  borderRadius: '6px', fontWeight: 700, fontSize: '11px', cursor: 'pointer'
                }}
              >
                Kiểm tra lại
              </button>
            </div>
          ) : isTrusted ? (
            /* Máy tin cậy: Chỉ nhập PIN 6 số */
            <form onSubmit={handlePinSubmit}>
              <div style={{
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px',
                marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{staffName || loginName}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Shop: {shopName || shopCode}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsTrusted(false); setPin(''); }}
                  style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Đổi
                </button>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <input
                  ref={pinInputRef}
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPin(val);
                    if (val.length === 6) setTimeout(() => handlePinSubmit(), 100);
                  }}
                  placeholder="• • • • • •"
                  style={{
                    width: '100%', padding: '10px', fontSize: '18px', textAlign: 'center', letterSpacing: '8px',
                    borderRadius: '8px', border: '2px solid #cbd5e1', outline: 'none', boxSizing: 'border-box',
                    fontWeight: 800, color: '#0f172a', background: '#ffffff'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || pin.length !== 6}
                style={{
                  width: '100%', padding: '9px', background: pin.length === 6 ? '#16a34a' : '#cbd5e1',
                  color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  cursor: pin.length === 6 ? 'pointer' : 'not-allowed'
                }}
              >
                {isLoading ? 'Đang vào ca...' : 'Đăng Nhập Vào Ca'}
              </button>
            </form>
          ) : (
            /* Máy mới: Nhập Shop Code + Username + PIN */
            <form onSubmit={handlePinSubmit}>
              <div style={{ marginBottom: '6px' }}>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                  placeholder="Mã Shop (VD: LTS)"
                  required
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                    fontSize: '12px', boxSizing: 'border-box', textTransform: 'uppercase', fontWeight: 700
                  }}
                />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <input
                  type="text"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value.toLowerCase())}
                  placeholder="Tên đăng nhập (VD: yen)"
                  required
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                    fontSize: '12px', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Mã PIN 6 số"
                  required
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                    fontSize: '12px', boxSizing: 'border-box', letterSpacing: '3px', fontWeight: 700
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%', padding: '9px', background: '#16a34a', color: '#ffffff',
                  border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {isLoading ? 'Đang xác thực...' : 'Kích Hoạt & Vào Ca'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ─── TAB 2: CHỦ SHOP EMAIL ─────────────── */}
      {activeTab === 'OWNER' && (
        <form onSubmit={handleOwnerSubmit}>
          <div style={{ marginBottom: '6px' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Chủ Shop"
              required
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                fontSize: '12px', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              required
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                fontSize: '12px', boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', padding: '9px', background: '#16a34a', color: '#ffffff',
              border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng Nhập Quản Trị'}
          </button>
        </form>
      )}

      <div style={{ textAlign: 'center', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
        <a href="#" onClick={handleOpenOptions} style={{ fontSize: '10px', color: '#64748b', textDecoration: 'none' }}>
          ⚙️ Mở Trang Cài Đặt (Options)
        </a>
      </div>
    </div>
  );
}
