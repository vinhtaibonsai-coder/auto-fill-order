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
        placeholder="Dán thông tin người nhận (Tên, SĐT, Địa chỉ) vào đây..."
        value={text}
        onChange={e => setText(e.target.value)}
        style={{ minHeight: '80px', padding: '10px', fontSize: '13px', lineHeight: '1.4' }}
      />
      <button 
        className="af-btn-primary" 
        onClick={() => onParse(text)}
        disabled={!text.trim()}
      >
        <span style={{ marginRight: '6px' }}>⚡</span>
        Bóc tách AI
      </button>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
        Nhấn <kbd style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Ctrl</kbd> + <kbd style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>Shift</kbd> + <kbd style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>V</kbd> để dán và bóc tách nhanh
      </div>
    </div>
  );
}
