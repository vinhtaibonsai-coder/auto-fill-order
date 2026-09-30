import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Key, CreditCard, PlusCircle, RefreshCw, Copy, Check, 
  HelpCircle, AlertCircle, CheckCircle2, Clock, Sparkles, Send, 
  ShieldCheck, Ban, Zap, Search, Filter, Layers, ShoppingBag
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function LicenseKeys() {
  const [activeSubTab, setActiveSubTab] = useState('keys'); // 'keys' | 'transactions' | 'webhook-guide'
  const [keys, setKeys] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState(null);

  // Filters & Search
  const [searchKey, setSearchKey] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal Sinh Mã
  const [showGenModal, setShowGenModal] = useState(false);
  const [genType, setGenType] = useState('PLAN'); // 'PLAN' | 'DAYS' | 'AI_QUOTA'
  const [genPlanCode, setGenPlanCode] = useState('PRO_MONTH'); // 'PRO_MONTH' | 'PRO_YEAR' | 'ENTERPRISE'
  const [genValue, setGenValue] = useState(30);
  const [genCount, setGenCount] = useState(1);
  const [genNotes, setGenNotes] = useState('');
  const [genExpiresDays, setGenExpiresDays] = useState(90);
  const [genResult, setGenResult] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Modal Kích Hoạt Cho Shop (1-Click Activate)
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateKey, setActivateKey] = useState('');
  const [activateShopId, setActivateShopId] = useState('');
  const [shopsList, setShopsList] = useState([]);
  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState(null);

  // Test SePay Webhook
  const [testShopCode, setTestShopCode] = useState('');
  const [testAmount, setTestAmount] = useState(50000);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testWebhookResult, setTestWebhookResult] = useState(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    const res = await AdminService.getLicenseKeys({ limit: 200 });
    if (res.success) {
      setKeys(res.data || []);
    }
    setLoading(false);
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const res = await AdminService.getPaymentTransactions({ limit: 50 });
    if (res.success) {
      setTransactions(res.data || []);
    }
    setLoading(false);
  }, []);

  const loadShops = useCallback(async () => {
    try {
      const res = await AdminService.getShopsList();
      if (res.success) {
        setShopsList(res.data || []);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (activeSubTab === 'keys') {
      loadKeys();
      loadShops();
    } else if (activeSubTab === 'transactions') {
      loadTransactions();
    }
  }, [activeSubTab, loadKeys, loadTransactions, loadShops]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(num) || 0);
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return isoStr;
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = keys.length;
    const unused = keys.filter(k => k.status === 'UNUSED').length;
    const used = keys.filter(k => k.status === 'USED').length;
    const revoked = keys.filter(k => k.status === 'REVOKED' || k.status === 'EXPIRED').length;
    return { total, unused, used, revoked };
  }, [keys]);

  // Filtered keys
  const filteredKeys = useMemo(() => {
    return keys.filter(k => {
      const matchSearch = !searchKey || 
        (k.code && k.code.toLowerCase().includes(searchKey.toLowerCase())) ||
        (k.notes && k.notes.toLowerCase().includes(searchKey.toLowerCase())) ||
        (k.shops?.name && k.shops.name.toLowerCase().includes(searchKey.toLowerCase())) ||
        (k.shops?.shop_code && k.shops.shop_code.toLowerCase().includes(searchKey.toLowerCase()));

      const matchType = filterType === 'ALL' || (k.key_type || k.type) === filterType;
      const matchStatus = filterStatus === 'ALL' || k.status === filterStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [keys, searchKey, filterType, filterStatus]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await AdminService.generateLicenseKeys({
        type: genType,
        planCode: genPlanCode,
        value: genType === 'PLAN' ? (genPlanCode === 'PRO_YEAR' || genPlanCode === 'ENTERPRISE' ? 365 : 30) : genValue,
        count: genCount,
        notes: genNotes,
        expiresDays: genExpiresDays
      });
      if (res.success) {
        setGenResult(res.data?.keys || res.data || []);
        loadKeys();
      } else {
        alert('Lỗi tạo mã: ' + (res.error || 'Thao tác không thành công'));
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenActivate = (keyRecord) => {
    setActivateKey(keyRecord ? keyRecord.code : '');
    setActivateShopId(shopsList[0]?.id || '');
    setActivateResult(null);
    setShowActivateModal(true);
  };

  const handleExecuteActivate = async (e) => {
    e.preventDefault();
    if (!activateKey || !activateShopId) {
      alert('Vui lòng chọn Shop và nhập Mã kích hoạt.');
      return;
    }
    setActivating(true);
    setActivateResult(null);
    try {
      const res = await AdminService.activateLicenseKeyForShop(activateShopId, activateKey);
      if (res.success) {
        setActivateResult({ success: true, message: res.data?.message || 'Kích hoạt thành công cho cửa hàng!' });
        loadKeys();
      } else {
        setActivateResult({ success: false, message: res.error || 'Kích hoạt không thành công.' });
      }
    } catch (err) {
      setActivateResult({ success: false, message: err.message });
    } finally {
      setActivating(false);
    }
  };

  const handleRevokeKey = async (keyRecord) => {
    const reason = window.prompt(`Xác nhận thu hồi mã ${keyRecord.code}?\nNhập lý do thu hồi:`, 'Khách hủy đơn / đổi mã');
    if (reason === null) return;

    try {
      const res = await AdminService.revokeLicenseKey(keyRecord.id, reason);
      if (res.success) {
        alert(`Đã thu hồi mã ${keyRecord.code} thành công.`);
        loadKeys();
      } else {
        alert(`Thu hồi thất bại: ${res.error}`);
      }
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const dryRunPaymentWebhook = async ({ shopCode, amount }) => {
    const normalizedAmount = Number(amount);
    if (!shopCode?.trim()) return { success: false, error: 'Thiếu mã Shop.' };
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return { success: false, error: 'Số tiền không hợp lệ.' };
    const days = normalizedAmount >= 500000 ? 365
      : normalizedAmount >= 250000 ? 180
        : normalizedAmount >= 120000 ? 90
          : normalizedAmount >= 50000 ? 30
            : Math.floor(normalizedAmount / 1666);
    return { success: true, shopCode: shopCode.trim().toUpperCase(), amount: normalizedAmount, days };
  };

  const handleTestSimulatedPayment = async () => {
    if (!testShopCode) {
      alert('Vui lòng nhập Mã Shop để kiểm tra (ví dụ SHOP01)');
      return;
    }
    setTestingWebhook(true);
    setTestWebhookResult(null);
    try {
      const res = await dryRunPaymentWebhook({ shopCode: testShopCode, amount: testAmount });

      if (res.success) {
        setTestWebhookResult({ success: true, message: `Dry-run hợp lệ: ${res.shopCode} sẽ được cộng ${res.days} ngày. Không ghi database.` });
      } else {
        setTestWebhookResult({ success: false, message: 'Webhook thất bại: ' + (res.error || 'Lỗi không xác định') });
      }
    } catch (e) {
      setTestWebhookResult({ success: false, message: e.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={22} color="#2563eb" />
            Quản Lý Bản Quyền & Kích Hoạt (License Keys & Billing)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Sinh mã kích hoạt bản quyền 16 ký tự, 1-Click kích hoạt cho khách hàng và tự động hóa qua SePay Webhook.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleOpenActivate(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#047857',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <Zap size={15} /> Kích Hoạt Cho Shop
          </button>

          <button
            onClick={() => { setShowGenModal(true); setGenResult(null); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#ffffff',
              background: '#2563eb',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
          >
            <PlusCircle size={15} /> Sinh Mã Bản Quyền
          </button>

          <button
            onClick={activeSubTab === 'keys' ? loadKeys : loadTransactions}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#1e293b',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards Overview */}
      {activeSubTab === 'keys' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', display: 'grid', placeItems: 'center', color: '#2563eb' }}>
              <Key size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TỔNG MÃ ĐÃ SINH</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{kpis.total}</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#ecfdf5', display: 'grid', placeItems: 'center', color: '#059669' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TỒN KHO (CHƯA DÙNG)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{kpis.unused}</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f9ff', display: 'grid', placeItems: 'center', color: '#0284c7' }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ĐÃ KÍCH HOẠT</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7' }}>{kpis.used}</div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fef2f2', display: 'grid', placeItems: 'center', color: '#dc2626' }}>
              <Ban size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>THU HỒI / HẾT HẠN</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{kpis.revoked}</div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveSubTab('keys')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: activeSubTab === 'keys' ? '#eff6ff' : 'transparent',
            color: activeSubTab === 'keys' ? '#1d4ed8' : '#64748b',
            cursor: 'pointer'
          }}
        >
          <Key size={16} /> Danh Sách Mã Kích Hoạt ({keys.length})
        </button>

        <button
          onClick={() => setActiveSubTab('transactions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: activeSubTab === 'transactions' ? '#eff6ff' : 'transparent',
            color: activeSubTab === 'transactions' ? '#1d4ed8' : '#64748b',
            cursor: 'pointer'
          }}
        >
          <CreditCard size={16} /> Biến Động Số Dư SePay ({transactions.length})
        </button>

        <button
          onClick={() => setActiveSubTab('webhook-guide')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: activeSubTab === 'webhook-guide' ? '#eff6ff' : 'transparent',
            color: activeSubTab === 'webhook-guide' ? '#1d4ed8' : '#64748b',
            cursor: 'pointer'
          }}
        >
          <HelpCircle size={16} /> Hướng Dẫn Tích Hợp Webhook
        </button>
      </div>

      {/* TAB 1: KEYS */}
      {activeSubTab === 'keys' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Filter Bar */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220, background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Tìm mã, ghi chú hoặc tên shop..."
                value={searchKey}
                onChange={e => setSearchKey(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Loại:</span>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5 }}
              >
                <option value="ALL">Tất cả loại</option>
                <option value="PLAN">Gói Cước (PLAN)</option>
                <option value="DAYS">Ngày Dùng (DAYS)</option>
                <option value="AI_QUOTA">Lượt AI (AI_QUOTA)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Trạng thái:</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5 }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="UNUSED">Chưa dùng (Khả dụng)</option>
                <option value="USED">Đã kích hoạt</option>
                <option value="REVOKED">Đã thu hồi</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                    <th style={{ padding: '12px 16px' }}>Mã Kích Hoạt</th>
                    <th style={{ padding: '12px 16px' }}>Quyền Lợi & Gói</th>
                    <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                    <th style={{ padding: '12px 16px' }}>Shop Sử Dụng</th>
                    <th style={{ padding: '12px 16px' }}>Ghi Chú</th>
                    <th style={{ padding: '12px 16px' }}>Hạn Kích Hoạt</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={18} className="spin" style={{ display: 'inline', marginRight: 8 }} /> Đang tải danh sách mã...
                      </td>
                    </tr>
                  ) : filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                        <Key size={36} style={{ opacity: 0.5, margin: '0 auto 8px', display: 'block' }} />
                        Không tìm thấy mã kích hoạt nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map(k => {
                      const isUnused = k.status === 'UNUSED';
                      const isUsed = k.status === 'USED';
                      const isRevoked = k.status === 'REVOKED';
                      const keyType = k.key_type || k.type || 'DAYS';

                      return (
                        <tr key={k.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                                {k.code}
                              </span>
                              <button
                                onClick={() => copyToClipboard(k.code, k.id)}
                                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#64748b' }}
                                title="Copy mã"
                              >
                                {copiedText === k.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {keyType === 'PLAN' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe'
                              }}>
                                <Layers size={12} />
                                Gói {k.plan_code || 'PRO'} (+{k.duration_days || k.value} ngày)
                              </span>
                            ) : keyType === 'DAYS' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: '#f0fdf4',
                                color: '#166534'
                              }}>
                                <Clock size={12} />
                                +{k.value} Ngày
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                                background: '#fdf4ff',
                                color: '#86198f'
                              }}>
                                <Sparkles size={12} />
                                +{k.value} Lượt AI
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 700,
                              background: isUnused ? '#dcfce7' : isUsed ? '#f1f5f9' : '#fee2e2',
                              color: isUnused ? '#15803d' : isUsed ? '#475569' : '#b91c1c'
                            }}>
                              {isUnused ? 'Chưa dùng' : isUsed ? 'Đã kích hoạt' : isRevoked ? 'Đã thu hồi' : 'Hết hạn'}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {k.shops ? (
                              <div>
                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{k.shops.name}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(k.used_at || k.redeemed_at)}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>-</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', color: '#475569', fontSize: 12 }}>
                            {k.notes || '-'}
                          </td>

                          <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                            {k.expires_at ? formatDate(k.expires_at) : 'Vĩnh viễn'}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {isUnused && (
                                <>
                                  <button
                                    onClick={() => handleOpenActivate(k)}
                                    title="Kích hoạt trực tiếp cho một Shop"
                                    style={{
                                      padding: '4px 8px',
                                      background: '#ecfdf5',
                                      color: '#047857',
                                      border: '1px solid #a7f3d0',
                                      borderRadius: 6,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}
                                  >
                                    <Zap size={12} /> Kích hoạt
                                  </button>

                                  <button
                                    onClick={() => handleRevokeKey(k)}
                                    title="Thu hồi mã bản quyền này"
                                    style={{
                                      padding: '4px 8px',
                                      background: '#fef2f2',
                                      color: '#dc2626',
                                      border: '1px solid #fecaca',
                                      borderRadius: 6,
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}
                                  >
                                    <Ban size={12} /> Thu hồi
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRANSACTIONS */}
      {activeSubTab === 'transactions' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Mã GD / Ngân hàng</th>
                  <th style={{ padding: '12px 16px' }}>Nội dung chuyển</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ padding: '12px 16px' }}>Shop được cộng</th>
                  <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                  <th style={{ padding: '12px 16px' }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw size={18} className="spin" style={{ display: 'inline', marginRight: 8 }} /> Đang tải giao dịch...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                      <CreditCard size={36} style={{ opacity: 0.5, margin: '0 auto 8px', display: 'block' }} />
                      Chưa có giao dịch biến động số dư nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.reference_code || t.transaction_id}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{t.gateway || 'Bank Transfer'}</div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                          {t.content}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        +{formatVND(t.amount)}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {t.shops ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{t.shops.name}</div>
                            {t.shops.shop_code && <div style={{ fontSize: 11, color: '#64748b' }}>#{t.shops.shop_code}</div>}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Không khớp Shop</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          background: t.status === 'PROCESSED' ? '#dcfce7' : t.status === 'IGNORED' ? '#fef3c7' : '#fee2e2',
                          color: t.status === 'PROCESSED' ? '#15803d' : t.status === 'IGNORED' ? '#b45309' : '#b91c1c'
                        }}>
                          {t.status === 'PROCESSED' ? 'Thành công' : t.status === 'IGNORED' ? 'Bỏ qua (Sai cú pháp)' : 'Lỗi'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                        {formatDate(t.transaction_date || t.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WEBHOOK GUIDE & TEST */}
      {activeSubTab === 'webhook-guide' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Card Hướng Dẫn */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={18} color="#2563eb" /> Hướng Dẫn Cấu Hình Tự Động Hóa SePay
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              Hệ thống hỗ trợ cơ chế nhận Webhook tức thời từ <strong>SePay.vn</strong>. Khi khách chuyển khoản vào tài khoản ngân hàng của bạn với cú pháp:
              <br />
              <strong style={{ color: '#2563eb', fontSize: 14 }}>AF &lt;MÃ_SHOP&gt;</strong> (ví dụ: <code style={{ background: '#eff6ff', padding: '2px 6px', borderRadius: 4 }}>AF SHOP01</code>)
              <br />
              Hệ thống sẽ ngay lập tức đối soát và tự động gia hạn thời gian sử dụng cho Shop đó mà không cần can thiệp thủ công.
            </p>

            {/* Bảng Quy Đổi */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 8, fontSize: 13 }}>Quy tắc tự động cộng ngày theo số tiền chuyển:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 13 }}>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>50.000đ</strong> → <span style={{ color: '#16a34a', fontWeight: 700 }}>+30 ngày</span> (Gói 1 tháng)
                </div>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>120.000đ</strong> → <span style={{ color: '#16a34a', fontWeight: 700 }}>+90 ngày</span> (Gói 3 tháng)
                </div>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>250.000đ</strong> → <span style={{ color: '#16a34a', fontWeight: 700 }}>+180 ngày</span> (Gói 6 tháng)
                </div>
                <div style={{ background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <strong>500.000đ</strong> → <span style={{ color: '#16a34a', fontWeight: 700 }}>+365 ngày</span> (Gói 1 năm)
                </div>
              </div>
            </div>
          </div>

          {/* Test Sandbox Webhook */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={18} color="#2563eb" /> Mô Phỏng Gửi Webhook Thanh Toán (Sandbox Test)
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
              Kiểm tra cơ chế tự động gia hạn ngày dùng cho một Shop bằng cách gửi payload mô phỏng SePay:
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Mã Shop (Shop Code):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: SHOP01"
                  value={testShopCode}
                  onChange={e => setTestShopCode(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Số tiền chuyển (VND):</label>
                <select
                  value={testAmount}
                  onChange={e => setTestAmount(Number(e.target.value))}
                  style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                >
                  <option value={50000}>50.000đ (+30 ngày)</option>
                  <option value={120000}>120.000đ (+90 ngày)</option>
                  <option value={250000}>250.000đ (+180 ngày)</option>
                  <option value={500000}>500.000đ (+365 ngày)</option>
                </select>
              </div>

              <button
                onClick={handleTestSimulatedPayment}
                disabled={testingWebhook}
                style={{
                  padding: '8px 16px',
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {testingWebhook ? <RefreshCw size={14} className="spin" /> : <Send size={14} />} Gửi Test Webhook
              </button>
            </div>

            {testWebhookResult && (
              <div style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 13,
                background: testWebhookResult.success ? '#f0fdf4' : '#fef2f2',
                color: testWebhookResult.success ? '#15803d' : '#b91c1c',
                border: `1px solid ${testWebhookResult.success ? '#bbf7d0' : '#fecaca'}`
              }}>
                {testWebhookResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Sinh Mã Bản Quyền */}
      {showGenModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 540,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={18} color="#2563eb" /> Sinh Mã Bản Quyền Thương Mại (16 Ký Tự)
              </h3>
              <button onClick={() => setShowGenModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleGenerate} style={{ padding: 20, display: 'grid', gap: 14 }}>
              {/* Chọn loại mã */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Loại mã kích hoạt:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setGenType('PLAN'); }}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: `2px solid ${genType === 'PLAN' ? '#2563eb' : '#e2e8f0'}`,
                      background: genType === 'PLAN' ? '#eff6ff' : '#ffffff',
                      color: genType === 'PLAN' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer'
                    }}
                  >
                    Gói Cước (Plan)
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGenType('DAYS'); setGenValue(30); }}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: `2px solid ${genType === 'DAYS' ? '#2563eb' : '#e2e8f0'}`,
                      background: genType === 'DAYS' ? '#eff6ff' : '#ffffff',
                      color: genType === 'DAYS' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer'
                    }}
                  >
                    Ngày Dùng (Days)
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGenType('AI_QUOTA'); setGenValue(100); }}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      border: `2px solid ${genType === 'AI_QUOTA' ? '#2563eb' : '#e2e8f0'}`,
                      background: genType === 'AI_QUOTA' ? '#eff6ff' : '#ffffff',
                      color: genType === 'AI_QUOTA' ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer'
                    }}
                  >
                    Lượt AI (Quota)
                  </button>
                </div>
              </div>

              {/* Nếu chọn PLAN: cho chọn gói */}
              {genType === 'PLAN' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Gói cước áp dụng:
                  </label>
                  <select
                    value={genPlanCode}
                    onChange={e => setGenPlanCode(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontWeight: 600 }}
                  >
                    <option value="PRO_MONTH">Gói Pro 1 Tháng (5 máy, 5 user, 2.500 AI) - 30 ngày</option>
                    <option value="PRO_YEAR">Gói Pro 1 Năm (15 máy, 15 user, 50.000 AI) - 365 ngày</option>
                    <option value="ENTERPRISE">Gói Doanh Nghiệp (Không giới hạn máy & user, 100.000 AI) - 365 ngày</option>
                  </select>
                </div>
              )}

              {/* Giá trị & Số lượng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {genType !== 'PLAN' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Giá trị ({genType === 'DAYS' ? 'Số ngày' : 'Số lượt AI'}):
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={genValue}
                      onChange={e => setGenValue(Number(e.target.value))}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Thời hạn tự động:
                    </label>
                    <input
                      type="text"
                      disabled
                      value={genPlanCode === 'PRO_YEAR' || genPlanCode === 'ENTERPRISE' ? '365 ngày (1 năm)' : '30 ngày (1 tháng)'}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 6, boxSizing: 'border-box', color: '#64748b' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Số lượng mã cần sinh:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Hạn kích hoạt & Ghi chú */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Thời hạn trước khi mã hết hạn (Số ngày):
                </label>
                <input
                  type="number"
                  min="1"
                  value={genExpiresDays}
                  onChange={e => setGenExpiresDays(Number(e.target.value))}
                  placeholder="Để trống nếu không giới hạn"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Ghi chú / Chiến dịch B2B:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đại lý Hà Nội - Lô 20 key"
                  value={genNotes}
                  onChange={e => setGenNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' }}
                />
              </div>

              {/* Danh sách mã vừa sinh */}
              {genResult && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: '#166534', fontSize: 13 }}>Đã sinh thành công {genResult.length} mã:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(genResult.map(r => r.code).join('\n'), 'batch_keys')}
                      style={{ background: '#ffffff', border: '1px solid #86efac', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                    >
                      {copiedText === 'batch_keys' ? 'Đã copy tất cả!' : 'Copy tất cả mã'}
                    </button>
                  </div>
                  <div style={{ maxHeight: 120, overflowY: 'auto', display: 'grid', gap: 4, fontFamily: 'monospace', fontSize: 12 }}>
                    {genResult.map((item, idx) => (
                      <div key={idx} style={{ background: '#ffffff', padding: '4px 8px', borderRadius: 4, border: '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.code}</span>
                        <span style={{ color: '#15803d', fontWeight: 600 }}>
                          {item.key_type === 'PLAN' ? `Gói ${item.plan_code}` : `+${item.value} ${item.key_type === 'DAYS' ? 'Ngày' : 'Lượt AI'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  style={{ padding: '8px 18px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  {generating ? 'Đang tạo...' : 'Tạo Mã Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Kích Hoạt Bản Quyền Cho Shop (1-Click Activate) */}
      {showActivateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={18} color="#059669" /> Kích Hoạt Bản Quyền Cho Cửa Hàng
              </h3>
              <button onClick={() => setShowActivateModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={handleExecuteActivate} style={{ padding: 20, display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Chọn Cửa Hàng Cần Kích Hoạt:
                </label>
                <select
                  value={activateShopId}
                  onChange={e => setActivateShopId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontSize: 13 }}
                >
                  {shopsList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.shop_code ? `(#${s.shop_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Mã Bản Quyền Cần Kích Hoạt:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: AF-XXXX-YYYY-ZZZZ"
                  value={activateKey}
                  onChange={e => setActivateKey(e.target.value.toUpperCase())}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 14, fontWeight: 700 }}
                />
              </div>

              {activateResult && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  background: activateResult.success ? '#f0fdf4' : '#fef2f2',
                  color: activateResult.success ? '#15803d' : '#b91c1c',
                  border: `1px solid ${activateResult.success ? '#bbf7d0' : '#fecaca'}`
                }}>
                  {activateResult.message}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={activating}
                  style={{
                    padding: '8px 18px',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {activating ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />} Kích Hoạt Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
