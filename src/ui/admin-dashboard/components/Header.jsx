import React from 'react';

export default function Header() {
  return (
    <header className="header">
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Search shops, users..." 
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid var(--border)',
            padding: '8px 16px',
            borderRadius: '6px',
            color: 'white',
            width: '300px'
          }}
        />
      </div>
      <div className="user-profile">
        <span className="badge badge-success">System Admin</span>
      </div>
    </header>
  );
}
