import React, { useState, useEffect } from 'react';
import { Zap, ClipboardPaste, Trash2, ArrowDownToLine, Save, Printer } from 'lucide-react';

export default function ParseMode({ onParse, isLoading }) {
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
        disabled={isLoading}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (text.trim() && !isLoading) onParse(text);
          }
        }}
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '8px' }}>
        <button 
          className="af-btn-primary" 
          onClick={() => onParse(text)}
          disabled={!text.trim() || isLoading}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Zap size={14} /></span>
          Tách Đơn
        </button>
        <button 
          className="af-btn-primary" 
          style={{ background: '#3b82f6' }}
          onClick={async () => {
            try {
              const clipText = await navigator.clipboard.readText();
              if (clipText) setText(clipText);
            } catch (err) {
              console.warn("Lỗi dán:", err);
            }
          }}
          disabled={isLoading}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ClipboardPaste size={14} /></span> Dán
        </button>
        <button 
          className="af-btn-delete" 
          onClick={() => setText('')}
          disabled={isLoading}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></span>
          Xóa
        </button>
      </div>

      {/* Buttons bottom row for idle state */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
        <button className="af-btn-fill" disabled={isLoading}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ArrowDownToLine size={14} /></span> Nhập đơn
        </button>
        <button className="af-btn-save" disabled={isLoading}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Save size={14} /></span> Lưu đơn
        </button>
      </div>
      <button className="af-btn-print" style={{ marginTop: '0px' }} disabled={isLoading}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}><Printer size={14} /></span> In đơn
      </button>
    </div>
  );
}
