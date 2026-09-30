import React, { useEffect, useState } from 'react';
import { Search, Shield, ExternalLink, Store, LogOut } from 'lucide-react';

export default function Header({ onLogout, operations, userRole, onSearch, searchResults = [], searchLoading = false, onSearchResult }) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => onSearch?.(query), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const roleLabel = userRole === 'SUPPORT_STAFF' ? 'Nhân viên hỗ trợ' : userRole === 'FINANCE_ADMIN' ? 'Quản trị tài chính' : 'Quản trị hệ thống';
  const openWorkspace = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      window.open(chrome.runtime.getURL('index.html'), '_blank');
      return;
    }

    window.location.assign('/workspace');
  };

  const openShopControl = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }

    window.location.assign('/options');
  };

  return (
    <header className="header">
      {/* Left: Quick Search */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
        <input
          type="text"
          aria-label="Tìm kiếm toàn hệ thống"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm kiếm shop, người dùng, ticket hỗ trợ..."
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            padding: '8px 14px 8px 34px',
            borderRadius: '8px',
            color: '#0f172a',
            fontSize: '13px',
            width: '300px',
            maxWidth: '30vw',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            outline: 'none',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#cbd5e1';
            e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
          }}
        />
        {query.trim().length >= 2 && (
          <div style={{ position: 'absolute', top: 40, left: 0, width: 360, maxHeight: 320, overflowY: 'auto', zIndex: 50, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 9, boxShadow: '0 12px 30px rgba(15,23,42,.15)' }}>
            {searchLoading ? <div style={{ padding: 12, color: '#64748b' }}>Đang tìm…</div> : searchResults.length ? searchResults.map(item => (
              <button key={`${item.type}-${item.id}`} onMouseDown={e => e.preventDefault()} onClick={() => { onSearchResult?.(item); setQuery(''); }} style={{ width: '100%', padding: '10px 12px', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                <strong style={{ display: 'block', color: '#0f172a' }}>{item.title}</strong><small style={{ color: '#64748b' }}>{item.type} · {item.subtitle}</small>
              </button>
            )) : <div style={{ padding: 12, color: '#64748b' }}>Không tìm thấy kết quả.</div>}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {operations}

        {/* User Role Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <Shield size={14} color="#2563eb" />
          <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 700 }}>{roleLabel}</span>
          <span
            className="badge badge-success"
            style={{
              background: '#dcfce7',
              color: '#15803d',
              padding: '2px 7px',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}
          >
            {userRole || 'ADMIN'}
          </span>
        </div>

        {/* Action Buttons */}
        <button
          onClick={openWorkspace}
          style={{
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ExternalLink size={13} color="#64748b" />
          Trang Workspace
        </button>

        <button
          onClick={openShopControl}
          style={{
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Store size={13} color="#64748b" />
          Quản trị Shop
        </button>

        {onLogout && (
          <>
            <div style={{ width: '1px', height: '22px', background: '#e2e8f0' }} />
            <button
              onClick={onLogout}
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
                minWidth: '96px',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#fca5a5';
                e.currentTarget.style.color = '#7f1d1d';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.color = '#b91c1c';
              }}
            >
              <LogOut size={13} />
              Đăng xuất
            </button>
          </>
        )}
      </div>
    </header>
  );
}
