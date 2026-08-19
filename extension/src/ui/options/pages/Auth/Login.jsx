import React, { useState, useEffect } from 'react';
import { AuthService } from '../../../../domain/auth/auth.service.esm.js';

export default function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  useEffect(() => {
    // Check if already logged in
    AuthService.isAuthenticated().then(isAuth => {
      if (isAuth) {
        if (onLoginSuccess) onLoginSuccess();
      }
    });
  }, [onLoginSuccess]);

  const handleKeyUp = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockActive(true);
    } else {
      setCapsLockActive(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await AuthService.login(email, password);
      } else {
        await AuthService.signup(email, password, fullName);
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        background: '#ffffff',
        padding: '40px 32px',
        borderRadius: '20px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', height: '64px', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 16px', boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {isLogin ? 'Đăng nhập hệ thống' : 'Tạo tài khoản mới'}
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '15px', fontWeight: 500 }}>
            {isLogin ? 'Chào mừng bạn quay trở lại' : 'Bắt đầu tự động hóa công việc của bạn'}
          </p>
        </div>
        
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ fontWeight: 500 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                Họ và tên
              </label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px',
                  border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none',
                  boxSizing: 'border-box', transition: 'all 0.2s', background: '#f8fafc',
                  color: '#0f172a'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              Email đăng nhập
            </label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyUp={handleKeyUp}
              autoCapitalize="none"
              autoComplete="email"
              placeholder="admin@example.com"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none',
                boxSizing: 'border-box', transition: 'all 0.2s', background: '#f8fafc',
                color: '#0f172a'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyUp={handleKeyUp}
                autoCapitalize="none"
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: '10px',
                  border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none',
                  boxSizing: 'border-box', transition: 'all 0.2s', background: '#f8fafc',
                  color: '#0f172a', paddingRight: '48px'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            {capsLockActive && (
              <div style={{ color: '#d97706', fontSize: '12px', marginTop: '6px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⚠️</span> Caps Lock đang bật
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              width: '100%', padding: '14px', marginTop: '8px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
              color: 'white', border: 'none', borderRadius: '10px', 
              fontSize: '16px', fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1, transition: 'transform 0.1s',
              boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.2), 0 2px 4px -1px rgba(34, 197, 94, 0.1)'
            }}
            onMouseDown={e => { if (!isLoading) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { if (!isLoading) e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isLoading ? 'Đang xử lý...' : (isLogin ? 'Đăng Nhập' : 'Đăng Ký')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '15px' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          </span>
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ 
              background: 'none', border: 'none', color: '#16a34a', 
              cursor: 'pointer', fontWeight: 700, marginLeft: '6px',
              padding: 0, textDecoration: 'underline'
            }}
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
