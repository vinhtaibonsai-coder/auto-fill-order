import React, { useState } from 'react';

export default function CreateOrderPipeline({ onParse }) {
  const [sourceType, setSourceType] = useState('text'); // text, image, clipboard, chat
  const [inputText, setInputText] = useState('');

  const handleQuickPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(text);
    } catch (e) {
      alert("Không thể đọc Clipboard tự động. Vui lòng dán thủ công.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onParse(inputText);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Source Selector */}
      <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
        <button
          type="button"
          onClick={() => setSourceType('text')}
          style={{
            flex: 1, padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1',
            background: sourceType === 'text' ? '#2563eb' : '#ffffff',
            color: sourceType === 'text' ? '#ffffff' : '#475569',
            cursor: 'pointer'
          }}
        >
          📝 Đoạn văn
        </button>
        <button
          type="button"
          onClick={() => setSourceType('image')}
          style={{
            flex: 1, padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1',
            background: sourceType === 'image' ? '#2563eb' : '#ffffff',
            color: sourceType === 'image' ? '#ffffff' : '#475569',
            cursor: 'pointer'
          }}
        >
          🖼️ Ảnh chụp
        </button>
        <button
          type="button"
          onClick={() => setSourceType('chat')}
          style={{
            flex: 1, padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1',
            background: sourceType === 'chat' ? '#2563eb' : '#ffffff',
            color: sourceType === 'chat' ? '#ffffff' : '#475569',
            cursor: 'pointer'
          }}
        >
          💬 FB / Zalo
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sourceType === 'image' ? (
          <div style={{
            border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '20px',
            textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#f8fafc'
          }}>
            Kéo thả hoặc Dán (Ctrl+V) ảnh đơn hàng vào đây
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={sourceType === 'chat' ? "Dán tin nhắn Zalo/FB chứa địa chỉ khách hàng..." : "Dán thông tin đơn hàng (Tên, SĐT, Địa chỉ)..."}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="button"
              onClick={handleQuickPaste}
              style={{
                position: 'absolute', right: '6px', bottom: '10px',
                padding: '3px 6px', fontSize: '10px', background: '#e2e8f0',
                border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#334155'
              }}
            >
              📋 Dán bộ nhớ tạm
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!inputText.trim() && sourceType !== 'image'}
          style={{
            padding: '10px',
            background: inputText.trim() ? '#16a34a' : '#94a3b8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: inputText.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          🤖 Bóc tách bằng AI (Groq Fast)
        </button>
      </form>
    </div>
  );
}
