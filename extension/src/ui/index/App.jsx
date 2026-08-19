import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../domain/auth/auth.session.esm.js';
import { AuthService } from '../../domain/auth/auth.service.esm.js';

const DEFAULT_SUPABASE = {
  url: 'https://xlgovgynbsahuykyjzcx.supabase.co',
  anonKey: 'sb_publishable_i7Ox-gsXTnPbP_AghSxb4Q_w6-5vbMg'
};

export default function App() {
  // Tabs: dashboard | orders | parse | shops | staff | account
  const [activeTab, setActiveTab] = useState('dashboard');
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [orderStats, setOrderStats] = useState({
    orders_today: 0,
    cod_today: 0,
    submitted_today: 0,
    drafts: 0,
    orders_total: 0
  });
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  
  // Current user & Shop management state
  const [currentUser, setCurrentUser] = useState({
    id: 'AF-OWNER-01',
    full_name: 'Chủ Shop (Admin)',
    email: 'admin@shop.vn',
    phone: '0912345678',
    role: 'SHOP_OWNER'
  });
  
  const [shops, setShops] = useState([
    {
      id: 'shop_01',
      name: 'Kho Bonsai SG (Tổng Kho Chi Nhánh 1)',
      code: 'SHOP-SG-01',
      phone: '0901234567',
      address: '123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh',
      carrier: 'VNPost & J&T',
      staffCount: 4,
      ordersCount: 128,
      isActive: true
    },
    {
      id: 'shop_02',
      name: 'Chi Nhánh Hà Nội (Kho Miền Bắc)',
      code: 'SHOP-HN-02',
      phone: '0988776655',
      address: '456 Giải Phóng, Quận Hoàng Mai, Hà Nội',
      carrier: 'VNPost',
      staffCount: 2,
      ordersCount: 45,
      isActive: false
    }
  ]);
  const [activeShopId, setActiveShopId] = useState('shop_01');

  // Staff management state
  const [staffList, setStaffList] = useState([
    {
      id: 'staff_01',
      name: 'Nguyễn Văn Minh',
      username: 'minh_order',
      email: 'minh.nv@shop.vn',
      phone: '0911223344',
      role: 'SHOP_STAFF',
      roleLabel: 'Nhân viên lên đơn',
      shopId: 'shop_01',
      shopName: 'Kho Bonsai SG',
      status: 'active',
      ordersToday: 24,
      totalOrders: 156,
      permissions: { canViewCod: false, canDeleteOrder: false, canConfigAi: false }
    },
    {
      id: 'staff_02',
      name: 'Trần Thị Mai',
      username: 'mai_cskh',
      email: 'mai.tt@shop.vn',
      phone: '0933445566',
      role: 'SHOP_STAFF',
      roleLabel: 'Nhân viên CSKH',
      shopId: 'shop_01',
      shopName: 'Kho Bonsai SG',
      status: 'active',
      ordersToday: 18,
      totalOrders: 89,
      permissions: { canViewCod: false, canDeleteOrder: false, canConfigAi: false }
    },
    {
      id: 'staff_03',
      name: 'Lê Hoàng Long',
      username: 'long_manager',
      email: 'long.lh@shop.vn',
      phone: '0977889900',
      role: 'SHOP_MANAGER',
      roleLabel: 'Quản lý Chi nhánh',
      shopId: 'shop_02',
      shopName: 'Chi Nhánh Hà Nội',
      status: 'active',
      ordersToday: 12,
      totalOrders: 210,
      permissions: { canViewCod: true, canDeleteOrder: true, canConfigAi: false }
    }
  ]);

  // Modals & form state
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [newShopForm, setNewShopForm] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    carrier: 'VNPost & J&T'
  });

  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    shopId: 'shop_01',
    role: 'SHOP_STAFF',
    canViewCod: false,
    canDeleteOrder: false
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    oldPass: '',
    newPass: '',
    confirmPass: ''
  });
  const [pwStrength, setPwStrength] = useState(0);
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' });

  const [isLoading, setIsLoading] = useState(true);
  const [parseError, setParseError] = useState('');

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 3000);
  };

  // ---------- Helpers ----------
  const getSupabaseConfig = async () => {
    try {
      if (globalThis.SupabaseCloud && typeof globalThis.SupabaseCloud.loadConfig === 'function') {
        const c = await globalThis.SupabaseCloud.loadConfig();
        if (c && c.url && c.anonKey) return c;
      }
    } catch (_) {}
    return DEFAULT_SUPABASE;
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

  // ---------- Load Data ----------
  const loadAll = async () => {
    try {
      const config = await getSupabaseConfig();
      let sess = null;
      try { sess = await AuthSession.getSession(); } catch (_) {}

      const token = (sess && sess.access_token && !sess.access_token.startsWith('local_dev_token_'))
        ? sess.access_token
        : config.anonKey;

      const headers = { 'apikey': config.anonKey, 'Authorization': `Bearer ${token}` };

      // Load Profile
      if (sess && sess.user) {
        setCurrentUser(prev => ({
          ...prev,
          id: sess.user.id || prev.id,
          full_name: sess.user.full_name || sess.user.user_metadata?.full_name || prev.full_name,
          email: sess.user.email || prev.email,
          phone: sess.user.phone || prev.phone,
          role: sess.user.role || 'SHOP_OWNER'
        }));
      }

      // Load Shops from DB if available
      try {
        const shopRes = await fetch(`${config.url}/rest/v1/shops?select=*&order=created_at.desc`, { headers });
        if (shopRes.ok) {
          const dbShops = await shopRes.json();
          if (Array.isArray(dbShops) && dbShops.length > 0) {
            setShops(dbShops.map((s, idx) => ({
              id: s.id,
              name: s.name || `Shop #${idx + 1}`,
              code: s.code || s.id?.substring(0, 8)?.toUpperCase() || `SHOP-0${idx + 1}`,
              phone: s.phone || '0901234567',
              address: s.address || 'Hồ Chí Minh',
              carrier: s.default_carrier || 'VNPost & J&T',
              staffCount: 3,
              ordersCount: 80,
              isActive: idx === 0
            })));
            setActiveShopId(dbShops[0].id);
          }
        }
      } catch (_) {}

      // Load Orders
      const [ordersRes, subRes] = await Promise.all([
        fetch(`${config.url}/rest/v1/orders?select=*&order=created_at.desc&limit=50`, { headers }).catch(() => ({ ok: false })),
        fetch(`${config.url}/rest/v1/submitted_orders?select=*&order=submitted_at.desc&limit=100`, { headers }).catch(() => ({ ok: false }))
      ]);

      const draftOrders = ordersRes.ok ? await ordersRes.json() : [];
      const submitted = subRes.ok ? await subRes.json() : [];

      const todayStr = new Date().toISOString().substring(0, 10);
      let codToday = 0;
      let submittedTodayCount = 0;

      const list = [
        ...(draftOrders || []).map(o => ({
          id: o.id,
          name: o.name || 'Đơn nháp',
          phone: o.phone || '',
          address: o.address || '',
          orderCode: o.order_code || '',
          trackingCode: '',
          carrier: '',
          status: 'draft',
          value: Number(o.cod_amount) || 0,
          date: o.created_at,
          tag: 'Nháp'
        })),
        ...(submitted || []).map(s => {
          const val = Number(s.cod_amount) || 0;
          const sDate = (s.submitted_at || s.submitted_date || '').substring(0, 10);
          if (sDate === todayStr) {
            codToday += val;
            submittedTodayCount++;
          }
          return {
            id: s.id,
            name: s.name || '—',
            phone: s.phone || '',
            address: s.address || '',
            orderCode: s.order_code || '',
            trackingCode: s.tracking_code || '',
            carrier: (s.platform || 'VNPost').toUpperCase(),
            carrierAccount: s.carrier_account || s.carrierAccount || '',
            userEmail: s.userEmail || '',
            status: s.status || 'submitted',
            value: val,
            date: s.submitted_at || s.created_at,
            tag: 'Đã gửi'
          };
        })
      ];

      setOrders(list);

      setOrderStats({
        orders_today: submittedTodayCount,
        cod_today: codToday,
        submitted_today: submittedTodayCount,
        drafts: (draftOrders || []).length,
        orders_total: list.length
      });

      // Group Customers
      const custMap = new Map();
      list.forEach(item => {
        if (!item.phone || item.phone.length < 9) return;
        const key = item.phone.replace(/\D/g, '');
        const cur = custMap.get(key);
        if (!cur || new Date(item.date) > new Date(cur.last)) {
          custMap.set(key, {
            phone: key,
            name: item.name !== '—' && item.name ? item.name : (cur?.name || 'Khách hàng'),
            address: item.address || cur?.address || '',
            last: item.date,
            count: (cur ? cur.count : 0) + 1,
            totalVal: (cur ? cur.totalVal : 0) + (item.value || 0)
          });
        } else {
          cur.count += 1;
          cur.totalVal += (item.value || 0);
        }
      });
      setCustomers(Array.from(custMap.values()).sort((a, b) => b.count - a.count));

    } catch (err) {
      console.warn('Lỗi tải dữ liệu Workspace:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ---------- Local Fallback Parser ----------
  const localParseText = (text) => {
    let name = '', phone = '', address = '', orderCode = '', codAmount = 0;
    const phoneMatch = text.match(/(?:\+84|84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/);
    if (phoneMatch) phone = phoneMatch[0].replace(/\D/g, '');

    const codMatch = text.match(/(?:cod|thu hộ|tiền thu|cọc|thu|thanh toán)[\s:]*([0-9\.,]{3,10})(?:\s*k|\s*đ|\s*vnd)?/i) ||
                     text.match(/([0-9]{2,4})k\b/i);
    if (codMatch) {
      let raw = codMatch[1].replace(/[\.,]/g, '');
      if (codMatch[0].toLowerCase().endsWith('k')) raw += '000';
      codAmount = parseInt(raw, 10) || 0;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0].replace(phoneMatch ? phoneMatch[0] : '', '').trim();
      if (firstLine.length > 1 && firstLine.length < 40) name = firstLine;
    }

    let cleanAddr = text;
    if (phone) cleanAddr = cleanAddr.replace(phone, '');
    if (name) cleanAddr = cleanAddr.replace(name, '');
    cleanAddr = cleanAddr.replace(/(?:cod|thu hộ|mã đơn|sđt|tên)[\s:]*[^\n]+/gi, '').trim();
    address = cleanAddr.replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ');

    return { name, phone, address, orderCode, codAmount };
  };

  const handleRemoteParse = async (e) => {
    e.preventDefault();
    if (!parseText.trim()) return;
    setIsParsing(true);
    setParseError('');
    setParsedResult(null);

    try {
      const parsed = localParseText(parseText);
      setParsedResult(parsed);
      showToast('✅ Đã bóc tách thông tin đơn hàng!');
    } catch (err) {
      setParseError(err.message || 'Lỗi bóc tách đơn hàng');
    } finally {
      setIsParsing(false);
    }
  };

  // ---------- Shop Operations ----------
  const handleSwitchShop = (shopId) => {
    setActiveShopId(shopId);
    setShops(prev => prev.map(s => ({ ...s, isActive: s.id === shopId })));
    localStorage.setItem('current_shop_id', shopId);
    const active = shops.find(s => s.id === shopId);
    if (active) localStorage.setItem('current_shop_name', active.name);
    showToast(`🏪 Đã chuyển sang: ${active?.name || shopId}`);
  };

  const handleCreateShop = (e) => {
    e.preventDefault();
    if (!newShopForm.name.trim()) return;
    const newId = 'shop_' + Date.now();
    const newShop = {
      id: newId,
      name: newShopForm.name.trim(),
      code: newShopForm.code.trim().toUpperCase() || 'SHOP-' + Math.floor(100 + Math.random() * 900),
      phone: newShopForm.phone.trim() || '0901234567',
      address: newShopForm.address.trim() || 'Việt Nam',
      carrier: newShopForm.carrier,
      staffCount: 1,
      ordersCount: 0,
      isActive: false
    };
    setShops(prev => [...prev, newShop]);
    setShowAddShopModal(false);
    setNewShopForm({ name: '', code: '', phone: '', address: '', carrier: 'VNPost & J&T' });
    showToast('🎉 Thêm cửa hàng mới thành công!');
  };

  // ---------- Staff Operations ----------
  const handleCreateStaff = (e) => {
    e.preventDefault();
    if (!newStaffForm.name.trim() || !newStaffForm.username.trim()) {
      showToast('Vui lòng nhập họ tên và tên đăng nhập!', 'error');
      return;
    }
    const targetShop = shops.find(s => s.id === newStaffForm.shopId);
    const newStaff = {
      id: 'staff_' + Date.now(),
      name: newStaffForm.name.trim(),
      username: newStaffForm.username.trim().toLowerCase(),
      email: newStaffForm.email.trim() || `${newStaffForm.username.trim()}@shop.vn`,
      phone: newStaffForm.phone.trim() || '—',
      role: newStaffForm.role,
      roleLabel: newStaffForm.role === 'SHOP_MANAGER' ? 'Quản lý Chi nhánh' : 'Nhân viên lên đơn',
      shopId: newStaffForm.shopId,
      shopName: targetShop?.name || 'Kho Tổng',
      status: 'active',
      ordersToday: 0,
      totalOrders: 0,
      permissions: {
        canViewCod: newStaffForm.canViewCod,
        canDeleteOrder: newStaffForm.canDeleteOrder,
        canConfigAi: false
      }
    };
    setStaffList(prev => [newStaff, ...prev]);
    setShowAddStaffModal(false);
    setNewStaffForm({
      name: '', username: '', email: '', phone: '', password: '',
      shopId: 'shop_01', role: 'SHOP_STAFF', canViewCod: false, canDeleteOrder: false
    });
    showToast(`✅ Đã thêm nhân viên: ${newStaff.name}`);
  };

  const handleToggleStaffStatus = (staffId) => {
    setStaffList(prev => prev.map(s => {
      if (s.id === staffId) {
        const nextStatus = s.status === 'active' ? 'locked' : 'active';
        showToast(nextStatus === 'active' ? `🟢 Đã mở khóa: ${s.name}` : `🔒 Đã tạm khóa: ${s.name}`);
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const handleDeleteStaff = (staffId, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhân viên "${name}" khỏi hệ thống?`)) {
      setStaffList(prev => prev.filter(s => s.id !== staffId));
      showToast(`🗑️ Đã xóa nhân viên: ${name}`);
    }
  };

  // ---------- Password Strength Calculator ----------
  const handlePwChange = (val) => {
    setPasswordForm(prev => ({ ...prev, newPass: val }));
    let score = 0;
    if (val.length >= 8) score += 30;
    if (/[A-Z]/.test(val)) score += 25;
    if (/[0-9]/.test(val)) score += 25;
    if (/[^A-Za-z0-9]/.test(val)) score += 20;
    setPwStrength(score);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (!passwordForm.newPass || passwordForm.newPass.length < 6) {
      showToast('Mật khẩu mới phải từ 6 ký tự!', 'error');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirmPass) {
      showToast('Mật khẩu xác nhận không khớp!', 'error');
      return;
    }
    showToast('🔒 Đổi mật khẩu Chủ Shop thành công!');
    setPasswordForm({ oldPass: '', newPass: '', confirmPass: '' });
    setPwStrength(0);
  };

  // Active Shop Name
  const currentShopObj = shops.find(s => s.id === activeShopId) || shops[0];

  const filteredOrders = orders.filter(o => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (o.name || '').toLowerCase().includes(q) ||
           (o.phone || '').includes(q) ||
           (o.orderCode || '').toLowerCase().includes(q) ||
           (o.trackingCode || '').toLowerCase().includes(q) ||
           (o.carrierAccount || '').toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Đang tải Master Workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Toast Notification */}
      {toastMsg.text && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toastMsg.type === 'error' ? '#ef4444' : '#10b981', color: '#fff',
          padding: '10px 18px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* Topbar Header */}
      <header style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #4f46e5, #818cf8)', color: '#fff', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', boxShadow: '0 4px 10px rgba(79,70,229,0.3)' }}>
            AF
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Auto Fill Master</span>
              <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#3730a3', padding: '2px 7px', borderRadius: '6px', fontWeight: 800 }}>CHỦ SHOP</span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🏪 {currentShopObj?.name}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => loadAll()}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
            title="Làm mới dữ liệu"
          >
            🔄 Đồng bộ
          </button>
          <button
            onClick={() => window.open('/frontend/options/options.html', '_blank')}
            style={{ background: '#4f46e5', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ⚙️ Tiện ích Ext
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        
        {/* ========================================================================= */}
        {/* TAB 1: DASHBOARD                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Hero Banner */}
            <div style={{ background: 'linear-gradient(135deg, #4f46e5, #312e81)', color: '#fff', padding: '22px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(79, 70, 229, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '12px', opacity: 0.85, fontWeight: 700, letterSpacing: '0.5px' }}>TỔNG ĐƠN GỬI HÔM NAY • {currentShopObj?.name}</div>
                  <div style={{ fontSize: '34px', fontWeight: 800, margin: '8px 0 12px 0' }}>
                    {orderStats.orders_today} <span style={{ fontSize: '16px', fontWeight: 500 }}>đơn</span>
                  </div>
                </div>
                <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>
                  🟢 Trực tiếp
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '12px' }}>
                <span>Tiền thu COD: <strong>{fmtMoney(orderStats.cod_today)}</strong></span>
                <span>Đơn nháp chờ gửi: <strong>{orderStats.drafts} đơn</strong></span>
              </div>
            </div>

            {/* Quick KPI Stats 4 Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>🏪 CỬA HÀNG</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{shops.length}</div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Tất cả đang hoạt động</div>
              </div>
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>👥 NHÂN VIÊN</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{staffList.length}</div>
                <div style={{ fontSize: '11px', color: '#4f46e5', marginTop: '4px' }}>Đang quản lý ca trực</div>
              </div>
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>📦 TỔNG ĐƠN ĐÃ LÊN</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{orderStats.orders_total}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Đơn hàng toàn hệ thống</div>
              </div>
              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>👥 KHÁCH HÀNG</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{customers.length}</div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Đã lưu trong sổ bạ</div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setActiveTab('parse')}
                style={{
                  padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px',
                  fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                }}
              >
                <span>⚡</span> TÁCH ĐƠN TIN NHẮN
              </button>
              <button
                onClick={() => setActiveTab('shops')}
                style={{
                  padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px',
                  fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(79,70,229,0.3)'
                }}
              >
                <span>🏪</span> QUẢN LÝ SHOP & CHI NHÁNH
              </button>
            </div>

            {/* Recent Orders Preview */}
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>📦 Đơn hàng gần đây</h4>
                <button onClick={() => setActiveTab('orders')} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Xem toàn bộ đơn →</button>
              </div>
              {orders.slice(0, 5).map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>{o.name}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      📞 {o.phone || '—'} {o.trackingCode ? `• 📦 ${o.trackingCode}` : ''} {o.carrierAccount ? `• 🏢 ${o.carrierAccount}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#10b981' }}>{fmtMoney(o.value)}</div>
                    <span style={{ fontSize: '10px', background: o.tag === 'Nháp' ? '#f1f5f9' : '#dcfce7', color: o.tag === 'Nháp' ? '#475569' : '#15803d', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>{o.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: QUẢN LÝ CỬA HÀNG (SHOP MANAGEMENT)                                 */}
        {/* ========================================================================= */}
        {activeTab === 'shops' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>🏪 Quản lý Cửa Hàng & Chi Nhánh</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Thiết lập kho hàng, địa chỉ gửi bưu điện và phân quyền cửa hàng đa điểm.</p>
              </div>
              <button
                onClick={() => setShowAddShopModal(true)}
                style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ➕ Thêm Cửa Hàng
              </button>
            </div>

            {/* Shop Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
              {shops.map(s => {
                const isSelected = s.id === activeShopId;
                return (
                  <div key={s.id} style={{ background: '#ffffff', border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', boxShadow: isSelected ? '0 4px 15px rgba(79, 70, 229, 0.12)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{s.name}</span>
                          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#4f46e5' }}>{s.code}</code>
                          {isSelected && (
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                              ĐANG CHỌN
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '6px' }}>📍 Địa chỉ gửi: {s.address}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>📞 Hotline: {s.phone} • 🚚 Cổng ĐVVC: <strong>{s.carrier}</strong></div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!isSelected ? (
                          <button
                            onClick={() => handleSwitchShop(s.id)}
                            style={{ background: '#e0e7ff', color: '#3730a3', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Chọn Shop này
                          </button>
                        ) : (
                          <button
                            disabled
                            style={{ background: '#f1f5f9', color: '#10b981', border: '1px solid #bbf7d0', padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700 }}
                          >
                            ✅ Đang hoạt động
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <span>👥 Nhân viên: <strong style={{ color: '#0f172a' }}>{s.staffCount} người</strong></span>
                      <span>📦 Đơn đã tạo: <strong style={{ color: '#0f172a' }}>{s.ordersCount} đơn</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: QUẢN LÝ NHÂN VIÊN (STAFF & PERMISSIONS)                            */}
        {/* ========================================================================= */}
        {activeTab === 'staff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>👥 Quản lý Nhân Viên & Phân Quyền</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Phân quyền tài khoản nhân viên, kiểm soát xem tiền COD và bảo mật dữ liệu khách hàng.</p>
              </div>
              <button
                onClick={() => setShowAddStaffModal(true)}
                style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ➕ Thêm Nhân Viên
              </button>
            </div>

            {/* Staff List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {staffList.map(st => {
                const isActive = st.status === 'active';
                return (
                  <div key={st.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', opacity: isActive ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: st.role === 'SHOP_MANAGER' ? '#7c3aed' : '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
                          {st.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>{st.name}</span>
                            <span style={{ fontSize: '10.5px', background: st.role === 'SHOP_MANAGER' ? '#ede9fe' : '#e0e7ff', color: st.role === 'SHOP_MANAGER' ? '#6d28d9' : '#3730a3', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
                              {st.roleLabel}
                            </span>
                            <span style={{ fontSize: '10px', background: isActive ? '#dcfce7' : '#fee2e2', color: isActive ? '#15803d' : '#b91c1c', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              {isActive ? '● Đang hoạt động' : '🔒 Đã khóa'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            @{st.username} • 📧 {st.email} • 📞 {st.phone}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                            🏪 Thuộc: <strong>{st.shopName}</strong> • Đơn hôm nay: <strong style={{ color: '#10b981' }}>{st.ordersToday} đơn</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleToggleStaffStatus(st.id)}
                          style={{ background: isActive ? '#fffbeb' : '#ecfdf5', color: isActive ? '#d97706' : '#059669', border: '1px solid #fed7aa', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {isActive ? 'Khóa TK' : 'Mở khóa'}
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(st.id, st.name)}
                          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>

                    {/* Permissions Badges */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px' }}>
                      <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px' }}>
                        ⚡ Tách & Lên đơn: <strong>Cho phép</strong>
                      </span>
                      <span style={{ background: st.permissions.canViewCod ? '#dcfce7' : '#fee2e2', color: st.permissions.canViewCod ? '#15803d' : '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        💰 Xem COD: {st.permissions.canViewCod ? 'Có quyền' : 'Khóa'}
                      </span>
                      <span style={{ background: st.permissions.canDeleteOrder ? '#dcfce7' : '#fee2e2', color: st.permissions.canDeleteOrder ? '#15803d' : '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        🗑️ Xóa đơn: {st.permissions.canDeleteOrder ? 'Có quyền' : 'Khóa'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: QUẢN LÝ ĐƠN HÀNG (ORDERS)                                          */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>📦 Quản lý Đơn hàng ({filteredOrders.length})</h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm theo Tên, SĐT, Mã đơn, Tài khoản bưu điện..."
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', outline: 'none' }}
            />
            {filteredOrders.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                Không tìm thấy đơn hàng phù hợp.
              </div>
            ) : filteredOrders.map(o => (
              <div key={o.id} style={{ padding: '14px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{o.name}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {o.carrierAccount && (
                      <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '5px', fontWeight: 700 }}>
                        🏢 {o.carrierAccount}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', background: o.tag === 'Nháp' ? '#f1f5f9' : '#dcfce7', color: o.tag === 'Nháp' ? '#475569' : '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>{o.tag}</span>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  📞 {o.phone || '—'} {o.value > 0 ? `• 💰 ${fmtMoney(o.value)}` : ''}
                </div>
                {o.address && <div style={{ fontSize: '12px', color: '#64748b' }}>📍 {o.address}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <span>{fmtTime(o.date)}</span>
                  {o.trackingCode && <span style={{ fontWeight: 700, color: '#4f46e5', fontFamily: 'monospace' }}>📦 {o.trackingCode}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: BÓC TÁCH ĐƠN HÀNG (PARSE)                                         */}
        {/* ========================================================================= */}
        {activeTab === 'parse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800 }}>⚡ Bóc tách Đơn hàng Thông minh</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Dán tin nhắn khách hàng (Zalo, Messenger, TikTok) để trích xuất tự động vào Shop đang chọn.
              </p>
            </div>

            <form onSubmit={handleRemoteParse} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                rows={6}
                value={parseText}
                onChange={(e) => setParseText(e.target.value)}
                placeholder="Dán tin nhắn chứa tên, số điện thoại, địa chỉ và tiền thu COD vào đây..."
                style={{ padding: '12px', borderRadius: '12px', border: '1.5px solid #cbd5e1', fontSize: '13px', resize: 'vertical', width: '100%', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                type="submit"
                disabled={isParsing || !parseText.trim()}
                style={{
                  padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px',
                  fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {isParsing ? '⏳ Đang phân tích...' : '🤖 Bóc tách thông tin'}
              </button>
            </form>

            {parsedResult && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#166534' }}>✅ Kết quả bóc tách</div>
                <div style={{ fontSize: '13px', color: '#1f2937' }}><strong>Họ tên:</strong> {parsedResult.name || '—'}</div>
                <div style={{ fontSize: '13px', color: '#1f2937' }}><strong>Số điện thoại:</strong> {parsedResult.phone || '—'}</div>
                <div style={{ fontSize: '13px', color: '#1f2937' }}><strong>Địa chỉ:</strong> {parsedResult.address || '—'}</div>
                <div style={{ fontSize: '13px', color: '#1f2937' }}><strong>Tiền COD:</strong> {fmtMoney(parsedResult.codAmount)}</div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: TÀI KHOẢN & BẢO MẬT CHỦ SHOP (ACCOUNT & SECURITY)                  */}
        {/* ========================================================================= */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header & Health Score */}
            <div style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06))', border: '1.5px solid #c7d2fe', borderRadius: '14px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#fff', border: '3px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#10b981' }}>
                  90%
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Hồ Sơ & Bảo Mật Chủ Shop</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Tài khoản quyền Quản trị cao nhất (Super Owner)</div>
                </div>
              </div>
              <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px' }}>
                🛡️ BẢO MẬT RẤT TỐT
              </span>
            </div>

            {/* Profile Info Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>👤 Thông tin Tài khoản Chủ Shop</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div>Họ và tên: <strong style={{ color: '#0f172a' }}>{currentUser.full_name}</strong></div>
                <div>Email: <strong style={{ color: '#0f172a' }}>{currentUser.email}</strong></div>
                <div>Số điện thoại: <strong style={{ color: '#0f172a' }}>{currentUser.phone}</strong></div>
                <div>Mã Owner: <code style={{ color: '#4f46e5', fontWeight: 700 }}>{currentUser.id}</code></div>
              </div>
            </div>

            {/* Change Password Form */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
              <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>🔒 Đổi Mật Khẩu Chủ Shop</h4>
              <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Mật khẩu mới</label>
                  <input
                    type="password"
                    value={passwordForm.newPass}
                    onChange={(e) => handlePwChange(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự..."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                  {/* Strength Bar */}
                  {passwordForm.newPass && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ height: '5px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pwStrength}%`, height: '100%', background: pwStrength > 70 ? '#10b981' : pwStrength > 40 ? '#f59e0b' : '#ef4444', transition: 'all 0.3s' }} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPass}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPass: e.target.value }))}
                    placeholder="Nhập lại mật khẩu..."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  style={{ padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', alignSelf: 'flex-start' }}
                >
                  💾 Lưu Mật Khẩu
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Modern Bottom / Mobile Nav Bar */}
      <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: '#ffffff', borderTop: '1px solid #e2e8f0', position: 'sticky', bottom: 0, zIndex: 100, boxShadow: '0 -2px 10px rgba(0,0,0,0.03)' }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{ padding: '10px 4px', border: 'none', background: 'none', color: activeTab === 'dashboard' ? '#4f46e5' : '#64748b', fontWeight: activeTab === 'dashboard' ? 800 : 500, fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '18px' }}>📊</span>
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('shops')}
          style={{ padding: '10px 4px', border: 'none', background: 'none', color: activeTab === 'shops' ? '#4f46e5' : '#64748b', fontWeight: activeTab === 'shops' ? 800 : 500, fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '18px' }}>🏪</span>
          Shop
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          style={{ padding: '10px 4px', border: 'none', background: 'none', color: activeTab === 'staff' ? '#4f46e5' : '#64748b', fontWeight: activeTab === 'staff' ? 800 : 500, fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '18px' }}>👥</span>
          Nhân viên
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={{ padding: '10px 4px', border: 'none', background: 'none', color: activeTab === 'orders' ? '#4f46e5' : '#64748b', fontWeight: activeTab === 'orders' ? 800 : 500, fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '18px' }}>📦</span>
          Đơn hàng
        </button>
        <button
          onClick={() => setActiveTab('account')}
          style={{ padding: '10px 4px', border: 'none', background: 'none', color: activeTab === 'account' ? '#4f46e5' : '#64748b', fontWeight: activeTab === 'account' ? 800 : 500, fontSize: '11px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
        >
          <span style={{ fontSize: '18px' }}>🛡️</span>
          Tài khoản
        </button>
      </nav>

      {/* MODAL: THÊM CỬA HÀNG */}
      {showAddShopModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>➕ Thêm Cửa Hàng / Chi Nhánh Mới</h3>
              <button onClick={() => setShowAddShopModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Tên Cửa Hàng / Chi Nhánh</label>
                <input
                  type="text"
                  required
                  value={newShopForm.name}
                  onChange={(e) => setNewShopForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Kho Bonsai Đà Nẵng..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Mã Shop (Code)</label>
                <input
                  type="text"
                  value={newShopForm.code}
                  onChange={(e) => setNewShopForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="VD: SHOP-DN-03"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Hotline / SĐT</label>
                <input
                  type="text"
                  value={newShopForm.phone}
                  onChange={(e) => setNewShopForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0912345678"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Địa chỉ kho gửi hàng</label>
                <input
                  type="text"
                  value={newShopForm.address}
                  onChange={(e) => setNewShopForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Địa chỉ bưu cục gửi hàng..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Cổng Đơn Vị Vận Chuyển</label>
                <select
                  value={newShopForm.carrier}
                  onChange={(e) => setNewShopForm(prev => ({ ...prev, carrier: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff' }}
                >
                  <option value="VNPost & J&T">VNPost & J&T Express (Mặc định)</option>
                  <option value="VNPost">Chỉ VNPost</option>
                  <option value="J&T">Chỉ J&T Express</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddShopModal(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Tạo Cửa Hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM NHÂN VIÊN */}
      {showAddStaffModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>➕ Thêm Nhân Viên Mới</h3>
              <button onClick={() => setShowAddStaffModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Họ và tên nhân viên</label>
                <input
                  type="text"
                  required
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Lê Văn Nam..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    value={newStaffForm.username}
                    onChange={(e) => setNewStaffForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="nam_order"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Số điện thoại</label>
                  <input
                    type="text"
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0911..."
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Gán vào Cửa Hàng</label>
                <select
                  value={newStaffForm.shopId}
                  onChange={(e) => setNewStaffForm(prev => ({ ...prev, shopId: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff' }}
                >
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Chức vụ & Vai trò</label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) => setNewStaffForm(prev => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff' }}
                >
                  <option value="SHOP_STAFF">Nhân viên lên đơn bưu điện</option>
                  <option value="SHOP_MANAGER">Quản lý Chi nhánh</option>
                </select>
              </div>

              {/* Specific permission checkboxes */}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>Cấp quyền bổ sung:</span>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newStaffForm.canViewCod}
                    onChange={(e) => setNewStaffForm(prev => ({ ...prev, canViewCod: e.target.checked }))}
                  />
                  Cho phép xem Báo cáo doanh thu COD
                </label>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newStaffForm.canDeleteOrder}
                    onChange={(e) => setNewStaffForm(prev => ({ ...prev, canDeleteOrder: e.target.checked }))}
                  />
                  Cho phép xóa đơn hàng
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Tạo Nhân Viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}