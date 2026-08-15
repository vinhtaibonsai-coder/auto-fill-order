import React, { useState, useEffect } from 'react';

export default function History() {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setLoading(true);
    if (chrome && chrome.storage) {
      chrome.storage.local.get(['splitHistory'], (res) => {
        setHistoryLogs(res.splitHistory || []);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử tách đơn?')) return;
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ 'splitHistory': [] }, () => {
        setHistoryLogs([]);
        alert('Đã xóa lịch sử!');
      });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Lịch sử tách đơn (AI Logs)</h2>
        <button 
          onClick={clearHistory}
          style={{ background: '#fee2e2', color: '#be123c', border: '1px solid #fecdd3', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
        >
          🗑️ Xóa Lịch sử
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
        ) : historyLogs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có lịch sử tách đơn nào.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', width: '150px' }}>Thời gian</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Văn bản gốc (Raw Text)</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Kết quả AI</th>
              </tr>
            </thead>
            <tbody>
              {historyLogs.map((log, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', maxWidth: '300px', whiteSpace: 'pre-wrap' }}>
                    {log.rawText}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
                      <div style={{ fontWeight: 600 }}>{log.result?.name || '---'}</div>
                      <div style={{ color: 'var(--primary)' }}>{log.result?.phone || '---'}</div>
                      <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{log.result?.address || '---'}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
