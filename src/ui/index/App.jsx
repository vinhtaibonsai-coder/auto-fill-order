import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../domain/auth/auth.session.js';
import { AuthService } from '../../domain/auth/auth.service.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, orders, parse, customers, sync
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [shopName, setShopName] = useState('Cửa hàng của tôi');
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [parseError, setParseError] = useState('');

  // ---------- helpers ----------
  const getSessionInfo = async () => {
    const configRes = await globalThis.SupabaseCloud.loadConfig();
    const sess = await AuthSession.getSession();
    if (!sess || !sess.access_token) throw new Error('NO_SESSION');
    if (sess.access_token.startsWith('local_dev_token_')) throw new Error('OFFLINE');
    return { configRes, sess, shopId: sess.active_shop_id };
  };

  const fmtMoney = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
  const fmtTime = (iso) => {
    if (!iso) return '';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Vừa xong';
      if (mins < 60) return `${mins} phút trước`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} giờ trước`;
      return new Date(iso).toLocaleDateString('vi-VN');
    } catch (_) { return ''; }
  };

  // ---------- load data ----------
  const loadAll = async () => {
    try {
      const { configRes, sess, shopId } = await getSessionInfo();
      const headers = {
        'apikey': configRes.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const shopRes = await fetch(`${configRes.url}/rest/v1/shops?select=name&id=eq.${shopId}`, { headers });
      if (shopRes.ok) {
        const rows = await shopRes.json();
        if (rows && rows.length > 0) setShopName(rows[0].name);
      }

      // KPI thật
      const statsRes = await fetch(`${configRes.url}/rest/v1/rpc/get_shop_dashboard_stats`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_shop_id: shopId })
      });
      if (statsRes.ok) setOrderStats(await statsRes.json());

      // Đơn (orders + submitted_orders), gom customers theo phone
      const today = new Date();
      const todayStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const [ordersRes, subRes, outboxRes] = await Promise.all([
        fetch(`${configRes.url}/rest/v1/orders?shop_id=eq.${shopId}&deleted_at=is.null&order=created_at.desc&limit=50&select=id,name,phone,address,order_code,cod_amount,status,created_at`, { headers }),
        fetch(`${configRes.url}/rest/v1/submitted_orders?shop_id=eq.${shopId}&deleted_at=is.null&order=submitted_at.desc&limit=100&select=id,name,phone,address,order_code,cod_amount,platform,tracking_code,status,submitted_at`, { headers }),
        fetch(`${configRes.url}/rest/v1/sync_outbox?shop_id=eq.${shopId}&status=eq.PENDING&select=operation,table_name,created_at`, { headers })
      ]);

      const draftOrders = ordersRes.ok ? await ordersRes.json() : [];
      const submitted = subRes.ok ? await subRes.json() : [];

      const list = [
        ...(draftOrders || []).map(o => ({
          id: o.id, name: o.name || 'Đơn nháp', phone: o.phone || '', address: o.address || '',
          carrier: '', status: 'draft', value: o.cod_amount || 0, date: o.created_at,
          tag: 'Nháp'
        })),
        ...(submitted || []).map(s => ({
          id: s.order_code || s.tracking_code || s.today_id || s.id || 'sub',
          name: s.name || '—', phone: s.phone || '', address: s.address || '',
          carrier: (s.platform || 'vnpost').toUpperCase(), status: s.status || 'submitted',
          value: s.cod_amount || 0, date: s.submitted_at,
          tag: 'Đã gửi'
        }))
      ];
      setOrders(list);

      // Customers: gom theo phone (ưu tiên đơn mới nhất)
      const map = new Map();
      (submitted || []).forEach(s => {
        if (!s.phone) return;
        const key = s.phone.trim();
        const cur = map.get(key);
        if (!cur || new Date(s.submitted_at) > new Date(cur.last)) {
          map.set(key, { phone: key, name: s.name || 'Khách hàng', address: s.address || '', last: s.submitted_at, count: (cur ? cur.count : 0) + 1 });
        } else {
          cur.count += 1;
        }
      });
      setCustomers(Array.from(map.values()).sort((a, b) => b.count - a.count));

      const out = outboxRes.ok ? await outboxRes.json() : [];
      setOutbox(out || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    }
    setIsLoading(false);
  };

  // ---------- auth ----------
  useEffect(() => {
    const init = async () => {
      try {
        const isAuth = await AuthService.isAuthenticated();
        setIsAuth(isAuth);
        if (isAuth) {
          try {
            await getSessionInfo();
            loadAll();
          } catch (e) {
            if (e.message === 'OFFLINE' || e.message === 'NO_SESSION') setIsAuth(false);
          }
        }
        setIsLoading(false);
      } catch (_) {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // ---------- remote parse (real) ----------
  const handleRemoteParse = async (e) => {
    e.preventDefault();
    if (!parseText.trim()) return;
    setIsParsing(true);
    setParseError('');
    setParsedResult(null);
    try {
      const { configRes, sess, shopId } = await getSessionInfo();
      const deviceId = await globalThis.SupabaseCloud._getDeviceId().catch(() => '');

      const resp = await fetch(`${configRes.url}/functions/v1/ai-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sess.access_token}`
        },
        body: JSON.stringify({ task: 'parse', text: parseText, deviceId, shop_id: shopId })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const code = errData.error || '';
        const msgs = {
          'AI_AUTH_REQUIRED': 'Phiên đăng nhập hết hạn. Vui lòng đăng xuất và đăng nhập lại.',
          'AI_SHOP_REQUIRED': 'Tài khoản chưa được gán vào shop.',
          'AI_QUOTA_EXCEEDED': 'Shop đã hết hạn mức AI tháng này.',
          'AI_RATE_LIMITED': 'Quá nhiều yêu cầu AI. Vui lòng thử lại sau.'
        };
        throw new Error(msgs[code] || errData.message || `Gateway lỗi HTTP ${resp.status}`);
      }

      const responseData = await resp.json();
      const data = responseData.data || responseData.result || {};

      setParsedResult({
        name: data.name || '',
        phone: data.phone || '',
        address: data.address || data.correctAddress || '',
        orderCode: data.orderCode || data.order_code || '',
        codAmount: data.codAmount || data.cod_amount || ''
      });

      // Lưu đơn nháp lên Cloud nếu được phép (owner); lỗi RLS không chặn luồng chính
      try {
        await fetch(`${configRes.url}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shop_id: shopId,
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || data.correctAddress || '',
            order_code: data.orderCode || '',
            cod_amount: Number(data.codAmount) || 0,
            status: 'draft'
          })
        });
      } catch (saveErr) {
        console.warn('Không lưu được đơn nháp:', saveErr);
      }
    } catch (err) {
      setParseError(err.message || 'Lỗi không xác định');
    }
    setIsParsing(false);
  };

  // ---------- render ----------
  if (isLoading) {
    return <div className="mobile-layout"><div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang tải...</div></div>;
  }

  if (!isAuth) {
    return (
      <div className="mobile-layout">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2>🔐 Cần đăng nhập</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Vui lòng mở trình quản lý (Options) và đăng nhập bằng tài khoản Shop để sử dụng Workspace di động.
          </p>
          <button
            onClick={() => window.open('/frontend/options/options.html', '_blank')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            ⚙️ Mở Options để đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const stats = orderStats || {};

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
            <div style={{ fontSize: '11px', color: '#64748b' }}>{shopName}</div>
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
              <div style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 8px 0' }}>
                {stats.orders_today ?? '…'} Đơn
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px' }}>
                <span>Doanh số tạm tính: <strong>{fmtMoney(stats.cod_today)}</strong></span>
                <span>Đã gửi: <strong>{stats.submitted_today ?? '…'}</strong></span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: '#64748b' }}>Đơn nháp</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{stats.drafts ?? '…'}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: '#64748b' }}>Lỗi hôm nay</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: stats.failed_today > 0 ? '#dc2626' : '#0f172a' }}>{stats.failed_today ?? '…'}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: '#64748b' }}>Đồng bộ chờ</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{stats.sync_pending ?? '…'}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: '#64748b' }}>Tổng đơn</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{stats.orders_total ?? '…'}</div>
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
            {orders.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Chưa có đơn nào của Shop.
              </div>
            ) : orders.map(order => (
              <div key={order.id + order.date} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{order.name}</span>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    {order.carrier && <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{order.carrier}</span>}
                    <span style={{ background: order.tag === 'Draft' || order.status === 'draft' ? '#f1f5f9' : '#dcfce7', color: order.status === 'draft' ? '#475569' : '#15803d', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{order.status === 'draft' ? 'Nháp' : 'Đã gửi'}</span>
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  📞 {order.phone || '—'} • {order.value ? fmtMoney(order.value) : '—'}
                </div>
                {order.address && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>📍 {order.address}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                  <span>{fmtTime(order.date)}</span>
                  {order.tracking_code && <span>📦 {order.tracking_code}</span>}
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

            {parseError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#b91c1c' }}>
                ❌ {parseError}
              </div>
            )}

            {parsedResult && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#166534' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>✅ Bóc tách thành công từ Cloud AI!</div>
                {parsedResult.name && <div>👤 {parsedResult.name}</div>}
                {parsedResult.phone && <div>📞 {parsedResult.phone}</div>}
                {parsedResult.address && <div>📍 {parsedResult.address}</div>}
                {parsedResult.orderCode && <div>🧾 {parsedResult.orderCode}</div>}
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#047857' }}>
                  Đơn đã sẵn sàng — nhân viên mở Panel tại máy tính để điền tự động.
                </div>
              </div>
            )}
          </div>
        )}

        {/* CUSTOMERS CRM TAB */}
        {activeTab === 'customers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0' }}>👤 CRM Khách hàng Mobile</h3>
            {customers.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Chưa có khách hàng nào (gom từ đơn đã gửi).
              </div>
            ) : customers.map((c, i) => (
              <div key={c.phone + i} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>📞 {c.phone} • {c.count} Đơn</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>📍 {c.address || '—'}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Đơn gần nhất: {fmtTime(c.last)}</div>
              </div>
            ))}
          </div>
        )}

        {/* SYNC TAB */}
        {activeTab === 'sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ margin: '0' }}>🔄 Trạng thái Cloud Sync</h3>
            <div style={{ background: outbox.length === 0 ? '#ecfdf5' : '#fef3c7', border: `1px solid ${outbox.length === 0 ? '#a7f3d0' : '#fde68a'}`, padding: '12px', borderRadius: '8px', color: outbox.length === 0 ? '#065f46' : '#92400e', fontSize: '13px' }}>
              {outbox.length === 0
                ? <>🟢 <strong>Cloud Live Online:</strong> Tất cả dữ liệu đã đồng bộ. Không có hàng chờ.</>
                : <>🟡 <strong>{outbox.length} tác vụ chờ đồng bộ:</strong> hệ thống sẽ tự đẩy lên Cloud khi mạng ổn định.</>}
            </div>
            {outbox.length > 0 && outbox.map((o, i) => (
              <div key={i} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                {o.operation} {o.table_name} • {fmtTime(o.created_at)}
              </div>
            ))}
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