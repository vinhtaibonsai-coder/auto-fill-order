import React, { useState } from 'react';

export default function Bulk() {
  const [rawText, setRawText] = useState('');
  const [status, setStatus] = useState('IDLE');

  const handleBulkParse = () => {
    if (!rawText.trim()) return alert('Vui lòng nhập văn bản chứa nhiều đơn hàng');
    
    setStatus('PROCESSING');
    
    // Simulate sending to Background Service for Bulk Parsing
    setTimeout(() => {
      setStatus('SUCCESS');
      setRawText('');
      alert('Đã xử lý xong các đơn hàng và đưa vào mục Đơn nháp!');
      setTimeout(() => setStatus('IDLE'), 3000);
    }, 2000);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Tách đơn hàng loạt</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Copy và dán danh sách nhiều đơn hàng cùng lúc (Mỗi đơn cách nhau 1 dòng). AI sẽ tự động phân tách và đẩy tất cả vào mục <strong>Đơn nháp</strong>.
      </p>

      <div className="card">
        <textarea 
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="VD:&#10;Anh Tú 0987654321 123 Lê Lợi Q1&#10;Chị Mai 0912345678 456 Hai Bà Trưng Q3..."
          style={{
            width: '100%',
            height: '300px',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '14px',
            lineHeight: '1.6',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '20px'
          }}
        />

        <button 
          onClick={handleBulkParse}
          disabled={status === 'PROCESSING'}
          style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            border: 'none', 
            padding: '14px 24px', 
            borderRadius: '8px', 
            fontWeight: 700, 
            cursor: status === 'PROCESSING' ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: status === 'PROCESSING' ? 0.7 : 1
          }}
        >
          {status === 'PROCESSING' ? '🔄 Đang bóc tách bằng AI...' : '⚡ Bóc tách tất cả (Bulk)'}
        </button>

        {status === 'SUCCESS' && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#ecfdf5', color: '#059669', borderRadius: '8px', fontWeight: 600 }}>
            ✅ Đã hoàn thành! Bạn có thể sang tab Quản lý đơn hàng để kiểm tra Đơn nháp.
          </div>
        )}
      </div>
    </div>
  );
}
