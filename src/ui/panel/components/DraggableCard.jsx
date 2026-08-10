import React, { useState, useRef, useEffect } from 'react';

export default function DraggableCard({ children, onClose, title, isAuth = false, session }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const openAdmin = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.id && typeof chrome.runtime.getURL === 'function') {
        window.open(chrome.runtime.getURL('admin-dashboard/admin.html'));
      } else {
        alert("Extension context đã được cập nhật. Vui lòng tải lại trang (F5).");
      }
    } catch (e) {
      alert("Extension context đã được cập nhật. Vui lòng tải lại trang (F5).");
    }
  };

  const openOptions = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.id && typeof chrome.runtime.getURL === 'function') {
        window.open(chrome.runtime.getURL('frontend/options/options.html'));
      } else {
        alert("Extension context đã được cập nhật. Vui lòng tải lại trang (F5).");
      }
    } catch (e) {
      alert("Extension context đã được cập nhật. Vui lòng tải lại trang (F5).");
    }
  };

  return (
    <div 
      className="af-panel-container"
      ref={cardRef}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default',
        transition: isDragging ? 'none' : 'transform 0.1s'
      }}
    >
      <div 
        className="af-panel-header" 
        onMouseDown={handleMouseDown}
        style={{ cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>📌</span>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>
              {window.location.href.includes('jtexpress.vn') ? 'J&T Auto Fill' : 'VNPost Auto Fill'}
            </h3>
            <span 
              title={isAuth ? 'Đã kết nối AI Server' : 'Mất kết nối AI (Chưa đăng nhập)'} 
              style={{ 
                width: 7, height: 7, borderRadius: '50%', 
                background: isAuth ? '#10b981' : '#ef4444', 
                display: 'inline-block',
                boxShadow: isAuth ? '0 0 5px #10b981' : 'none'
              }}
            ></span>
            <span className="af-panel-header-badge" style={{ fontSize: '9px', padding: '1px 3px' }}>V1</span>
          </div>
          {isAuth && (
            <div style={{ fontSize: '9px', color: '#475569', display: 'flex', gap: '8px', fontWeight: 500, lineHeight: 1 }}>
              <span title="Cửa hàng đang hoạt động">🏪 {session?.shop_name || 'Mặc định'}</span>
              <span title="Nhân viên đang đăng nhập">👤 {session?.user?.full_name || session?.user?.email || 'Ngoại tuyến'}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="af-panel-header-btn" title="Làm mới" onClick={() => window.location.reload()}>↻</button>
          <button className="af-panel-header-btn" title="Cài đặt" onClick={openOptions}>⚙</button>
          <button className="af-panel-header-btn" title="Thu nhỏ" onClick={onClose}>—</button>
        </div>
      </div>
      {children}
    </div>
  );
}
