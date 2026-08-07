import React from 'react';

export default function Header() {
  return (
    <header className="header">
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
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        />
      </div>
      <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Master Admin</span>
        <span className="badge badge-success">SYSTEM_ADMIN</span>
      </div>
    </header>
  );
}
