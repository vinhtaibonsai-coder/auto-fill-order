import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Crash Caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error || 'Lỗi không xác định');
      const stack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '30px auto', background: '#fff1f2', color: '#be123c', borderRadius: '12px', border: '1px solid #fecdd3', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.08)', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Ứng dụng gặp sự cố</h2>
          </div>
          <p style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#9f1239', lineHeight: 1.5 }}>
            Một lỗi không mong muốn đã xảy ra khi hiển thị giao diện này. Chúng tôi đã ghi nhận lỗi này. Vui lòng thử tải lại trang hoặc sao chép mã lỗi để báo kỹ thuật.
          </p>

          <div style={{ background: '#ffffff', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#e11d48', fontWeight: 600, wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {errorMsg}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button 
              onClick={() => window.location.reload()} 
              style={{ background: '#be123c', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Tải lại trang
            </button>
            <button 
              onClick={() => {
                const fullText = `[Error]: ${errorMsg}\n\n[Stack]:\n${stack}\n\n[Component Stack]:\n${componentStack}`;
                navigator.clipboard?.writeText(fullText);
                alert('Đã sao chép chi tiết lỗi vào clipboard!');
              }} 
              style={{ background: '#ffffff', color: '#be123c', border: '1px solid #fecdd3', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Sao chép mã lỗi
            </button>
          </div>

          {(stack || componentStack) && (
            <details style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
              <summary style={{ cursor: 'pointer', color: '#9f1239', fontWeight: 600 }}>Xem chi tiết Stack Trace (Dành cho kỹ thuật)</summary>
              <pre style={{ marginTop: 8, padding: 12, background: '#1e293b', color: '#f8fafc', borderRadius: 6, overflowX: 'auto', fontSize: 11.5, maxHeight: 250, lineHeight: 1.4 }}>
                {stack}
                {componentStack && `\n\n--- Component Stack ---\n${componentStack}`}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
