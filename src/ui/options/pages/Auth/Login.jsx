import React, { useState, useEffect } from 'react';
import { AuthService } from '../../../../domain/auth/auth.service.js';

export default function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    AuthService.isAuthenticated().then(isAuth => {
      if (isAuth) {
        if (onLoginSuccess) onLoginSuccess();
      }
    });
  }, [onLoginSuccess]);

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
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px' }}>
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>
          {isLogin ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản'}
        </h2>
        
        {error && (
          <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Họ và tên</label>
              <input 
                type="text" 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                required={!isLogin}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Đang xử lý...' : (isLogin ? 'Đăng Nhập' : 'Đăng Ký')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          </span>
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, marginLeft: '8px' }}
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
