import React, { useState, useEffect, useRef } from 'react';
import { AuthService } from '../../../../domain/auth/auth.service.esm.js';
import ServerSettings from '../Server/ServerSettings';
import { Shield, KeyRound, User, Lock, Store, Monitor, RefreshCw, AlertCircle, CheckCircle2, ChevronRight, UserCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('pin'); // 'pin' | 'owner'
  const [isTrusted, setIsTrusted] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  // Form Fields - PIN Flow
  const [shopCode, setShopCode] = useState('');
  const [shopName, setShopName] = useState('');
  const [loginName, setLoginName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [pin, setPin] = useState('');
  const [deviceName, setDeviceName] = useState('Máy trạm lên đơn');

  // Form Fields - Owner Flow
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const [recentAccounts, setRecentAccounts] = useState([]);
  const pinInputRef = useRef(null);

  const loadRecentAccounts = async () => {
    try {
      const list = await AuthService.getRecentAccounts();
      setRecentAccounts(list || []);
    } catch (_) {}
  };

  useEffect(() => {
    // Check if already authenticated
    AuthService.isAuthenticated().then(isAuth => {
      if (isAuth && onLoginSuccess) onLoginSuccess();
    });

    loadRecentAccounts();

    // Check trusted device context
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
  }, [onLoginSuccess]);

  const handleSelectRecentAccount = async (acc) => {
    setError('');
    setSuccessMsg('');
    if (acc.type === 'owner') {
      setAuthMode('owner');
      setEmail(acc.email || '');
      // Focus password
    } else {
      setAuthMode('pin');
      setShopCode(acc.shopCode || '');
      setLoginName(acc.loginName || '');
      setStaffName(acc.fullName || acc.loginName || '');
      setShopName(acc.shopName || '');
      setIsTrusted(true);
      // Fast login if no pin needed
      setIsLoading(true);
      try {
        await AuthService.loginWithPin({
          shopCode: acc.shopCode,
          loginName: acc.loginName,
          pin: '000000', // Sẽ pass nếu không cài PIN
          deviceName: deviceName
        });
        setSuccessMsg('Đăng nhập nhanh thành công!');
        if (onLoginSuccess) onLoginSuccess();
      } catch (err) {
        setIsLoading(false);
        // Yêu cầu gõ PIN nếu shop có cài đặt PIN
        if (pinInputRef.current) pinInputRef.current.focus();
      }
    }
  };

  const handleRemoveRecent = async (e, id) => {
    e.stopPropagation();
    const updated = await AuthService.removeRecentAccount(id);
    setRecentAccounts(updated);
  };

  // Đăng nhập bằng mã PIN 6 số
  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanShop = (shopCode || '').trim().toUpperCase();
    const cleanUser = (loginName || '').trim().toLowerCase();
    const cleanPin = (pin || '').trim();

    if (!cleanShop || !cleanUser) {
      setError('Vui lòng nhập đầy đủ Mã Shop và Tên nhân viên!');
      return;
    }
    if (cleanPin && cleanPin.length > 0 && (!/^[0-9]{6}$/.test(cleanPin) || cleanPin.length !== 6)) {
      setError('Mã PIN phải bao gồm đúng 6 chữ số!');
      return;
    }

    setIsLoading(true);
    try {
      await AuthService.loginWithPin({
        shopCode: cleanShop,
        loginName: cleanUser,
        pin: cleanPin || null,
        deviceName: deviceName
      });
      setSuccessMsg('Đăng nhập ca làm việc thành công!');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      if (err.code === 'DEVICE_PENDING_APPROVAL') {
        setIsPendingApproval(true);
        setError('');
      } else {
        setError(err.message || 'Mã PIN hoặc thông tin đăng nhập không đúng.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Kiểm tra lại trạng thái duyệt máy
  const handleCheckPendingStatus = async () => {
    setIsLoading(true);
    setError('');
    try {
      await AuthService.loginWithPin({
        shopCode: shopCode,
        loginName: loginName,
        pin: pin || '000000', // Sẽ kích hoạt check thiết bị trước hoặc yêu cầu nhập PIN
        deviceName: deviceName
      });
      setIsPendingApproval(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      if (err.code === 'DEVICE_PENDING_APPROVAL') {
        setError('Máy trạm vẫn đang chờ Chủ Shop phê duyệt trong mục "Quản lý thiết bị".');
      } else if (err.message && err.message.includes('PIN')) {
        // Thiết bị đã duyệt, yêu cầu nhập PIN
        setIsPendingApproval(false);
        setError('Thiết bị đã được phê duyệt! Vui lòng nhập mã PIN 6 số để vào ca.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Đăng nhập Chủ shop / Quản trị viên
  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await AuthService.login(email, password);
      } else {
        await AuthService.signup(email, password, fullName);
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Đổi tài khoản khác trên máy
  const handleSwitchAccount = () => {
    setIsTrusted(false);
    setIsPendingApproval(false);
    setPin('');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        padding: '36px 32px',
        borderRadius: '20px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)',
        width: '100%',
        maxWidth: '440px',
        boxSizing: 'border-box'
      }}>
        {/* Header Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '56px', height: '56px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 12px', boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)'
          }}>
            <Shield size={28} color="#ffffff" strokeWidth={2.2} />
          </div>
          <h1 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {authMode === 'pin' ? 'Đăng Nhập Máy Trạm' : (isLogin ? 'Đăng Nhập Quản Trị' : 'Đăng Ký Tài Khoản')}
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
            {authMode === 'pin' 
              ? 'Xác thực nhanh bằng mã PIN 6 số cho nhân viên' 
              : 'Dành cho Chủ Shop & Master Admin'}
          </p>
        </div>

        {/* Danh sách Tài Khoản Gần Đây trên máy này (1-Click Fast Login) */}
        {recentAccounts.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              ⚡ Tài khoản gần đây trên máy này
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentAccounts.map(acc => {
                const isOwner = acc.type === 'owner';
                const key = acc.email || `${acc.shopCode}_${acc.loginName}`;
                return (
                  <div
                    key={key}
                    onClick={() => handleSelectRecentAccount(acc)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.background = '#f0fdf4'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: isOwner ? '#fef3c7' : '#dcfce7',
                        color: isOwner ? '#b45309' : '#15803d',
                        display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '14px'
                      }}>
                        {isOwner ? '👑' : '📦'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                          {acc.fullName || acc.email || acc.loginName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {isOwner ? `Chủ Shop (${acc.email})` : `Shop: ${acc.shopName || acc.shopCode} · @${acc.loginName}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                        Vào ngay ➔
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveRecent(e, key)}
                        title="Xóa khỏi danh sách gần đây"
                        style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderBottom: '1px dashed #e2e8f0', margin: '18px 0' }} />
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '20px',
          gap: '6px'
        }}>
          <button
            type="button"
            onClick={() => { setAuthMode('pin'); setError(''); setIsPendingApproval(false); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: 'none',
              borderRadius: '9px',
              background: authMode === 'pin' ? '#ffffff' : 'transparent',
              color: authMode === 'pin' ? '#15803d' : '#64748b',
              fontWeight: authMode === 'pin' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: authMode === 'pin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={15} /> Nhân Viên (PIN)
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('owner'); setError(''); setIsPendingApproval(false); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: 'none',
              borderRadius: '9px',
              background: authMode === 'owner' ? '#ffffff' : 'transparent',
              color: authMode === 'owner' ? '#15803d' : '#64748b',
              fontWeight: authMode === 'owner' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: authMode === 'owner' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Store size={15} /> Chủ Shop / Admin
          </button>
        </div>

        {/* Thông báo lỗi / thành công */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#16a34a',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ─── FLOW 1: NHÂN VIÊN ĐĂNG NHẬP BẰNG PIN ─────────────── */}
        {authMode === 'pin' && (
          <div>
            {isPendingApproval ? (
              /* Trạng thái chờ Chủ Shop duyệt máy trạm */
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{
                  width: '64px', height: '64px', background: '#fef3c7', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                  boxShadow: '0 0 0 8px #fef9c3'
                }}>
                  <RefreshCw size={28} color="#d97706" style={{ animation: 'spin 3s linear infinite' }} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '17px', color: '#92400e', fontWeight: 700 }}>
                  Thiết Bị Đang Chờ Phê Duyệt
                </h3>
                <p style={{ color: '#4b5563', fontSize: '13px', lineHeight: 1.5, margin: '0 0 20px' }}>
                  Máy trạm này đã gửi yêu cầu kích hoạt vào Shop <strong>{shopName || shopCode}</strong>.
                  Vui lòng liên hệ Chủ Shop duyệt thiết bị trong mục <strong>Quản Lý Thiết Bị</strong>.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleCheckPendingStatus}
                    disabled={isLoading}
                    style={{
                      width: '100%', padding: '12px', background: '#16a34a', color: '#fff',
                      border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <RefreshCw size={16} /> Kiểm tra lại trạng thái duyệt
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    style={{
                      width: '100%', padding: '10px', background: 'transparent', color: '#64748b',
                      border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Đăng nhập tài khoản / Shop khác
                  </button>
                </div>
              </div>
            ) : isTrusted ? (
              /* Chế độ Thiết bị tin cậy: Nhập mã PIN 6 số */
              <form onSubmit={handlePinSubmit}>
                {/* User & Shop Badge */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', background: '#dcfce7', borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <UserCheck size={20} color="#16a34a" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                        {staffName || loginName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Shop: <strong>{shopName || shopCode}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#16a34a',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Đổi
                  </button>
                </div>

                {/* PIN 6-digit input */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px', textAlign: 'center' }}>
                    Nhập mã PIN 6 số vào ca
                  </label>
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
                      if (val.length === 6) {
                        // Tự động submit khi gõ đủ 6 số
                        setTimeout(() => handlePinSubmit(), 100);
                      }
                    }}
                    placeholder="• • • • • •"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '24px',
                      textAlign: 'center',
                      letterSpacing: '12px',
                      borderRadius: '12px',
                      border: '2px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: 800,
                      color: '#0f172a',
                      background: '#f8fafc'
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '6px' }}>
                    Nhập sai quá 5 lần tài khoản sẽ tạm khóa 15 phút
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || pin.length !== 6}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: pin.length === 6 ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : '#cbd5e1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: pin.length === 6 ? 'pointer' : 'not-allowed',
                    boxShadow: pin.length === 6 ? '0 10px 15px -3px rgba(22, 163, 74, 0.3)' : 'none',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isLoading ? 'Đang xác thực...' : 'Đăng Nhập Vào Ca'} <ChevronRight size={16} />
                </button>
              </form>
            ) : (
              /* Chế độ Máy mới / Thiết bị chưa tin cậy */
              <form onSubmit={handlePinSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Mã Cửa Hàng (Shop Code)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Store size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={shopCode}
                      onChange={(e) => setShopCode(e.target.value.toUpperCase())}
                      placeholder="VD: SHOP01, LTS..."
                      required
                      style={{
                        width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box',
                        textTransform: 'uppercase', fontWeight: 700
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Tên Đăng Nhập Nội Bộ
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value.toLowerCase())}
                      placeholder="VD: yen, kho1, hung..."
                      required
                      style={{
                        width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Mã PIN 6 Số
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="password"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="6 chữ số PIN (Tùy chọn)"
                      style={{
                        width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box',
                        letterSpacing: '4px', fontWeight: 700
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Tên Máy Trạm Này
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Monitor size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="VD: Máy đóng hàng 1, Máy in bill..."
                      style={{
                        width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px',
                        border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isLoading ? 'Đang kết nối...' : 'Xác Thực & Kích Hoạt Máy'} <ChevronRight size={16} />
                </button>
              </form>
            )}
          </div>
        )}

        {/* ─── FLOW 2: CHỦ SHOP & ADMIN ĐĂNG NHẬP ─────────────── */}
        {authMode === 'owner' && (
          <form onSubmit={handleOwnerSubmit}>
            {!isLogin && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Họ và Tên
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                    style={{
                      width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px',
                      border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Email Quản Trị
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@shop.com"
                  required
                  style={{
                    width: '100%', padding: '11px 12px 11px 38px', borderRadius: '10px',
                    border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Mật Khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '11px 40px 11px 38px', borderRadius: '10px',
                    border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px'
                  }}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? 'Đang xử lý...' : (isLogin ? 'Đăng Nhập Quản Trị' : 'Tạo Tài Khoản')} <ChevronRight size={16} />
            </button>
          </form>
        )}

        {/* Footer info & Server Config Toggle (Admin Only) */}
        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => setShowServerSettings(!showServerSettings)}
            style={{
              background: 'none', border: 'none', color: '#94a3b8', fontSize: '11.5px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: 0.75
            }}
          >
            {showServerSettings ? 'Ẩn cấu hình máy chủ' : '⚙️ Thiết lập máy chủ kỹ thuật (Admin)'}
          </button>
        </div>

        {showServerSettings && (
          <div style={{ marginTop: '16px', textAlign: 'left' }}>
            <ServerSettings compact />
          </div>
        )}
      </div>
    </div>
  );
}
