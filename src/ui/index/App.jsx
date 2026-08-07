import React, { useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, orders, parse, customers, sync
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);

  const mockOrders = [
    { id: 'ORD-8801', name: 'Nguyễn Văn An', phone: '0901234567', carrier: 'VNPost', status: 'autofilled', value: '450.000 đ', date: 'Vừa xong' },
    { id: 'ORD-8802', name: 'Trần Thị Bình', phone: '0987654321', carrier: 'J&T', status: 'ready', value: '1.200.000 đ', date: '10 phút trước' },
    { id: 'ORD-8803', name: 'Lê Hoàng Cường', phone: '0912345678', carrier: 'VNPost', status: 'draft', value: '350.000 đ', date: '25 phút trước' },
  ];

  const handleRemoteParse = (e) => {
    e.preventDefault();
    if (!parseText.trim()) return;
    setIsParsing(true);
    setTimeout(() => {
      setParsedResult({
        name: 'Trần Thị Bình (ĐTDĐ Demo)',
        phone: '0987654321',
        address: '45 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        status: 'Saved to Cloud'
      });
      setIsParsing(false);
    }, 1200);
  };

  return (
    <div className="mobile-layout">
      {/* Mobile Topbar Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#2563eb', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '12px' }}>
            AF
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>Auto Fill Order</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Shop Quần Áo Flash (Mobile App)</div>
          </div>
        </div>
        <button
          onClick={() => window.open('/frontend/options/options.html', '_blank')}
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', color: '#475569' }}
        >
          ⚙️ Desktop Options
        </button>
      </header>

      {/* Mobile Main Content */}
      <main className="mobile-content">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>TỔNG ĐƠN HÀNG HÔM NAY</div>
              <div style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 8px 0' }}>24 Đơn</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px' }}>
                <span>Doanh số tạm tính: <strong>8.450.000 đ</strong></span>
                <span>Thành công: <strong>22 (91.6%)</strong></span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: '#64748b' }}>VNPost</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>14 đơn</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: '#64748b' }}>J&T Express</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>10 đơn</div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('parse')}
              style={{
                padding: '14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.25)'
              }}
            >
              📱 TÁCH ĐƠN TỪ XA TRÊN ĐTĐĐ
            </button>
          </div>
        )}

        {/* ORDERS LIST TAB */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0 0 4px 0' }}>📦 Quản lý Đơn hàng từ xa</h3>
            <input
              type="text"
              placeholder="🔍 Tìm theo Tên, SĐT, Mã đơn..."
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
            {mockOrders.map(order => (
              <div key={order.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{order.name}</span>
                  <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{order.carrier}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>📞 {order.phone} • {order.value}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  <span>Trạng thái: <strong style={{ color: '#16a34a' }}>{order.status}</strong></span>
                  <span>{order.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REMOTE PARSER TAB */}
        {activeTab === 'parse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0' }}>⚡ Tách đơn từ xa trên ĐTDĐ</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Dán tin nhắn Zalo / FB của khách hàng để AI bóc tách và đồng bộ về Cloud. Nhân viên tại máy tính chỉ cần 1 click để điền đơn tự động!
            </p>

            <form onSubmit={handleRemoteParse} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                rows={5}
                value={parseText}
                onChange={(e) => setParseText(e.target.value)}
                placeholder="Dán tin nhắn Zalo/FB hoặc đoạn văn chứa địa chỉ vào đây..."
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'none' }}
              />
              <button
                type="submit"
                disabled={isParsing || !parseText.trim()}
                style={{
                  padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer'
                }}
              >
                {isParsing ? '🔄 Đang bóc tách AI...' : '🤖 Bóc tách & Lưu Cloud'}
              </button>
            </form>

            {parsedResult && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#166534' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>✅ Đã lưu vào Cloud thành công!</div>
                <div>👤 {parsedResult.name}</div>
                <div>📞 {parsedResult.phone}</div>
                <div>📍 {parsedResult.address}</div>
              </div>
            )}
          </div>
        )}

        {/* CUSTOMERS CRM TAB */}
        {activeTab === 'customers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0' }}>👤 CRM Khách hàng Mobile</h3>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Nguyễn Văn An</div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>📞 0901234567 • 8 Đơn đã mua</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>📍 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM</div>
            </div>
          </div>
        )}

        {/* SYNC TAB */}
        {activeTab === 'sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0' }}>🔄 Trạng thái Cloud Sync</h3>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '8px', color: '#065f46', fontSize: '13px' }}>
              🟢 <strong>Cloud Live Online:</strong> Dữ liệu đơn hàng đồng bộ thời gian thực giữa ĐTDĐ và các máy tính trong Shop.
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <span>Dashboard</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          <span style={{ fontSize: '18px' }}>📦</span>
          <span>Đơn hàng</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'parse' ? 'active' : ''}`} onClick={() => setActiveTab('parse')}>
          <span style={{ fontSize: '18px' }}>⚡</span>
          <span>Tách đơn</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <span>Khách hàng</span>
        </button>
        <button className={`mobile-nav-btn ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>
          <span style={{ fontSize: '18px' }}>🔄</span>
          <span>Cloud Sync</span>
        </button>
      </nav>
    </div>
  );
}
