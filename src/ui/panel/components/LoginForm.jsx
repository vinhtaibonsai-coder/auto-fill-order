import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowBigUpDash, Loader2 } from 'lucide-react';

export default function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const emailInputRef = useRef(null);

  // Focus ô đầu tiên khi render
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const checkCapsLock = (e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || isLoading) return;
    setIsLoading(true);
    try {
      if (window.AuthService) {
        const res = await window.AuthService.loginWithUsernameOrEmail(email, password);
        if (res) {
          if (onLoginSuccess) onLoginSuccess();
        }
      } else {
        alert("AuthService not found");
      }
    } catch (err) {
      alert("Lỗi đăng nhập: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOptions = (e) => {
    e.preventDefault();
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    } else {
      alert("Extension context đã được cập nhật. Vui lòng tải lại trang (F5).");
    }
  };

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '13px' }}>Đăng nhập để dùng AI</div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <input 
            ref={emailInputRef}
            type="text" 
            inputMode="email"
            placeholder="Email hoặc Số điện thoại" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', paddingRight: '30px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          {email && (
            <button 
              type="button"
              onClick={() => { setEmail(''); emailInputRef.current?.focus(); }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8', display: 'flex' }}
              title="Xóa nhanh"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input 
            type="password" 
            placeholder="Mật khẩu" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={checkCapsLock}
            onKeyDown={checkCapsLock}
            onFocus={(e) => { setIsFocused(true); checkCapsLock(e); }}
            onBlur={() => setIsFocused(false)}
            style={{ width: '100%', padding: '8px', paddingRight: (isFocused && capsLockOn) ? '135px' : '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
          />
          {isFocused && capsLockOn && (
            <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#d97706', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 500, pointerEvents: 'none' }}>
              <ArrowBigUpDash size={14} style={{ marginRight: '2px' }} /> Đang bật Caps Lock
            </div>
          )}
        </div>

        <button 
          type="submit"
          className="af-btn-primary" 
          disabled={!email || !password || isLoading}
          style={{ width: '100%', opacity: (!email || !password || isLoading) ? 0.6 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
        >
          {isLoading ? <><Loader2 size={14} className="af-spin" /> Đang đăng nhập...</> : 'Đăng nhập'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px' }}>
        <a href="#" onClick={handleOpenOptions} style={{ color: 'var(--primary)' }}>Đăng ký / Quên mật khẩu?</a>
      </div>
    </div>
  );
}
