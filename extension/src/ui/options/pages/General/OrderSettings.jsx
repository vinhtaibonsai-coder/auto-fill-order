import React, { useState, useEffect, useCallback } from 'react';
import { Package, Truck, Sparkles, Check, CheckCircle2, Zap, HelpCircle, Save, Sliders, ShieldCheck, Cloud, RefreshCw, AlertCircle } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function OrderSettings() {
  const [settings, setSettings] = useState({
    defaultCarrier: 'vnpost',
    defaultItemName: 'Quần Áo thời trang',
    defaultWeight: 200, // VNPost (gram)
    defaultWeightKg: 0.2, // J&T (kg)
    defaultCod: 0,
    autoParse: true,
    autoNormalizeAddress: true,
    requireReviewOnLowConfidence: true,
    showDraftQueue: true
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeShopName, setActiveShopName] = useState('');
  const [cloudSynced, setCloudSynced] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [blacklist, setBlacklist] = useState([]);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');

  const syncToStorage = async (data, nextBlacklist) => {
    try {
      const bl = nextBlacklist !== undefined ? nextBlacklist : blacklist;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({
          order_default_settings: data,
          default_goods_name: data.defaultItemName,
          default_weight_vnpost: data.defaultWeight,
          default_weight_jt: data.defaultWeightKg,
          draft_queue_enabled: data.showDraftQueue ?? true,
          blacklistPhones: bl
        });
      }
      try {
        localStorage.setItem('order_default_settings', JSON.stringify(data));
        localStorage.setItem('default_goods_name', data.defaultItemName || '');
        localStorage.setItem('default_weight_vnpost', String(data.defaultWeight || 200));
        localStorage.setItem('default_weight_jt', String(data.defaultWeightKg || 0.2));
        localStorage.setItem('draft_queue_enabled', String(data.showDraftQueue ?? true));
        localStorage.setItem('blacklistPhones', JSON.stringify(bl));
      } catch (_) {}
    } catch (_) {}
  };

  const handleAddBlacklist = (e) => {
    e.preventDefault();
    const clean = String(newPhone || '').replace(/\D/g, '');
    if (!clean || clean.length < 9) {
      alert('Vui lòng nhập số điện thoại hợp lệ (ít nhất 9 số)');
      return;
    }
    if (blacklist.some(b => (typeof b === 'string' ? b : b.phone) === clean)) {
      alert('Số điện thoại này đã có trong danh sách đen');
      return;
    }
    const item = { phone: clean, reason: newReason.trim() || 'Lịch sử bom hàng / từ chối nhận', addedAt: new Date().toISOString() };
    const updated = [item, ...blacklist];
    setBlacklist(updated);
    setNewPhone('');
    setNewReason('');
    syncToStorage(settings, updated);
  };

  const handleRemoveBlacklist = (phoneToRemove) => {
    const updated = blacklist.filter(b => (typeof b === 'string' ? b : b.phone) !== phoneToRemove);
    setBlacklist(updated);
    syncToStorage(settings, updated);
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    let loaded = null;

    // Đọc Blacklist
    try {
      let bl = [];
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const blRes = await new Promise(r => chrome.storage.local.get(['blacklistPhones'], r));
        if (Array.isArray(blRes?.blacklistPhones)) bl = blRes.blacklistPhones;
      }
      if (!bl.length) {
        const rawBl = localStorage.getItem('blacklistPhones');
        if (rawBl) bl = JSON.parse(rawBl);
      }
      if (Array.isArray(bl)) setBlacklist(bl);
    } catch (_) {}

    // 1. Đọc bộ nhớ cục bộ trước để giao diện hiển thị ngay lập tức
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const localRes = await new Promise(r => chrome.storage.local.get([
          'order_default_settings',
          'default_goods_name',
          'default_weight_vnpost',
          'default_weight_jt',
          'draft_queue_enabled'
        ], r));
        if (localRes?.order_default_settings) {
          loaded = { ...localRes.order_default_settings };
          if (localRes.draft_queue_enabled !== undefined) {
            loaded.showDraftQueue = !!localRes.draft_queue_enabled;
          }
        } else if (localRes?.default_goods_name) {
          loaded = {
            defaultItemName: localRes.default_goods_name,
            defaultWeight: Number(localRes.default_weight_vnpost) || 200,
            defaultWeightKg: Number(localRes.default_weight_jt) || 0.2,
            showDraftQueue: localRes.draft_queue_enabled !== undefined ? !!localRes.draft_queue_enabled : true
          };
        }
      }
      if (!loaded) {
        const raw = localStorage.getItem('order_default_settings');
        if (raw) loaded = JSON.parse(raw);
      }
      const rawQueue = localStorage.getItem('draft_queue_enabled');
      if (rawQueue !== null) {
        if (!loaded) loaded = {};
        loaded.showDraftQueue = (rawQueue === 'true');
      }
    } catch (_) {}

    if (loaded) {
      setSettings(prev => ({ ...prev, ...loaded }));
    }

    // 2. Đồng bộ từ Supabase Cloud theo active_shop_id
    try {
      const config = await (globalThis.SupabaseCloud?.loadConfig?.() || Promise.resolve({ url: '', anonKey: '' }));
      const session = await AuthSession.getSession();
      const shopId = session?.active_shop_id;

      if (config?.url && shopId) {
        const headers = {
          apikey: config.anonKey,
          Authorization: `Bearer ${session.access_token || config.anonKey}`,
          'Content-Type': 'application/json'
        };

        let cloudData = null;
        // Ưu tiên gọi RPC owner_get_shop_order_defaults
        try {
          const rpcRes = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/owner_get_shop_order_defaults`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_shop_id: shopId })
          });
          if (rpcRes.ok) {
            const data = await rpcRes.json();
            if (data?.order_defaults) {
              cloudData = data.order_defaults;
              if (data.shop_name) setActiveShopName(data.shop_name);
            }
          }
        } catch (_) {}

        // Fallback đọc trực tiếp bảng shops
        if (!cloudData) {
          const shopRes = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/shops?id=eq.${shopId}&select=id,name,order_defaults`, { headers });
          if (shopRes.ok) {
            const shopRows = await shopRes.json();
            if (shopRows?.[0]) {
              if (shopRows[0].name) setActiveShopName(shopRows[0].name);
              if (shopRows[0].order_defaults) cloudData = shopRows[0].order_defaults;
            }
          }
        }

        if (cloudData && typeof cloudData === 'object') {
          const merged = {
            ...settings,
            ...(loaded || {}),
            ...cloudData
          };
          setSettings(merged);
          await syncToStorage(merged);
          setCloudSynced(true);
        }
      }
    } catch (err) {
      console.warn('[OrderSettings] Cloud load warning:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    // 1. Lưu cục bộ ngay lập tức
    await syncToStorage(settings);

    // 2. Lưu lên Supabase Cloud
    let savedToCloud = false;
    try {
      const config = await (globalThis.SupabaseCloud?.loadConfig?.() || Promise.resolve({ url: '', anonKey: '' }));
      const session = await AuthSession.getSession();
      const shopId = session?.active_shop_id;

      if (config?.url && shopId) {
        const headers = {
          apikey: config.anonKey,
          Authorization: `Bearer ${session.access_token || config.anonKey}`,
          'Content-Type': 'application/json'
        };

        // Ưu tiên gọi RPC owner_update_shop_order_defaults
        try {
          const rpcRes = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/owner_update_shop_order_defaults`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_shop_id: shopId, p_defaults: settings })
          });
          if (rpcRes.ok) {
            const resJson = await rpcRes.json();
            if (resJson?.success !== false) savedToCloud = true;
          }
        } catch (_) {}

        // Fallback cập nhật bảng shops trực tiếp
        if (!savedToCloud) {
          const patchRes = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/shops?id=eq.${shopId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ order_defaults: settings, updated_at: new Date().toISOString() })
          });
          if (patchRes.ok) savedToCloud = true;
        }
      }
    } catch (err) {
      console.warn('[OrderSettings] Cloud save warning:', err.message);
      setErrorMessage(err.message || 'Lỗi khi lưu lên Cloud.');
    }

    setIsSaving(false);
    setIsSaved(true);
    setCloudSynced(savedToCloud);
    setTimeout(() => setIsSaved(false), 4000);
  };

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--card)',
    color: 'var(--text-main)',
    fontSize: '13.5px',
    outline: 'none',
    transition: 'border-color .15s ease'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="page-title" style={{ margin: 0 }}>Cấu Hình Mặc Định Đơn Hàng</h2>
            {cloudSynced && (
              <span style={{
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                padding: '3px 10px',
                borderRadius: 8,
                fontSize: '11.5px',
                fontWeight: 700,
                border: '1px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Cloud size={13} /> Đồng bộ Cloud {activeShopName ? `(${activeShopName})` : ''}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 13 }}>
            Thiết lập các thông số mặc định để tiện ích tự động điền nhanh chóng lên cổng VNPost và J&T Express.
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={loading}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Đang đồng bộ...' : 'Tải lại từ Cloud'}
        </button>
      </div>

      {isSaved && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'var(--color-success-bg)',
          color: 'var(--color-success-text)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13.5px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="var(--success)" />
          Đã lưu thành công cấu hình mặc định đơn hàng {cloudSynced ? 'lên Cloud toàn shop' : 'vào bộ nhớ'}!
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'var(--color-danger-bg)',
          color: 'var(--color-danger-text)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13.5px',
          fontWeight: 600
        }}>
          <AlertCircle size={18} color="var(--danger)" />
          {errorMessage}
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '20px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Main Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Default Goods & Weights */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={18} color="var(--primary)" /> Giá Trị Hàng Hóa Mặc Định
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: '0 0 18px 0' }}>
              Tự động áp dụng các giá trị này khi đoạn văn bản đơn hàng không chứa thông tin chi tiết hoặc thiếu mã đơn.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Hãng Vận Chuyển Mặc Định
                </label>
                <select
                  value={settings.defaultCarrier}
                  onChange={(e) => setSettings({ ...settings, defaultCarrier: e.target.value })}
                  style={inputStyle}
                >
                  <option value="vnpost">Vietnam Post (VNPost)</option>
                  <option value="jt">J&T Express</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tên Hàng Hóa Mặc Định
                </label>
                <input
                  type="text"
                  value={settings.defaultItemName}
                  onChange={(e) => setSettings({ ...settings, defaultItemName: e.target.value })}
                  placeholder="Ví dụ: Lúa Thuỷ Sinh, Quần Áo..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Trọng Lượng VNPost (gram)
                </label>
                <input
                  type="number"
                  value={settings.defaultWeight}
                  onChange={(e) => setSettings({ ...settings, defaultWeight: Number(e.target.value) })}
                  placeholder="200"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Trọng Lượng J&T (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.defaultWeightKg}
                  onChange={(e) => setSettings({ ...settings, defaultWeightKg: Number(e.target.value) })}
                  placeholder="0.2"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tiền Thu Hộ (COD) Mặc Định (đ)
                </label>
                <input
                  type="number"
                  value={settings.defaultCod}
                  onChange={(e) => setSettings({ ...settings, defaultCod: Number(e.target.value) })}
                  placeholder="0"
                  style={inputStyle}
                />
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Nếu đơn hàng đã chuyển khoản trước, tiền thu hộ sẽ tự động bằng 0đ.
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Workflow Automation Toggles */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="var(--warning)" /> Tự Động Hóa Quy Trình Điền Đơn
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: '0 0 16px 0' }}>
              Cấu hình các bộ kích hoạt thông minh khi nhân viên thao tác trên webapp hoặc cổng hãng vận chuyển.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Option 1 */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: settings.autoParse ? 'var(--primary-light)' : 'var(--bg)',
                cursor: 'pointer',
                transition: 'all .15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={settings.autoParse}
                  onChange={(e) => setSettings({ ...settings, autoParse: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Tự Động Bóc Tách (Auto Parse)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tự động đưa nội dung đơn hàng vào AI phân tích ngay khi sao chép đoạn chat hoặc tin nhắn.
                  </div>
                </div>
              </label>

              {/* Option 2 */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: settings.autoNormalizeAddress ? 'var(--primary-light)' : 'var(--bg)',
                cursor: 'pointer',
                transition: 'all .15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={settings.autoNormalizeAddress}
                  onChange={(e) => setSettings({ ...settings, autoNormalizeAddress: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Tự Động Chuẩn Hóa Địa Chỉ
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Tra cứu Từ điển Địa chỉ để tự động sửa các lỗi chính tả và từ viết tắt địa phương (q1, hn, sg...).
                  </div>
                </div>
              </label>

              {/* Option 3 */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: settings.requireReviewOnLowConfidence ? 'var(--primary-light)' : 'var(--bg)',
                cursor: 'pointer',
                transition: 'all .15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={settings.requireReviewOnLowConfidence}
                  onChange={(e) => setSettings({ ...settings, requireReviewOnLowConfidence: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Tạm Dừng Chờ Nhân Viên Duyệt Khi Độ Tin Cậy Thấp
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Nếu AI chưa chắc chắn 100%, bảng điều khiển sẽ nổi bật ô cần xem lại trước khi tự động ấn gửi đơn.
                  </div>
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: settings.showDraftQueue ? 'var(--primary-light)' : 'var(--bg)',
                cursor: 'pointer',
                transition: 'all .15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={settings.showDraftQueue ?? true}
                  onChange={(e) => setSettings({ ...settings, showDraftQueue: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Hiển Thị Thanh Hàng Đợi Đơn Nháp Trên Panel Tiện Ích
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Cho phép duyệt qua lại các đơn nháp chờ xử lý trực tiếp trên giao diện tạo đơn của VNPost / J&T. Bỏ chọn nếu muốn ẩn hoàn toàn.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Blacklist Management Card */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🚨</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Danh Sách Đen & Cảnh Báo Bom Hàng (Blacklist)
                </h3>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#fee2e2', color: '#b91c1c' }}>
                {blacklist.length} SĐT
              </span>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Khi nhân viên dán thông tin khách có trong danh sách đen, Panel sẽ lập tức hiện biểu ngữ cảnh báo màu đỏ để tránh thất thoát tiền cước vận chuyển.
            </p>

            {/* Add to Blacklist Form */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Số điện thoại..."
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                style={{
                  flex: '1 1 140px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  background: 'var(--bg)'
                }}
              />
              <input
                type="text"
                placeholder="Lý do (VD: Bom hàng, không nghe máy)..."
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                style={{
                  flex: '2 1 200px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '13px',
                  background: 'var(--bg)'
                }}
              />
              <button
                type="button"
                onClick={handleAddBlacklist}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                + Thêm
              </button>
            </div>

            {/* Blacklist Items */}
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {blacklist.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                  Chưa có số điện thoại nào trong danh sách đen của Shop.
                </div>
              ) : (
                blacklist.map((item, idx) => {
                  const phone = typeof item === 'string' ? item : item.phone;
                  const reason = typeof item === 'object' && item.reason ? item.reason : 'Lịch sử bom hàng';
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ color: '#b91c1c', fontFamily: 'monospace', fontSize: '13.5px' }}>{phone}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>— {reason}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlacklist(phone)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                        title="Xóa khỏi danh sách đen"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Button */}
          <div>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '11px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Save size={16} />
              {isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Mặc Định'}
            </button>
          </div>
        </form>

        {/* RIGHT COLUMN: Live Summary & Quick Guides */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Summary Card */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={16} color="var(--primary)" /> Tóm Tắt Cấu Hình Đang Áp Dụng
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Hãng mặc định:</span>
                <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{settings.defaultCarrier}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tên hàng:</span>
                <strong style={{ color: 'var(--text-main)' }}>{settings.defaultItemName || 'Chưa đặt'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Khối lượng VNPost:</span>
                <strong>{settings.defaultWeight}g</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Khối lượng J&T:</span>
                <strong>{settings.defaultWeightKg}kg</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>COD mặc định:</span>
                <strong style={{ color: 'var(--success)' }}>{Number(settings.defaultCod || 0).toLocaleString('vi-VN')}đ</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Bóc tách tự động:</span>
                <span style={{ color: settings.autoParse ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>
                  {settings.autoParse ? '✓ Đang Bật' : '✕ Đang Tắt'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Guide & Shortcuts */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={16} color="var(--primary)" /> Mẹo Sử Dụng Tiện Ích
            </h3>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
              <li>
                <strong>Tên hàng hóa:</strong> Tự động điền nếu không trích xuất được mã đơn hoặc tên sản phẩm từ tin nhắn.
              </li>
              <li>
                <strong>Trọng lượng:</strong> Điền chính xác gram cho VNPost và kg cho J&T Express.
              </li>
              <li>
                <strong>Đồng bộ Cloud:</strong> Mọi máy trạm và nhân viên trong Shop sẽ tự động dùng chung cấu hình này.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
