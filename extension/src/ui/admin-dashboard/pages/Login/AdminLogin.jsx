import React, { useState, useEffect } from 'react';
import { AuthService } from '../../../../domain/auth/auth.service.esm.js';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleKeyUp = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Đăng nhập sử dụng AuthService chuẩn của hệ thống
      const res = await AuthService.loginWithUsernameOrEmail(email, password);
      
      // Ở Admin Dashboard, chúng ta có thể kiểm tra Role của user sau khi đăng nhập thành công
      const role = await AuthService.getUserRole();
      if (['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(role)) {
        onLoginSuccess();
      } else {
        // Đăng xuất ngay lập tức nếu không có quyền Admin
        await AuthService.logout();
        setError('Truy cập bị từ chối: Tài khoản của bạn không có quyền Quản trị viên (Admin).');
      }
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        padding: '40px 32px',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)',
        width: '100%',
        maxWidth: '400px',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '56px', height: '56px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>Admin Portal</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Đăng nhập để quản trị hệ thống SaaS</p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span style={{ fontWeight: 500 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Email hoặc Username
            </label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyUp={handleKeyUp}
              autoCapitalize="none"
              autoComplete="username"
              placeholder="Nhập email quản trị..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: 500
              }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyUp={handleKeyUp}
                autoCapitalize="none"
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontWeight: 500
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {capsLockActive && (
              <div style={{ color: '#b45309', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <span style={{ fontSize: '14px' }}>⚠️</span> Caps Lock đang được bật
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              marginTop: '12px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.3)', e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.2)', e.currentTarget.style.transform = 'translateY(0)')}
            onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'translateY(1px)')}
          >
            {loading ? 'Đang xác thực bảo mật...' : 'Đăng nhập vào Hệ thống'}
          </button>
        </form>
      </div>
    </div>
  );
}
