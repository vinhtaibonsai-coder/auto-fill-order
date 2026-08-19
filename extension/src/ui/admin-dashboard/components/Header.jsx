import React from 'react';

export default function Header({ onLogout }) {
  return (
    <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="🔍 Search shops, users, tickets..." 
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            padding: '8px 16px',
            borderRadius: '6px',
            color: '#0f172a',
            fontSize: '13px',
            width: '320px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
        />
      </div>
      <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Master Admin</span>
          <span className="badge badge-success" style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
            SYSTEM_ADMIN
          </span>
        </div>
        
        {onLogout && (
          <>
            <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>
            <button 
              onClick={onLogout}
              style={{
                background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '6px 12px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#fca5a5'}
              onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
            >
              Đăng xuất
            </button>
          </>
        )}
      </div>
    </header>
  );
}
