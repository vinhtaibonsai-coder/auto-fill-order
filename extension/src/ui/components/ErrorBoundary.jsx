import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Crash Caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff1f2', color: '#be123c', borderRadius: '8px', border: '1px solid #fecdd3', margin: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0' }}>⚠️ Ứng dụng gặp sự cố</h2>
          <p style={{ fontSize: '14px', margin: '0 0 15px 0' }}>
            Chúng tôi đã ghi nhận lỗi này. Vui lòng thử tải lại trang hoặc liên hệ hỗ trợ nếu lỗi vẫn tiếp diễn.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ background: '#be123c', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
