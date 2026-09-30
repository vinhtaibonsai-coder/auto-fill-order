import React from 'react';

export default function ImpersonationBanner({ session, onExit }) {
  if (!session?.shopId) return null;
  return <div role="alert" style={{ background: '#ffedd5', color: '#9a3412', borderBottom: '1px solid #fdba74', padding: '9px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Đang giả lập Shop: {session.shopName || session.shopId} · Chỉ dùng để hỗ trợ</strong><button onClick={onExit}>Thoát giả lập</button></div>;
}
