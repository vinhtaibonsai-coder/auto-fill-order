import React, { useState, useEffect } from 'react';

export default function ParseMode({ onParse }) {
  const [text, setText] = useState('');
  
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText && clipboardText.trim()) {
            setText(clipboardText);
            onParse(clipboardText);
          }
        } catch (err) {
          console.warn("Không thể đọc clipboard tự động:", err);
          alert("Vui lòng cấp quyền xem Clipboard cho trang này, hoặc dán thủ công.");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onParse]);

  return (
    <div className="af-panel-content">
      <textarea 
        placeholder="Dán thông tin đơn hàng thô vào đây...&#10;(Ctrl+Enter để tách nhanh)"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (text.trim()) onParse(text);
          }
        }}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
        <button 
          className="af-btn-primary" 
          onClick={() => onParse(text)}
          disabled={!text.trim()}
        >
          <span>⚡</span>
          Tách Đơn Tự Động
        </button>
        <button 
          className="af-btn-delete" 
          onClick={() => setText('')}
        >
          <span>🗑️</span>
          Xóa
        </button>
      </div>

      {/* Buttons bottom row for idle state */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
        <button className="af-btn-fill">
          <span>↓</span> Nhập đơn
        </button>
        <button className="af-btn-save">
          <span>💾</span> Lưu đơn
        </button>
      </div>
      <button className="af-btn-print" style={{ marginTop: '0px' }}>
        <span>🖨️</span> In đơn
      </button>
    </div>
  );
}
