import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Globe, Moon, Sun, Bell, Shield, Store, Database,
  LogOut, ExternalLink, Check, Clock, AlertCircle, Package, User, ArrowRight, Menu, Zap
} from 'lucide-react';
import { AuthService } from '../../../domain/auth/auth.service.esm.js';
import { OrderStorage } from '../../../application/storage.esm.js';

const removeVietnameseTones = (str) => {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const valueOf = (item, ...keys) => {
  if (!item || typeof item !== 'object') return '';
  for (const key of keys) {
    const val = item[key] ?? item?.parsedData?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return val;
  }
  return '';
};

const formatCod = (val) => {
  const num = Number(val) || 0;
  return num > 0 ? `${num.toLocaleString('vi-VN')} đ` : '0 đ';
};

export default function TopHeader({
  currentUser,
  userRole,
  uiRole,
  shopName,
  appVersion,
  isDbConnected = true,
  activeTab,
  onOpenAdmin,
  onOpenWorkspace,
  onSearch,
  onNavigate,
  globalSearch = '',
  onLogout,
  onToggleMobileMenu
}) {
  const [searchValue, setSearchValue] = useState(globalSearch || '');
  const [searchResults, setSearchResults] = useState({ orders: [], customers: [], totalOrders: 0, totalCustomers: 0 });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('af_theme') === 'dark' ||
        document.documentElement.getAttribute('data-theme') === 'dark';
    } catch (_) {
      return false;
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [currentLang, setCurrentLang] = useState('VN');

  const searchWrapperRef = useRef(null);
  const notifRef = useRef(null);
  const avatarRef = useRef(null);

  // Sync internal searchValue if globalSearch prop changes externally
  useEffect(() => {
    if (globalSearch !== undefined && globalSearch !== null && globalSearch !== searchValue) {
      setSearchValue(globalSearch);
    }
  }, [globalSearch]);

  // Sync theme to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('af_theme', 'dark'); } catch (_) {}
    } else {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('af_theme', 'light'); } catch (_) {}
    }
  }, [isDarkMode]);

  // Click outside listener for all popovers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search query execution
  useEffect(() => {
    const q = searchValue.trim();
    if (!q) {
      setSearchResults({ orders: [], customers: [], totalOrders: 0, totalCustomers: 0 });
      setShowSearchDropdown(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const cleanQ = removeVietnameseTones(q);
        const qDigits = normalizePhone(q);

        // Fetch local submitted orders and drafts
        let submittedList = [];
        let draftList = [];
        try {
          if (typeof OrderStorage !== 'undefined') {
            if (typeof OrderStorage.getSubmittedOrders === 'function') {
              submittedList = await OrderStorage.getSubmittedOrders().catch(() => []);
            }
            if (typeof OrderStorage.getOrders === 'function') {
              draftList = await OrderStorage.getOrders().catch(() => []);
            }
          }
        } catch (_) {}

        if (!active) return;

        const allCombinedOrders = [
          ...(Array.isArray(submittedList) ? submittedList : []),
          ...(Array.isArray(draftList) ? draftList : [])
        ];

        const matchedOrders = [];
        const seenOrderKeys = new Set();
        const customerMap = new Map();

        for (const o of allCombinedOrders) {
          if (!o) continue;
          const name = String(valueOf(o, 'name', 'customerName', 'customer_name'));
          const phone = normalizePhone(valueOf(o, 'phone'));
          const tracking = String(valueOf(o, 'trackingCode', 'tracking_code')).trim();
          const orderCode = String(valueOf(o, 'orderCode', 'order_code')).trim();
          const address = String(valueOf(o, 'address'));

          const nameNorm = removeVietnameseTones(name);
          const addrNorm = removeVietnameseTones(address);

          const matchName = nameNorm.includes(cleanQ);
          const matchPhone = qDigits.length >= 3 && (phone.includes(qDigits) || phone.endsWith(qDigits));
          const matchTracking = tracking && tracking.toLowerCase().includes(q.toLowerCase());
          const matchOrderCode = orderCode && orderCode.toLowerCase().includes(q.toLowerCase());
          const matchAddr = addrNorm.includes(cleanQ);

          if (matchName || matchPhone || matchTracking || matchOrderCode || matchAddr) {
            const key = o.id || `${phone}_${orderCode || tracking}`;
            if (!seenOrderKeys.has(key)) {
              seenOrderKeys.add(key);
              matchedOrders.push({
                id: o.id,
                name: name || 'Khách hàng',
                phone: phone || '-',
                trackingCode: tracking !== '—' && tracking !== '-' ? tracking : '',
                orderCode: orderCode !== '—' && orderCode !== '-' ? orderCode : '',
                address: address || '',
                cod: valueOf(o, 'codAmount', 'cod_amount', 'cod', 'tien_thu_ho'),
                platform: valueOf(o, 'platform') || 'vnpost',
                date: valueOf(o, 'submittedAt', 'submitted_at', 'createdAt', 'created_at')
              });
            }
          }

          // Aggregate customer profiling
          if (phone && phone.length >= 9) {
            const existing = customerMap.get(phone) || {
              phone,
              name: name || 'Khách hàng',
              address: address || '',
              totalOrders: 0,
              totalCod: 0
            };
            existing.totalOrders += 1;
            const cod = Number(valueOf(o, 'codAmount', 'cod_amount', 'cod', 'tien_thu_ho') || 0);
            existing.totalCod += cod;
            if (name && (!existing.name || existing.name === 'Khách hàng')) existing.name = name;
            if (address && !existing.address) existing.address = address;
            customerMap.set(phone, existing);
          }
        }

        // Filter matched customers
        const matchedCustomers = [];
        for (const cust of customerMap.values()) {
          const cNameNorm = removeVietnameseTones(cust.name);
          const cAddrNorm = removeVietnameseTones(cust.address);
          const cPhone = cust.phone;

          const mName = cNameNorm.includes(cleanQ);
          const mPhone = qDigits.length >= 3 && (cPhone.includes(qDigits) || cPhone.endsWith(qDigits));
          const mAddr = cAddrNorm.includes(cleanQ);

          if (mName || mPhone || mAddr) {
            matchedCustomers.push(cust);
          }
        }

        if (active) {
          setSearchResults({
            orders: matchedOrders.slice(0, 5),
            customers: matchedCustomers.slice(0, 3),
            totalOrders: matchedOrders.length,
            totalCustomers: matchedCustomers.length
          });
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.warn('[TopHeader] Search query error:', err);
      }
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchValue]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchValue(val);
    if (onSearch) {
      onSearch(val, false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowSearchDropdown(false);
      if (onSearch) {
        onSearch(searchValue, true);
      }
      if (onNavigate) {
        if (activeTab === 'customers') {
          onNavigate('customers', { search: searchValue });
        } else if (activeTab === 'drafts' || activeTab === 'draft-queue') {
          onNavigate('drafts', { search: searchValue });
        } else {
          onNavigate('submitted-orders', { search: searchValue });
        }
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
    }
  };

  const handleSelectOrder = (order) => {
    setShowSearchDropdown(false);
    const searchFilter = order.trackingCode || order.orderCode || order.phone || order.name;
    if (onNavigate) {
      onNavigate('submitted-orders', { search: searchFilter, orderId: order.id });
    } else if (onSearch) {
      onSearch(searchFilter, true);
    }
  };

  const handleSelectCustomer = (customer) => {
    setShowSearchDropdown(false);
    const searchFilter = customer.phone || customer.name;
    if (onNavigate) {
      onNavigate('customers', { search: searchFilter });
    } else if (onSearch) {
      onSearch(searchFilter, true);
    }
  };

  const handleClearSearch = () => {
    setSearchValue('');
    setShowSearchDropdown(false);
    if (onSearch) onSearch('', false);
    if (onNavigate) {
      onNavigate(activeTab, { search: '' });
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const toggleLanguage = () => {
    setCurrentLang(prev => (prev === 'VN' ? 'EN' : 'VN'));
  };

  const getRoleTitle = (role) => {
    const r = String(role || '').toUpperCase();
    if (['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(r)) return 'Quản trị viên';
    if (['OWNER', 'SHOP_OWNER'].includes(r)) return 'Chủ cửa hàng';
    if (['MANAGER', 'SHOP_MANAGER'].includes(r)) return 'Quản lý';
    if (['STAFF', 'SHOP_STAFF'].includes(r)) return 'Nhân viên';
    return 'Quản trị viên';
  };

  const displayName = currentUser?.full_name || getRoleTitle(userRole);
  const email = currentUser?.email || 'Chưa cập nhật email';
  const avatarUrl = currentUser?.avatar_url || currentUser?.avatarUrl;

  const isExtensionEnvironment = () => {
    return typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';
  };

  const getWorkspaceUrl = () => {
    if (isExtensionEnvironment()) {
      return chrome.runtime.getURL('index.html');
    }
    return '/index.html';
  };

  const getAdminDashboardUrl = () => {
    if (isExtensionEnvironment()) {
      return chrome.runtime.getURL('admin.html');
    }
    return '/admin';
  };

  const navigateToPortal = (url) => {
    if (!url) return;
    const isExtension = isExtensionEnvironment();
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 900 || 'ontouchstart' in window);
    if (!isExtension || isMobile) {
      window.location.assign(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <header className="topbar-container">
      {/* MOBILE HAMBURGER BUTTON */}
      <button
        type="button"
        className="mobile-hamburger-btn"
        onClick={onToggleMobileMenu}
        aria-label="Mở menu quản lý cửa hàng"
        title="Menu"
      >
        <Menu size={20} />
      </button>

      {/* SEARCH CAPSULE BAR (LEFT/CENTER) */}
      <div className="topbar-search-wrapper" ref={searchWrapperRef}>
        <div className="search-capsule">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (searchValue.trim()) setShowSearchDropdown(true); }}
            placeholder="Tìm kiếm theo Tên, SĐT, Mã đơn, Vận đơn, Địa chỉ..."
            aria-label="Tìm kiếm theo Tên, SĐT, Mã đơn, Vận đơn, Địa chỉ"
          />
          {searchValue && (
            <button
              className="search-clear-btn"
              onClick={handleClearSearch}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        {/* INTERACTIVE LIVE SEARCH RESULTS DROPDOWN */}
        {showSearchDropdown && searchValue.trim() && (
          <div className="search-dropdown-menu">
            <div className="search-dropdown-header">
              <span>Kết quả tìm kiếm cho: <strong>"{searchValue}"</strong></span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>Nhấn <b>Enter ↵</b> để xem bảng chi tiết</span>
            </div>

            {/* SECTION 1: MATCHED ORDERS */}
            {searchResults.orders.length > 0 && (
              <div className="search-dropdown-section">
                <div className="search-dropdown-section-title">
                  <Package size={13} color="var(--primary)" /> Đơn hàng ({searchResults.totalOrders})
                </div>
                {searchResults.orders.map((o, idx) => (
                  <button
                    key={o.id || `ord-${idx}`}
                    className="search-result-item"
                    onClick={() => handleSelectOrder(o)}
                    type="button"
                  >
                    <div className="search-result-item-main">
                      <div className="search-result-icon order">
                        <Package size={15} />
                      </div>
                      <div className="search-result-info">
                        <div className="search-result-title">
                          <span>{o.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>• {o.phone}</span>
                          {o.trackingCode && (
                            <span className="search-result-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                              {o.trackingCode}
                            </span>
                          )}
                          {!o.trackingCode && o.orderCode && (
                            <span className="search-result-badge" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                              #{o.orderCode}
                            </span>
                          )}
                        </div>
                        <div className="search-result-subtitle">
                          {o.address || 'Chưa có địa chỉ chi tiết'}
                        </div>
                      </div>
                    </div>
                    <div className="search-result-meta">
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCod(o.cod)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                        {String(o.platform).includes('jt') ? 'J&T' : 'VNPost'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* SECTION 2: MATCHED CUSTOMERS */}
            {searchResults.customers.length > 0 && (
              <div className="search-dropdown-section">
                <div className="search-dropdown-section-title">
                  <User size={13} color="#16a34a" /> Khách hàng ({searchResults.totalCustomers})
                </div>
                {searchResults.customers.map((c, idx) => (
                  <button
                    key={c.phone || `cust-${idx}`}
                    className="search-result-item"
                    onClick={() => handleSelectCustomer(c)}
                    type="button"
                  >
                    <div className="search-result-item-main">
                      <div className="search-result-icon customer">
                        <User size={15} />
                      </div>
                      <div className="search-result-info">
                        <div className="search-result-title">
                          <span>{c.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>• {c.phone}</span>
                        </div>
                        <div className="search-result-subtitle">
                          {c.address || 'Chưa có địa chỉ'}
                        </div>
                      </div>
                    </div>
                    <div className="search-result-meta">
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>
                        {c.totalOrders} đơn hàng
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {searchResults.orders.length === 0 && searchResults.customers.length === 0 && (
              <div className="search-dropdown-empty">
                Không tìm thấy đơn hàng hoặc khách hàng nào khớp với <strong>"{searchValue}"</strong> trong bộ nhớ máy.
              </div>
            )}

            {/* QUICK ACTIONS FOOTER */}
            <div className="search-dropdown-actions">
              <button
                type="button"
                className="search-dropdown-action-btn"
                onClick={() => {
                  setShowSearchDropdown(false);
                  if (onNavigate) onNavigate('submitted-orders', { search: searchValue });
                  else if (onSearch) onSearch(searchValue, true);
                }}
              >
                <Package size={14} />
                <span>Xem tất cả trong <b>Đơn hàng đã gửi</b></span>
                <ArrowRight size={13} style={{ marginLeft: 'auto', opacity: 0.7 }} />
              </button>
              <button
                type="button"
                className="search-dropdown-action-btn"
                onClick={() => {
                  setShowSearchDropdown(false);
                  if (onNavigate) onNavigate('customers', { search: searchValue });
                  else if (onSearch) onSearch(searchValue, true);
                }}
              >
                <User size={14} />
                <span>Tra cứu trong <b>Sổ bạ khách hàng (CRM)</b></span>
                <ArrowRight size={13} style={{ marginLeft: 'auto', opacity: 0.7 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT ACTION CONTROLS */}
      <div className="topbar-actions">
        {/* APP VERSION BADGE */}
        <div
          className="topbar-version-badge"
          title={`Phiên bản Auto Fill Order đang chạy: v${appVersion || '1.0.1'}`}
        >
          <span className="version-pill-dot"></span>
          <span className="version-text">v{appVersion || '1.0.1'}</span>
        </div>

        {/* DATABASE CONNECTION STATUS BADGE */}
        <div
          className={`topbar-db-badge ${isDbConnected ? 'connected' : 'disconnected'}`}
          title={isDbConnected ? 'Cơ sở dữ liệu Supabase: Đã kết nối' : 'Cơ sở dữ liệu: Mất kết nối'}
        >
          <span className={`db-status-dot ${isDbConnected ? 'live' : ''}`}></span>
          <Database size={13} className="db-icon" />
          <span className="db-text">{isDbConnected ? 'Đã kết nối DB' : 'Mất kết nối'}</span>
        </div>

        {/* QUICK WORKSPACE SWITCH BUTTON */}
        <button
          className="topbar-action-btn"
          onClick={() => {
            if (onOpenWorkspace) {
              onOpenWorkspace();
            } else {
              navigateToPortal(getWorkspaceUrl());
            }
          }}
          title="Chuyển sang Mobile Workspace (Bóc tách đơn & Bán hàng)"
          style={{
            fontWeight: 700,
            fontSize: '12.5px',
            color: 'var(--primary)',
            background: 'var(--primary-light)',
            borderColor: 'var(--primary-border)',
            gap: '6px'
          }}
        >
          <Zap size={15} color="var(--primary)" />
          <span>Workspace</span>
        </button>

        {/* SHOP NAME BADGE */}
        <div className="topbar-shop-badge" title={`Cửa hàng đang hoạt động: ${shopName || 'Cửa hàng của tôi'}`}>
          <Store size={14} className="shop-badge-icon" />
          <span className="shop-badge-text">{shopName || 'Cửa hàng của tôi'}</span>
        </div>

        {/* LANGUAGE SWITCH */}
        <button
          className="topbar-action-btn lang-btn"
          onClick={toggleLanguage}
          title={`Đổi ngôn ngữ (Hiện tại: ${currentLang === 'VN' ? 'Tiếng Việt' : 'English'})`}
        >
          <span className="lang-text">{currentLang}</span>
          <Globe size={16} className="action-icon" />
        </button>

        {/* DARK / LIGHT MODE TOGGLE */}
        <button
          className="topbar-action-btn theme-toggle-btn"
          onClick={toggleTheme}
          title={isDarkMode ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
        >
          {isDarkMode ? (
            <Sun size={17} className="action-icon theme-sun" />
          ) : (
            <Moon size={17} className="action-icon theme-moon" />
          )}
        </button>

        {/* NOTIFICATIONS BELL */}
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className={`topbar-action-btn notif-btn ${showNotifications ? 'active' : ''}`}
            onClick={() => setShowNotifications(!showNotifications)}
            title="Thông báo hệ thống"
          >
            <Bell size={18} className="action-icon" />
            <span className="unread-dot" title="Trạng thái hệ thống trực tuyến"></span>
          </button>

          {showNotifications && (
            <div className="header-dropdown-menu notif-dropdown">
              <div className="dropdown-header">
                <span className="dropdown-title">Trạng Thái & Thông Báo</span>
                <span className="dropdown-badge">{isDbConnected ? 'Trực tuyến' : 'Cảnh báo'}</span>
              </div>
              <div className="notif-list">
                <div className={`notif-item ${isDbConnected ? '' : 'unread'}`}>
                  <div className={`notif-icon-box ${isDbConnected ? 'success' : 'danger'}`}>
                    {isDbConnected ? <Check size={14} /> : <AlertCircle size={14} />}
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">
                      {isDbConnected ? 'Supabase Cloud đã kết nối' : 'Mất kết nối Supabase'}
                    </div>
                    <div className="notif-desc">
                      {isDbConnected 
                        ? 'Dữ liệu đơn hàng, CRM và phân quyền hoạt động ổn định.' 
                        : 'Vui lòng kiểm tra mạng hoặc đăng nhập lại để đồng bộ.'}
                    </div>
                    <div className="notif-time">Thời gian thực</div>
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-icon-box info">
                    <Store size={14} />
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">Cửa hàng: {shopName || 'Cửa hàng của tôi'}</div>
                    <div className="notif-desc">Bộ lọc và tự động điền đơn đã đồng bộ theo cấu hình shop.</div>
                    <div className="notif-time">Sẵn sàng điền đơn</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* VERTICAL DIVIDER */}
        <div className="topbar-divider"></div>

        {/* USER AVATAR WITH DROPDOWN */}
        <div className="avatar-wrapper" ref={avatarRef}>
          <button
            className={`avatar-button ${showAvatarMenu ? 'active' : ''}`}
            onClick={() => setShowAvatarMenu(!showAvatarMenu)}
            title={`${displayName} (${email})`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="header-avatar-img" />
            ) : (
              <div className="header-avatar-placeholder">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {showAvatarMenu && (
            <div className="header-dropdown-menu avatar-dropdown">
              <div className="avatar-dropdown-user">
                <div className="avatar-dropdown-img-box">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} />
                  ) : (
                    <div className="avatar-placeholder-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="avatar-dropdown-details">
                  <div className="avatar-dropdown-name">{displayName}</div>
                  <div className="avatar-dropdown-email">{email}</div>
                  <div className="avatar-dropdown-role">{getRoleTitle(userRole)}</div>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <div className="avatar-dropdown-links">
                <button
                  className="dropdown-link-btn"
                  onClick={() => {
                    setShowAvatarMenu(false);
                    if (onOpenWorkspace) {
                      onOpenWorkspace();
                    } else {
                      navigateToPortal(getWorkspaceUrl());
                    }
                  }}
                >
                  <Zap size={14} color="#f59e0b" />
                  <span>Mobile Workspace (Bán hàng)</span>
                  <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                </button>

                {uiRole === 'master_admin' && (
                  <button
                    className="dropdown-link-btn"
                    onClick={() => {
                      setShowAvatarMenu(false);
                      if (onOpenAdmin) {
                        onOpenAdmin();
                      } else {
                        navigateToPortal(getAdminDashboardUrl());
                      }
                    }}
                  >
                    <Shield size={14} color="#2563eb" />
                    <span>Bảng quản trị Master Admin</span>
                    <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                  </button>
                )}

                <button
                  className="dropdown-link-btn logout"
                  onClick={async () => {
                    setShowAvatarMenu(false);
                    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                      if (onLogout) {
                        onLogout();
                      } else {
                        await AuthService.logout();
                        window.location.reload();
                      }
                    }
                  }}
                >
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
