import React, { useState, useRef, useEffect } from 'react';

export default function DraggableCard({ children, onClose, title, isAuth = false }) {
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
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
      window.open(chrome.runtime.getURL('admin-dashboard/admin.html'));
    }
  };

  const openOptions = () => {
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
      window.open(chrome.runtime.getURL('frontend/options/options.html'));
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
        style={{ cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <h2>{title}</h2>
          <span 
            title={isAuth ? 'Đã kết nối AI Server' : 'Mất kết nối AI (Chưa đăng nhập)'} 
            style={{ 
              width: 8, height: 8, borderRadius: '50%', 
              background: isAuth ? '#10b981' : '#ef4444', 
              display: 'inline-block', marginLeft: '4px',
              boxShadow: isAuth ? '0 0 5px #10b981' : 'none'
            }}
          ></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button title="Trang Admin" onClick={openAdmin} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', padding: 0 }}>🛠️</button>
          <button title="Cài đặt (Options)" onClick={openOptions} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', padding: 0 }}>⚙️</button>
          <button title="Đóng" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', padding: 0, marginLeft: '4px' }}>×</button>
        </div>
      </div>
      {children}
    </div>
  );
}
