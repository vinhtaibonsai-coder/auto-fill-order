import React, { useEffect, useMemo, useState } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

const EMPTY_SHOP = {
  id: '',
  shop_code: '',
  name: '',
  phone: '',
  email: '',
  status: 'active',
  sender_name: '',
  sender_phone: '',
  sender_address: '',
  sender_province: '',
  sender_district: '',
  sender_ward: '',
  order_code_prefix: 'DH',
  vnpost_customer_code: '',
  jt_contract_code: '',
  default_carrier: 'VNPost',
  bank_name: '',
  bank_code: '',
  bank_account_no: '',
  bank_account_name: '',
  default_package_weight: 200,
  default_package_note: '',
  shipping_fee_payer: 'sender'
};

const VIETQR_BANKS = [
  ['VCB', 'Vietcombank'], ['MB', 'MB Bank'], ['TCB', 'Techcombank'], ['ACB', 'ACB'],
  ['BIDV', 'BIDV'], ['VPB', 'VPBank'], ['TPB', 'TPBank'], ['STB', 'Sacombank'],
  ['CTG', 'VietinBank'], ['VIB', 'VIB'], ['HDB', 'HDBank'], ['MSB', 'MSB'],
  ['OCB', 'OCB'], ['SHB', 'SHB'], ['EIB', 'Eximbank'], ['LPB', 'LPBank'],
  ['SEAB', 'SeABank'], ['ABB', 'ABBank'], ['BAB', 'Bac A Bank'], ['BVB', 'BaoViet Bank'],
  ['DAB', 'DongA Bank'], ['GPB', 'GPBank'], ['KLB', 'KienlongBank'], ['NAB', 'Nam A Bank'],
  ['NCB', 'NCB'], ['OJB', 'OceanBank'], ['PGB', 'PGBank'], ['PVCB', 'PVcomBank'],
  ['SCB', 'SCB'], ['SGB', 'SaigonBank'], ['VAB', 'VietABank'], ['VCCB', 'VietCapitalBank'],
  ['VIETBANK', 'VietBank'], ['VRB', 'VRB'], ['WOO', 'Woori Bank'], ['HSBC', 'HSBC Vietnam'],
  ['UOB', 'UOB Vietnam'], ['CIMB', 'CIMB Vietnam'], ['DBS', 'DBS Bank'], ['CAKE', 'Cake by VPBank'],
  ['TIMO', 'Timo'], ['TNEX', 'TNEX'], ['COOPBANK', 'Co-opBank'], ['AGRIBANK', 'Agribank']
].map(([code, name]) => ({ code, name }));

const VIETNAM_PROVINCES = [
  'Hà Nội', 'TP Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ',
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
  'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
];

const ADDRESS_TREE = {
  'TP Hồ Chí Minh': {
    'TP Thủ Đức': ['Phú Hữu', 'An Phú', 'Hiệp Bình Chánh', 'Linh Trung'],
    'Quận 1': ['Bến Nghé', 'Bến Thành', 'Đa Kao', 'Nguyễn Thái Bình'],
    'Quận 7': ['Tân Phong', 'Tân Phú', 'Phú Mỹ', 'Bình Thuận'],
    'Bình Chánh': ['Bình Hưng', 'Phong Phú', 'Vĩnh Lộc A', 'Tân Kiên']
  },
  'Hà Nội': {
    'Hoàng Mai': ['Định Công', 'Giáp Bát', 'Hoàng Liệt', 'Mai Động'],
    'Hai Bà Trưng': ['Bạch Mai', 'Minh Khai', 'Vĩnh Tuy', 'Thanh Nhàn'],
    'Nam Từ Liêm': ['Mễ Trì', 'Mỹ Đình 1', 'Mỹ Đình 2', 'Trung Văn'],
    'Cầu Giấy': ['Dịch Vọng', 'Dịch Vọng Hậu', 'Mai Dịch', 'Yên Hòa']
  },
  'Đà Nẵng': {
    'Hải Châu': ['Hải Châu 1', 'Hải Châu 2', 'Thạch Thang', 'Thuận Phước'],
    'Thanh Khê': ['An Khê', 'Chính Gián', 'Tam Thuận', 'Xuân Hà'],
    'Sơn Trà': ['An Hải Bắc', 'An Hải Đông', 'Mân Thái', 'Nại Hiên Đông']
  },
  'Thừa Thiên Huế': {
    'Phú Xuân': ['Thuận Hòa', 'Tây Lộc', 'Kim Long', 'Phường Đúc'],
    'Thuận Hóa': ['Phú Hội', 'Vỹ Dạ', 'Xuân Phú', 'An Cựu']
  },
  'Cần Thơ': {
    'Ninh Kiều': ['An Cư', 'An Hòa', 'Cái Khế', 'Tân An'],
    'Cái Răng': ['Ba Láng', 'Hưng Phú', 'Lê Bình', 'Thường Thạnh']
  }
};

const fieldStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
  background: 'var(--card)',
  color: 'var(--text-main)',
  boxSizing: 'border-box'
};

const cardStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: 700,
  fontSize: '12px',
  color: 'var(--text-main)'
};

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={cardStyle}>
      <div style={{ height: '16px', width: '42%', background: '#e2e8f0', borderRadius: '4px', marginBottom: '18px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '38px', background: '#f1f5f9', borderRadius: '6px' }} />
        ))}
      </div>
    </div>
  );
}

export default function ShopProfile() {
  const [shops, setShops] = useState([]);
  const [activeShopId, setActiveShopId] = useState('');
  const [shop, setShop] = useState(EMPTY_SHOP);
  const [userRole, setUserRole] = useState('OWNER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const isReadOnly = !['OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER', 'SYSTEM_ADMIN'].includes(String(userRole).toUpperCase());

  const districts = useMemo(() => {
    if (!shop.sender_province) return [];
    const p = String(shop.sender_province).replace(/^(Tỉnh|Thành phố|TP\.?)\s+/i, '').trim().toLowerCase();
    const matchKey = Object.keys(ADDRESS_TREE).find(k => {
      const cleanK = k.replace(/^(Tỉnh|Thành phố|TP\.?)\s+/i, '').trim().toLowerCase();
      return cleanK === p || cleanK.includes(p) || p.includes(cleanK);
    });
    return matchKey ? Object.keys(ADDRESS_TREE[matchKey] || {}) : [];
  }, [shop.sender_province]);

  const wards = useMemo(() => {
    if (!shop.sender_province || !shop.sender_district) return [];
    const p = String(shop.sender_province).replace(/^(Tỉnh|Thành phố|TP\.?)\s+/i, '').trim().toLowerCase();
    const matchKey = Object.keys(ADDRESS_TREE).find(k => {
      const cleanK = k.replace(/^(Tỉnh|Thành phố|TP\.?)\s+/i, '').trim().toLowerCase();
      return cleanK === p || cleanK.includes(p) || p.includes(cleanK);
    });
    return matchKey ? ADDRESS_TREE[matchKey]?.[shop.sender_district] || [] : [];
  }, [shop.sender_province, shop.sender_district]);

  const updateShop = (patch) => {
    if (isReadOnly) return;
    setShop(prev => ({ ...prev, ...patch }));
  };

  const getCloudContext = async () => {
    if (!globalThis.SupabaseCloud || typeof globalThis.SupabaseCloud.loadConfig !== 'function') {
      throw new Error('Thiếu cấu hình kết nối Supabase');
    }
    const config = await globalThis.SupabaseCloud.loadConfig();
    const sess = await AuthSession.getSession();
    if (!config?.url || !config?.anonKey) throw new Error('Thiếu Supabase URL hoặc Anon Key');
    if (!sess?.access_token) throw new Error('Bạn cần đăng nhập lại để quản trị hồ sơ shop');
    return { config, sess, headers: { apikey: config.anonKey, Authorization: `Bearer ${sess.access_token}` } };
  };

  const normalizeShop = (row = {}) => ({
    ...EMPTY_SHOP,
    ...row,
    shop_code: row.shop_code || row.code || row.id?.slice(0, 8)?.toUpperCase() || '',
    status: row.status || 'active',
    default_carrier: row.default_carrier || row.carrier || 'VNPost',
    bank_code: row.bank_code || '',
    bank_name: row.bank_name || '',
    default_package_weight: Number(row.default_package_weight || 200)
  });

  const loadProfile = async (preferredShopId = '') => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const { config, sess, headers } = await getCloudContext();
      const base = config.url.replace(/\/$/, '');
      const userId = sess.user?.id;
      const activeId = preferredShopId || sess.active_shop_id || '';
      const requests = [];

      // Xác định vai trò của người dùng
      const roleFromSession = sess.user?.role || sess.role || (sess.auth_type === 'shop_key' ? 'STAFF' : 'OWNER');
      setUserRole(roleFromSession);

      if (userId) {
        requests.push(fetch(`${base}/rest/v1/shops?select=*&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.asc,id.asc`, { headers }));
        requests.push(fetch(`${base}/rest/v1/shop_members?select=role,shops(*)&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`, { headers }));
      }
      if (activeId) {
        requests.push(fetch(`${base}/rest/v1/shops?select=*&id=eq.${encodeURIComponent(activeId)}`, { headers }));
      }

      const responses = await Promise.all(requests.map(req => req.catch(() => null)));
      const rows = [];
      for (const res of responses) {
        if (!res?.ok) continue;
        const data = await res.json().catch(() => []);
        if (!Array.isArray(data)) continue;
        data.forEach(item => {
          if (item?.shops) {
            rows.push(item.shops);
            if (item.role) setUserRole(item.role);
          } else {
            rows.push(item);
          }
        });
      }

      const map = new Map();
      rows.filter(Boolean).forEach(item => map.set(String(item.id), normalizeShop(item)));
      const list = Array.from(map.values());
      if (list.length === 0) throw new Error('Không tìm thấy chi nhánh nào cho tài khoản này');

      const selected = list.find(item => String(item.id) === String(activeId)) || list[0];
      setShops(list);
      setActiveShopId(selected.id);
      setShop(selected);
      if (typeof AuthSession.updateActiveShop === 'function') await AuthSession.updateActiveShop(selected.id);

      const pkgWeight = Number(selected.default_package_weight) || 0;
      if (pkgWeight > 0) {
        const pkgWeightKg = pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            default_package_weight: pkgWeight,
            default_weight_vnpost: pkgWeight,
            default_weight_jt: pkgWeightKg,
            default_package_note: selected.default_package_note || ''
          }, () => {});
        }
        try {
          localStorage.setItem('default_package_weight', String(pkgWeight));
          localStorage.setItem('default_weight_vnpost', String(pkgWeight));
          localStorage.setItem('default_weight_jt', String(pkgWeightKg));
          if (selected.default_package_note) localStorage.setItem('default_package_note', selected.default_package_note);
        } catch (_) {}
      }
    } catch (err) {
      setMessage({ text: err.message || 'Không thể tải hồ sơ cửa hàng', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleBranchChange = async (shopId) => {
    const selected = shops.find(item => String(item.id) === String(shopId));
    if (!selected) return;
    setActiveShopId(shopId);
    setShop(selected);
    if (typeof AuthSession.updateActiveShop === 'function') await AuthSession.updateActiveShop(shopId);
    if (globalThis.ShopService && typeof globalThis.ShopService.setActiveShop === 'function') {
      await globalThis.ShopService.setActiveShop(shopId);
    }

    const pkgWeight = Number(selected.default_package_weight) || 0;
    if (pkgWeight > 0) {
      const pkgWeightKg = pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          default_package_weight: pkgWeight,
          default_weight_vnpost: pkgWeight,
          default_weight_jt: pkgWeightKg,
          default_package_note: selected.default_package_note || ''
        }, () => {});
      }
      try {
        localStorage.setItem('default_package_weight', String(pkgWeight));
        localStorage.setItem('default_weight_vnpost', String(pkgWeight));
        localStorage.setItem('default_weight_jt', String(pkgWeightKg));
        if (selected.default_package_note) localStorage.setItem('default_package_note', selected.default_package_note);
      } catch (_) {}
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const { config, sess, headers } = await getCloudContext();
      if (!shop.id) throw new Error('Không tìm thấy ID cửa hàng');

      const selectedBank = VIETQR_BANKS.find(bank => bank.code === shop.bank_code);
      const payload = {
        name: shop.name,
        shop_code: shop.shop_code,
        phone: shop.phone,
        email: shop.email,
        status: shop.status,
        sender_name: shop.sender_name,
        sender_phone: shop.sender_phone,
        sender_address: shop.sender_address,
        sender_province: shop.sender_province,
        sender_district: shop.sender_district,
        sender_ward: shop.sender_ward,
        order_code_prefix: shop.order_code_prefix,
        vnpost_customer_code: shop.vnpost_customer_code,
        jt_contract_code: shop.jt_contract_code,
        default_carrier: shop.default_carrier,
        bank_code: shop.bank_code,
        bank_name: selectedBank?.name || shop.bank_name,
        bank_account_no: shop.bank_account_no,
        bank_account_name: shop.bank_account_name,
        default_package_weight: Number(shop.default_package_weight) || 0,
        default_package_note: shop.default_package_note,
        shipping_fee_payer: shop.shipping_fee_payer,
        updated_at: new Date().toISOString()
      };

      const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/shops?id=eq.${encodeURIComponent(shop.id)}`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || 'Không thể cập nhật thông tin cửa hàng');
      }

      const rows = await response.json().catch(() => []);
      const savedShop = normalizeShop(rows[0] || { ...shop, ...payload });
      setShop(savedShop);
      setShops(prev => prev.map(item => String(item.id) === String(savedShop.id) ? savedShop : item));
      if (typeof AuthSession.updateActiveShop === 'function') await AuthSession.updateActiveShop(savedShop.id);
      if (globalThis.ShopService && typeof globalThis.ShopService.syncShopsFromCloud === 'function') {
        await globalThis.ShopService.syncShopsFromCloud();
      }

      const pkgWeight = Number(savedShop.default_package_weight) || 0;
      if (pkgWeight > 0) {
        const pkgWeightKg = pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({
            default_package_weight: pkgWeight,
            default_weight_vnpost: pkgWeight,
            default_weight_jt: pkgWeightKg,
            default_package_note: savedShop.default_package_note || ''
          });
        }
        try {
          localStorage.setItem('default_package_weight', String(pkgWeight));
          localStorage.setItem('default_weight_vnpost', String(pkgWeight));
          localStorage.setItem('default_weight_jt', String(pkgWeightKg));
          if (savedShop.default_package_note) localStorage.setItem('default_package_note', savedShop.default_package_note);
        } catch (_) {}
      }
      setMessage({ text: `Đã lưu hồ sơ ${savedShop.name || 'cửa hàng'} và đồng bộ cache local.`, type: 'success' });
      window.setTimeout(() => setMessage({ text: '', type: '' }), 3500);
    } catch (err) {
      setMessage({ text: err.message || 'Lỗi lưu hồ sơ cửa hàng', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const senderLine = [
    shop.sender_address,
    shop.sender_ward,
    shop.sender_district,
    shop.sender_province
  ].filter(Boolean).join(', ');

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '18px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: '8px' }}>Hồ sơ & Kho gửi hàng</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '760px' }}>
            Quản trị định danh shop, kho gửi, mã hợp đồng vận chuyển, tài khoản đối soát COD và cấu hình bưu phẩm mặc định.
          </p>
        </div>
        <button
          onClick={() => loadProfile(activeShopId)}
          disabled={loading || saving}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: loading || saving ? 'not-allowed' : 'pointer' }}
        >
          🔄 Tải lại
        </button>
      </div>

      {message.text && (
        <div style={{ padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', background: message.type === 'error' ? '#fee2e2' : '#dcfce7', color: message.type === 'error' ? '#b91c1c' : '#15803d', border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
          {message.text}
        </div>
      )}

      {isReadOnly && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          <span>🔒</span>
          <span>Chế độ xem (Read-only): Bạn đang đăng nhập với quyền Nhân viên/Người xem. Chỉ Chủ Shop hoặc Quản Lý mới có quyền thay đổi thông tin kho gửi và tài khoản đối soát COD.</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : message.type === 'error' && !shop.id ? (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Không tải được hồ sơ cửa hàng</h3>
          <p style={{ color: 'var(--text-muted)' }}>{message.text}</p>
          <button onClick={() => loadProfile()} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: '16px', display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 1.3fr', gap: '18px', alignItems: 'stretch' }}>
            <Field label="Chi nhánh đang cấu hình">
              <select value={activeShopId} onChange={(e) => handleBranchChange(e.target.value)} style={fieldStyle}>
                {shops.map(item => (
                  <option key={item.id} value={item.id}>{item.name || item.id}</option>
                ))}
              </select>
            </Field>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Tem gửi bưu điện mẫu</div>
              <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: '12px', alignItems: 'center' }}>
                <div style={{ border: '2px solid #0f172a', height: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px', color: '#0f172a', background: '#fff' }}>
                  {shop.default_carrier}
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.55 }}>
                  <div><strong>Người gửi:</strong> {shop.sender_name || shop.name || 'Tên shop'}</div>
                  <div><strong>SĐT:</strong> {shop.sender_phone || shop.phone || '090...'}</div>
                  <div><strong>Kho:</strong> {senderLine || 'Địa chỉ kho gửi hàng'}</div>
                  <div><strong>Mã đơn:</strong> {(shop.order_code_prefix || 'DH')}-000001</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
            <section style={cardStyle}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>1. Định danh & Chi nhánh</h3>
              <div style={{ display: 'grid', gap: '14px' }}>
                <Field label="Tên shop">
                  <input value={shop.name} onChange={(e) => updateShop({ name: e.target.value })} style={fieldStyle} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <Field label="ID UUID">
                    <input value={shop.id} disabled style={{ ...fieldStyle, background: '#f8fafc', color: '#64748b' }} />
                  </Field>
                  <Field label="Mã Shop">
                    <input value={shop.shop_code} onChange={(e) => updateShop({ shop_code: e.target.value.toUpperCase() })} style={fieldStyle} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <Field label="Hotline">
                    <input value={shop.phone} onChange={(e) => updateShop({ phone: e.target.value })} style={fieldStyle} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={shop.email} onChange={(e) => updateShop({ email: e.target.value })} style={fieldStyle} />
                  </Field>
                </div>
                <Field label="Trạng thái hoạt động">
                  <select value={shop.status} onChange={(e) => updateShop({ status: e.target.value })} style={fieldStyle}>
                    <option value="active">Đang hoạt động</option>
                    <option value="paused">Tạm dừng</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </Field>
              </div>
            </section>

            <section style={cardStyle}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>2. Địa chỉ Kho gửi bưu điện</h3>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <Field label="Tên người gửi">
                    <input value={shop.sender_name} onChange={(e) => updateShop({ sender_name: e.target.value })} style={fieldStyle} />
                  </Field>
                  <Field label="SĐT gửi">
                    <input value={shop.sender_phone} onChange={(e) => updateShop({ sender_phone: e.target.value })} style={fieldStyle} />
                  </Field>
                </div>
                <Field label="Địa chỉ chi tiết">
                  <textarea value={shop.sender_address} onChange={(e) => updateShop({ sender_address: e.target.value })} rows={3} style={fieldStyle} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                  <Field label="Tỉnh/Thành">
                    <select
                      value={shop.sender_province}
                      onChange={(e) => updateShop({ sender_province: e.target.value, sender_district: '', sender_ward: '' })}
                      style={fieldStyle}
                    >
                      <option value="">-- Chọn tỉnh/thành (63 tỉnh thành) --</option>
                      {VIETNAM_PROVINCES.map(name => <option key={name} value={name}>{name}</option>)}
                      {shop.sender_province && !VIETNAM_PROVINCES.includes(shop.sender_province) && (
                        <option value={shop.sender_province}>{shop.sender_province}</option>
                      )}
                    </select>
                  </Field>
                  <Field label="Quận/Huyện">
                    <input
                      list="district-options"
                      value={shop.sender_district}
                      onChange={(e) => updateShop({ sender_district: e.target.value, sender_ward: '' })}
                      placeholder="Nhập hoặc chọn quận/huyện"
                      style={fieldStyle}
                    />
                    <datalist id="district-options">
                      {districts.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </Field>
                  <Field label="Phường/Xã">
                    <input
                      list="ward-options"
                      value={shop.sender_ward}
                      onChange={(e) => updateShop({ sender_ward: e.target.value })}
                      placeholder="Nhập hoặc chọn phường/xã"
                      style={fieldStyle}
                    />
                    <datalist id="ward-options">
                      {wards.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </Field>
                </div>
              </div>
            </section>

            <section style={cardStyle}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>3. Mã Hợp đồng & Tiền tố đơn</h3>
              <div style={{ display: 'grid', gap: '14px' }}>
                <Field label="Tiền tố mã đơn">
                  <input value={shop.order_code_prefix} onChange={(e) => updateShop({ order_code_prefix: e.target.value.toUpperCase() })} style={fieldStyle} />
                </Field>
                <Field label="Mã KH VNPost CMS">
                  <input value={shop.vnpost_customer_code} onChange={(e) => updateShop({ vnpost_customer_code: e.target.value })} style={fieldStyle} />
                </Field>
                <Field label="Mã hợp đồng J&T">
                  <input value={shop.jt_contract_code} onChange={(e) => updateShop({ jt_contract_code: e.target.value })} style={fieldStyle} />
                </Field>
                <Field label="Cổng vận chuyển mặc định">
                  <select value={shop.default_carrier} onChange={(e) => updateShop({ default_carrier: e.target.value })} style={fieldStyle}>
                    <option value="VNPost">VNPost</option>
                    <option value="J&T">J&T Express</option>
                    <option value="VNPost & J&T">VNPost & J&T</option>
                  </select>
                </Field>
              </div>
            </section>

            <section style={cardStyle}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>4. Tài khoản Ngân hàng đối soát COD</h3>
              <div style={{ display: 'grid', gap: '14px' }}>
                <Field label="Ngân hàng VietQR">
                  <select value={shop.bank_code} onChange={(e) => {
                    const bank = VIETQR_BANKS.find(item => item.code === e.target.value);
                    updateShop({ bank_code: e.target.value, bank_name: bank?.name || '' });
                  }} style={fieldStyle}>
                    <option value="">Chọn ngân hàng</option>
                    {VIETQR_BANKS.map(bank => <option key={bank.code} value={bank.code}>{bank.code} - {bank.name}</option>)}
                  </select>
                </Field>
                <Field label="Số tài khoản">
                  <input value={shop.bank_account_no} onChange={(e) => updateShop({ bank_account_no: e.target.value })} style={fieldStyle} />
                </Field>
                <Field label="Tên chủ tài khoản">
                  <input value={shop.bank_account_name} onChange={(e) => updateShop({ bank_account_name: e.target.value.toUpperCase() })} style={fieldStyle} />
                </Field>
              </div>
            </section>

            <section style={{ ...cardStyle, gridColumn: '1 / -1' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>5. Cấu hình Bưu phẩm mặc định</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 220px', gap: '14px' }}>
                <Field label="Trọng lượng mặc định (gram)">
                  <input type="number" min="1" value={shop.default_package_weight} onChange={(e) => updateShop({ default_package_weight: e.target.value })} style={fieldStyle} />
                </Field>
                <Field label="Ghi chú phát hàng mặc định">
                  <input value={shop.default_package_note} onChange={(e) => updateShop({ default_package_note: e.target.value })} placeholder="Ví dụ: Gọi trước khi giao, cho xem hàng..." style={fieldStyle} />
                </Field>
                <Field label="Người chịu cước">
                  <select value={shop.shipping_fee_payer} onChange={(e) => updateShop({ shipping_fee_payer: e.target.value })} style={fieldStyle}>
                    <option value="sender">Shop trả cước</option>
                    <option value="receiver">Người nhận trả cước</option>
                    <option value="cod">Trừ vào COD</option>
                  </select>
                </Field>
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', position: 'sticky', bottom: 12, zIndex: 10 }}>
            <button
              onClick={() => loadProfile(activeShopId)}
              disabled={saving}
              style={{ background: 'var(--card)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              Hủy thay đổi
            </button>
            {!isReadOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--primary)', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.72 : 1, boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)' }}
              >
                {saving ? 'Đang lưu...' : '💾 Lưu & đồng bộ'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
