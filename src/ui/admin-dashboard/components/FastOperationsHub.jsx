import React from 'react';
import { PlusCircle, Zap, UserPlus, Rocket } from 'lucide-react';

export default function FastOperationsHub({ onCreateShop, onTopupQuota, onInviteAdmin, onPublishRelease }) {
  return (
    <div aria-label="Công cụ quản trị nhanh" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={onCreateShop}
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          boxShadow: '0 2px 4px rgba(37,99,235,0.25)'
        }}
      >
        <PlusCircle size={14} />
        + Tạo Shop
      </button>

      <button
        onClick={onTopupQuota}
        style={{
          background: '#fef3c7',
          color: '#b45309',
          border: '1px solid #fde68a',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <Zap size={14} color="#d97706" />
        Cấp Quota AI
      </button>

      <button
        onClick={onInviteAdmin}
        style={{
          background: '#f3e8ff',
          color: '#7e22ce',
          border: '1px solid #e9d5ff',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <UserPlus size={14} color="#7e22ce" />
        + Thêm Admin
      </button>

      <button
        onClick={onPublishRelease}
        style={{
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <Rocket size={14} color="#2563eb" />
        Phát hành Extension
      </button>
    </div>
  );
}
