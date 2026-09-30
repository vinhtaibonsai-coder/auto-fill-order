import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Users, Smartphone, Bot, CreditCard, Package, Shield, 
  Copy, Check, RefreshCw, Plus, Trash2, Eye, EyeOff, AlertTriangle, 
  CheckCircle2, XCircle, ArrowRight, UserPlus, DollarSign, Zap,
  ExternalLink, Key, Lock, Unlock, Settings, MessageSquare
} from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminService } from '../../../domain/admin/admin.service.js';
import { RealtimeService } from '../../../domain/realtime/realtime.service.esm.js';

// Tuân thủ Nghị định 13/2023/NĐ-CP: Che PII (SĐT, Họ tên, Địa chỉ chi tiết) cho tài khoản Admin
const maskPhone = (phone) => {
  if (!phone) return '—';
  const clean = String(phone).trim().replace(/\s+/g, '');
  if (clean.length < 7) return clean.slice(0, 2) + '***' + clean.slice(-2);
  return clean.slice(0, 4) + '***' + clean.slice(-3); // ví dụ: 0961***485
};

const maskCustomerName = (name) => {
  if (!name) return 'Khách mua hàng';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const w = parts[0];
    return w.length > 2 ? w.slice(0, 1) + '***' + w.slice(-1) : w + '*';
  }
  const last = parts[parts.length - 1];
  const mid = parts.slice(1, -1).map(p => p[0] + '.').join(' ');
  const maskedLast = last.length > 1 ? last.slice(0, 1) + '*'.repeat(Math.min(3, last.length - 1)) : last + '*';
  return [parts[0], mid, maskedLast].filter(Boolean).join(' ');
};

const extractDestinationProvince = (address) => {
  if (!address) return '—';
  const parts = String(address).split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(', ');
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return '—';
};

const getCarrierInfo = (trackingCode, order) => {
  const code = String(trackingCode || order?.order_code || '').trim().toUpperCase();
  const carrier = String(order?.platform || order?.carrier || order?.carrier_code || '').toUpperCase();
  
  if (carrier.includes('VNPOST') || code.endsWith('VN') || /^[ECRP][A-Z0-9]{8,11}VN$/.test(code)) {
    return { name: 'VNPost', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
  }
  if (carrier.includes('JT') || carrier.includes('J&T') || /^\d{12}$/.test(code) || code.startsWith('84')) {
    return { name: 'J&T Express', bg: '#fee2e2', color: '#dc2626', border: '#fecaca' };
  }
  if (carrier.includes('VIETTEL') || code.startsWith('VT')) {
    return { name: 'ViettelPost', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  }
  if (carrier.includes('GHTK')) {
    return { name: 'GHTK', bg: '#f0fdf4', color: '#15803d', border: '#86efac' };
  }
  return { name: carrier || 'Bưu cục', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
};

export default function Shop360Modal({ open, shop, onClose, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'members' | 'devices' | 'quota_wallet' | 'ai_rules' | 'orders'
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data states
  const [members, setMembers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [featureFlags, setFeatureFlags] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [aiQuota, setAiQuota] = useState({ limit: 500, used: 0 });
  const [onlinePresenceMap, setOnlinePresenceMap] = useState({});

  // Lắng nghe hiện diện trực tuyến (Presence) qua Realtime WebSocket (0s độ trễ)
  useEffect(() => {
    if (!open || !shop?.id) return;
    let unsub = null;
    let cancelled = false;

    (async () => {
      try {
        unsub = await RealtimeService.subscribeWorkstationPresence(shop.id, (map) => {
          if (!cancelled) setOnlinePresenceMap(map || {});
        });
      } catch (err) {
        console.warn('[Shop360Modal] Presence error:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (typeof unsub === 'function') {
        try { unsub(); } catch (_) {}
      }
    };
  }, [open, shop?.id]);

  const getDeviceOnlineInfo = useCallback((d) => {
    if (d.revoked) {
      return {
        status: 'revoked',
        text: 'Đã Thu Hồi',
        label: 'Khóa Quyền',
        color: '#991b1b',
        bg: '#fee2e2',
        border: '#fecaca',
        diffMins: Infinity,
        timeAgo: d.last_seen ? new Date(d.last_seen).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Đã khóa'
      };
    }

    const devId = d.device_id || d.id;
    const livePresence = onlinePresenceMap[devId] || (d.id && onlinePresenceMap[d.id]) || (d.device_id && onlinePresenceMap[d.device_id]);
    if (livePresence) {
      return {
        status: 'online',
        text: 'Trực tuyến Realtime',
        label: '🟢 Trực tuyến Realtime',
        color: '#166534',
        bg: '#dcfce7',
        border: '#86efac',
        diffMins: 0,
        timeAgo: '🟢 Đang kết nối WebSocket (0s)',
        isRealtime: true
      };
    }

    const lastDate = d.last_seen || d.last_active_at || d.last_order_at;
    if (!lastDate) {
      return {
        status: 'offline',
        text: 'Chưa kết nối',
        label: 'Chưa Từng Kết Nối',
        color: '#475569',
        bg: '#f8fafc',
        border: '#e2e8f0',
        diffMins: Infinity,
        timeAgo: 'Chưa có dữ liệu'
      };
    }

    const diffMins = Math.floor((Date.now() - new Date(lastDate).getTime()) / 60000);
    const timeAgoFormatted = new Date(lastDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

    if (diffMins <= 5) {
      return {
        status: 'online',
        text: 'Đang online',
        label: '● Đang online',
        color: '#166534',
        bg: '#dcfce7',
        border: '#86efac',
        diffMins,
        timeAgo: diffMins === 0 ? 'Vừa xong' : `${diffMins}p trước`
      };
    } else if (diffMins <= 60) {
      return {
        status: 'recent',
        text: `${diffMins}p trước`,
        label: `● ${diffMins}p trước`,
        color: '#854d0e',
        bg: '#fef9c3',
        border: '#fde68a',
        diffMins,
        timeAgo: timeAgoFormatted
      };
    } else {
      return {
        status: 'offline',
        text: 'Offline',
        label: '● Offline',
        color: '#475569',
        bg: '#f1f5f9',
        border: '#e2e8f0',
        diffMins,
        timeAgo: timeAgoFormatted
      };
    }
  }, [onlinePresenceMap]);

  // Sub-actions states
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMode, setAddMode] = useState('existing'); // 'existing' | 'new'
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newMemberForm, setNewMemberForm] = useState({ email: '', fullName: '', password: '', roleCode: 'STAFF' });
  const [memberRole, setMemberRole] = useState('STAFF');
  const [topupAmount, setTopupAmount] = useState(500);
  const [creditAmount, setCreditAmount] = useState(200000);
  const [customPrompt, setCustomPrompt] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);

  const loadShopDetails = useCallback(async () => {
    if (!shop?.id) return;
    setLoading(true);
    setError('');
    try {
      // 1. Lấy tất cả user trước để enrich thông tin profile cho members
      const usersRes = await AdminService.getAllUsers();
      const usersList = usersRes.success ? (usersRes.data || []) : [];
      setAllUsers(usersList);
      const userMap = new Map(usersList.map(u => [u.id, u]));

      // 2. Tải danh sách thành viên
      let enrichedMembers = [];
      const membersRes = await AdminService.getShopMembers(shop.id);
      if (membersRes.success) {
        enrichedMembers = (membersRes.data || []).map(m => {
          const uId = m.user_id || m.id;
          const matched = userMap.get(uId) || {};
          const email = m.profiles?.email || m.email || matched.email || (uId === shop.owner_id ? shop.owner_email : '') || '';
          const fullName = m.profiles?.full_name || m.full_name || matched.full_name || (email ? email.split('@')[0] : 'Nhân viên');
          return {
            ...m,
            user_id: uId,
            email: email,
            full_name: fullName,
            profiles: {
              ...(m.profiles || {}),
              email: email,
              full_name: fullName
            }
          };
        });
        setMembers(enrichedMembers);
      }

      // 3. Tải thiết bị và liên kết chính xác với Shop qua Shop ID, Shop Name hoặc Thành viên
      const devicesRes = await AdminService.listDevices();
      if (devicesRes.success) {
        const memberUserIds = new Set((enrichedMembers || []).map(m => m.user_id));
        if (shop.owner_id) memberUserIds.add(shop.owner_id);

        const shopDevs = (devicesRes.data || []).filter(d => {
          return d.shop_id === shop.id 
            || (d.shop_name && d.shop_name === shop.name)
            || (d.user_id && memberUserIds.has(d.user_id))
            || (d.email && (d.email === shop.owner_email || enrichedMembers.some(m => m.email === d.email)));
        });
        setDevices(shopDevs);
      }

      // 4. Tải Feature Flags & AI Rules
      const flagsRes = await AdminService.getShopFeatureFlags(shop.id);
      if (flagsRes.success && flagsRes.data) {
        setFeatureFlags(flagsRes.data);
        setCustomPrompt(flagsRes.data.custom_prompt_rules || '');
      }

      // 5. Thống kê Quota, Lượt dùng AI & Đơn hàng qua AdminService.getShop360Data
      const shop360Res = await AdminService.getShop360Data(shop.id);
      if (shop360Res?.success && shop360Res.data) {
        const d = shop360Res.data;
        setAiQuota({
          limit: Number(d.ai_quota_limit || shop.ai_quota_limit || shop.daily_ai_limit || 500),
          used: Number(d.ai_quota_used_today || 0)
        });
        setWalletBalance(Number(d.wallet_balance ?? shop.wallet_balance ?? shop.balance ?? 0));
        if (Array.isArray(d.recent_orders)) {
          setRecentOrders(d.recent_orders);
        }
      } else {
        setAiQuota({
          limit: Number(shop.ai_quota_limit || shop.daily_ai_limit || 500),
          used: Number(shop.ai_used_today || shop.ai_quota_used || 0)
        });
        setWalletBalance(Number(shop.wallet_balance || shop.balance || 0));
      }
    } catch (err) {
      console.warn('Load shop details error:', err);
    } finally {
      setLoading(false);
    }
  }, [shop?.id, shop]);

  useEffect(() => {
    if (open && shop) {
      setActiveTab('overview');
      loadShopDetails();
    }
  }, [open, shop, loadShopDetails]);

  if (!open || !shop) return null;

  const copyId = () => {
    navigator.clipboard.writeText(shop.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImpersonate = () => {
    AdminService.startImpersonation(shop.id, shop.name, 'Admin hỗ trợ trực tiếp từ Trung tâm 360');
    window.location.reload();
  };

  const handleToggleStatus = async () => {
    const isAct = String(shop.status).toLowerCase() === 'active';
    const next = isAct ? 'Suspended' : 'Active';
    if (!confirm(`Bạn có chắc chắn muốn ${isAct ? 'TẠM KHÓA' : 'KÍCH HOẠT'} Shop "${shop.name}"?`)) return;
    const r = await AdminService.updateShopStatus(shop.id, shop.status, next);
    if (r.success) {
      setSuccessMsg(`Đã chuyển trạng thái Shop sang ${next}.`);
      onRefresh?.();
      loadShopDetails();
    } else {
      setError(r.error || 'Lỗi khi cập nhật trạng thái.');
    }
  };

  const handleAddExistingMember = async () => {
    if (!selectedUserId) {
      setError('Vui lòng chọn một người dùng.');
      return;
    }
    const r = await AdminService.assignUserShop(selectedUserId, shop.id, memberRole);
    if (r.success) {
      setSuccessMsg('Đã thêm nhân viên vào Shop thành công!');
      setShowAddMember(false);
      setSelectedUserId('');
      loadShopDetails();
      onRefresh?.();
    } else {
      setError(r.error || 'Lỗi khi thêm nhân viên.');
    }
  };

  const handleCreateNewMember = async () => {
    if (!newMemberForm.email || !newMemberForm.fullName) {
      setError('Vui lòng nhập đầy đủ Email và Họ tên.');
      return;
    }
    const r = await AdminService.createAndAddShopMember(shop.id, newMemberForm);
    if (r.success) {
      setSuccessMsg(`Đã tạo tài khoản và thêm ${newMemberForm.email} vào Shop!`);
      setShowAddMember(false);
      setNewMemberForm({ email: '', fullName: '', password: '', roleCode: 'STAFF' });
      loadShopDetails();
      onRefresh?.();
    } else {
      setError(r.error || 'Lỗi khi cấp tài khoản nhân viên.');
    }
  };

  const handleRemoveMember = async (userId, userEmail) => {
    if (!confirm(`Xóa nhân viên "${userEmail}" khỏi Shop "${shop.name}"?`)) return;
    const r = await AdminService.removeShopMember(shop.id, userId);
    if (r.success) {
      setSuccessMsg('Đã xóa nhân viên khỏi Shop.');
      loadShopDetails();
      onRefresh?.();
    } else {
      setError(r.error || 'Lỗi khi xóa nhân viên.');
    }
  };

  const handleRevokeDevice = async (device) => {
    const act = device.revoked ? 'Khôi phục' : 'Thu hồi';
    if (!confirm(`Bạn có chắc muốn ${act} quyền truy cập của thiết bị "${device.device_name || device.device_id}"?`)) return;
    const r = await AdminService.revokeDevice(device.device_id, !device.revoked);
    if (r.success) {
      setSuccessMsg(`Đã ${act.toLowerCase()} thiết bị thành công.`);
      loadShopDetails();
    } else {
      setError(r.error || 'Lỗi thao tác thiết bị.');
    }
  };

  const handleRevokeAllDevices = async () => {
    if (!confirm('⚠️ CẢNH BÁO: Thu hồi TẤT CẢ các thiết bị đang kết nối vào Shop này? Tất cả phiên Extension sẽ bị đăng xuất.')) return;
    const r = await AdminService.revokeShopDevices(shop.id);
    if (r.success) {
      setSuccessMsg('Đã thu hồi tất cả thiết bị của Shop.');
      loadShopDetails();
    } else {
      setError(r.error || 'Lỗi thu hồi thiết bị.');
    }
  };

  const handleTopupQuota = async () => {
    const r = await AdminService.topupQuota(shop.id, Number(topupAmount));
    if (r.success) {
      setSuccessMsg(`Đã cấp thêm +${topupAmount} lượt AI cho Shop.`);
      loadShopDetails();
      onRefresh?.();
    } else {
      setError(r.error || 'Lỗi khi nạp Quota AI.');
    }
  };

  const handleCreditWallet = async () => {
    const r = await AdminService.creditWallet(shop.id, Number(creditAmount), `ADMIN-TOPUP-${Date.now()}`, 'Nạp ví từ Admin 360 Hub');
    if (r.success) {
      setSuccessMsg(`Đã nạp thành công ${new Intl.NumberFormat('vi-VN').format(creditAmount)} đ vào ví của Shop.`);
      loadShopDetails();
      onRefresh?.();
    } else {
      setError(r.error || 'Lỗi nạp tiền ví.');
    }
  };

  const handleSaveCustomPrompt = async () => {
    setSavingPrompt(true);
    try {
      const r = await AdminService.updateShopFeatureFlags(shop.id, featureFlags, { custom_prompt_rules: customPrompt });
      if (r.success) {
        setSuccessMsg('Đã lưu quy tắc prompt AI riêng cho Shop!');
        loadShopDetails();
      } else {
        setError(r.error || 'Lỗi khi lưu prompt AI.');
      }
    } finally {
      setSavingPrompt(false);
    }
  };

  const statusActive = String(shop.status).toLowerCase() === 'active';

  return (
    <AdminModal open={open} onClose={onClose} title="" maxWidth="1200px">
      <div style={{ display: 'grid', gap: 18, margin: '-6px 0 0 0' }}>
        
        {/* Header Shop 360 */}
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          padding: '18px 20px',
          borderRadius: 12,
          border: '1px solid #dbeafe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'grid', placeItems: 'center', color: '#fff',
              boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.35)'
            }}>
              <Store size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
                  {shop.name}
                </h2>
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: statusActive ? '#dcfce7' : '#fee2e2',
                  color: statusActive ? '#166534' : '#991b1b',
                  border: `1px solid ${statusActive ? '#bbf7d0' : '#fecaca'}`
                }}>
                  {statusActive ? '● Hoạt động' : '● Tạm khóa'}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0'
                }}>
                  Gói: {shop.plan_name || shop.plan || 'FREE'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 12, color: '#64748b' }}>
                <span>ID: <code>{shop.id}</code></span>
                <button
                  type="button"
                  onClick={copyId}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: copied ? '#16a34a' : '#2563eb', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontSize: 11, fontWeight: 600
                  }}
                >
                  {copied ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Chép ID</>}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleImpersonate}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                borderRadius: 8, background: '#f59e0b', color: '#fff', border: 'none',
                fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
              }}
              title="Đăng nhập giả lập vào shop này"
            >
              <Eye size={14} /> Giả lập Shop
            </button>
            <button
              type="button"
              onClick={handleToggleStatus}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                borderRadius: 8, background: statusActive ? '#fff' : '#16a34a',
                color: statusActive ? '#dc2626' : '#fff',
                border: statusActive ? '1px solid #fecaca' : 'none',
                fontWeight: 700, fontSize: 12, cursor: 'pointer'
              }}
            >
              {statusActive ? <><Lock size={14} /> Tạm khóa</> : <><Unlock size={14} /> Kích hoạt</>}
            </button>
            <button
              type="button"
              onClick={loadShopDetails}
              disabled={loading}
              style={{
                background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                padding: '7px 10px', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#475569'
              }}
              title="Tải lại dữ liệu Shop"
            >
              <RefreshCw size={14} className={loading ? 'dash-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Thông báo Thành công / Lỗi */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} /> <span>{successMsg}</span>
          </div>
        )}

        {/* 4 Cards Thống Kê Nhanh */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} color="#2563eb" /> Nhân Viên / Users
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {members.length} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>người</span>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={13} color="#16a34a" /> Máy Đã Kết Nối
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {devices.filter(d => !d.revoked).length} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>/ {shop.max_devices || 5} máy</span>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={13} color="#eab308" /> AI Quota Hôm Nay
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {aiQuota.used} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>/ {aiQuota.limit} đơn</span>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarSign size={13} color="#7c3aed" /> Số Dư Ví Tiền
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
              {new Intl.NumberFormat('vi-VN').format(walletBalance)} <span style={{ fontSize: 12, fontWeight: 500 }}>đ</span>
            </div>
          </div>
        </div>

        {/* Tab Header Navigation */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', paddingBottom: 2, overflowX: 'auto' }}>
          {[
            { id: 'overview', label: '📊 Tổng quan', icon: Store },
            { id: 'members', label: `👥 Nhân viên (${members.length})`, icon: Users },
            { id: 'devices', label: `💻 Thiết bị (${devices.length})`, icon: Smartphone },
            { id: 'quota_wallet', label: '⚡ Nạp Quota & Ví', icon: Zap },
            { id: 'ai_rules', label: '🤖 Cấu hình AI', icon: Bot },
            { id: 'orders', label: `📦 Đơn hàng (${recentOrders.length})`, icon: Package }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setError(''); setSuccessMsg(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === tab.id ? '#2563eb' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: TỔNG QUAN */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Thông tin Chủ sở hữu & Hợp đồng</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, fontSize: 13 }}>
                <div><span style={{ color: '#64748b' }}>Chủ cửa hàng:</span> <b>{shop.owner_email || shop.owner_name || 'Chưa gán'}</b></div>
                <div><span style={{ color: '#64748b' }}>Ngày khởi tạo:</span> <b>{shop.created_at ? new Date(shop.created_at).toLocaleDateString('vi-VN') : '—'}</b></div>
                <div><span style={{ color: '#64748b' }}>Hạn mức thiết bị:</span> <b>{shop.max_devices || 5} thiết bị</b></div>
                <div><span style={{ color: '#64748b' }}>Hạn mức AI/ngày:</span> <b>{aiQuota.limit} lượt/ngày</b></div>
                <div><span style={{ color: '#64748b' }}>Đã dùng AI hôm nay:</span> <b style={{ color: aiQuota.used > 0 ? '#2563eb' : '#0f172a' }}>{aiQuota.used} lượt</b></div>
                <div><span style={{ color: '#64748b' }}>Tổng đơn đã bóc tách:</span> <b style={{ color: (recentOrders.length > 0 || shop.orders_count > 0) ? '#16a34a' : '#0f172a' }}>{shop.orders_count || recentOrders.length} đơn</b></div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Thao tác nhanh cho Quản trị viên</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('members'); setShowAddMember(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <UserPlus size={15} /> Thêm Nhân Viên
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('quota_wallet')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#0284c7', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <Zap size={15} /> Nạp Thêm Quota AI
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('quota_wallet')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <DollarSign size={15} /> Nạp Ví Tiền Shop
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai_rules')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#475569', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <Bot size={15} /> Sửa Quy Tắc Prompt AI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NHÂN VIÊN */}
        {activeTab === 'members' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Danh sách thành viên thuộc Shop ({members.length})</span>
              <button
                type="button"
                onClick={() => setShowAddMember(!showAddMember)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
              >
                <Plus size={14} /> {showAddMember ? 'Đóng form thêm' : '+ Thêm Nhân Viên Mới'}
              </button>
            </div>

            {/* Form Thêm Nhân Viên (2 Chế Độ) */}
            {showAddMember && (
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #bfdbfe', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setAddMode('existing')}
                    style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: addMode === 'existing' ? '#2563eb' : '#e2e8f0', color: addMode === 'existing' ? '#fff' : '#475569', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    🔍 Chọn Người Dùng Có Sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('new')}
                    style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: addMode === 'new' ? '#2563eb' : '#e2e8f0', color: addMode === 'new' ? '#fff' : '#475569', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    ✨ Cấp Tài Khoản Mới Trực Tiếp
                  </button>
                </div>

                {addMode === 'existing' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Chọn Người Dùng:</label>
                      <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      >
                        <option value="">-- Chọn tài khoản --</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Vai trò:</label>
                      <select
                        value={memberRole}
                        onChange={e => setMemberRole(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      >
                        <option value="STAFF">Nhân viên (STAFF)</option>
                        <option value="MANAGER">Quản lý (MANAGER)</option>
                        <option value="OWNER">Chủ shop (OWNER)</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExistingMember}
                      style={{ padding: '8px 16px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', height: 38 }}
                    >
                      Thêm vào Shop
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Email:*</label>
                      <input
                        type="email"
                        placeholder="nv@domain.com"
                        value={newMemberForm.email}
                        onChange={e => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Họ tên:*</label>
                      <input
                        type="text"
                        placeholder="Nguyễn Văn A"
                        value={newMemberForm.fullName}
                        onChange={e => setNewMemberForm({ ...newMemberForm, fullName: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Mật khẩu tạm:</label>
                      <input
                        type="text"
                        placeholder="12345678"
                        value={newMemberForm.password}
                        onChange={e => setNewMemberForm({ ...newMemberForm, password: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Vai trò:</label>
                      <select
                        value={newMemberForm.roleCode}
                        onChange={e => setNewMemberForm({ ...newMemberForm, roleCode: e.target.value })}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                      >
                        <option value="STAFF">Nhân viên</option>
                        <option value="MANAGER">Quản lý</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateNewMember}
                      style={{ padding: '7px 14px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', height: 35 }}
                    >
                      Cấp & Thêm
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bảng Danh Sách Nhân Viên */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Nhân Viên</th>
                    <th style={{ padding: '10px 14px' }}>Email</th>
                    <th style={{ padding: '10px 14px' }}>Vai Trò</th>
                    <th style={{ padding: '10px 14px' }}>Ngày Vào</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có nhân viên nào trong Shop này.
                      </td>
                    </tr>
                  ) : (
                    members.map(m => {
                      const roleCode = String(m.role || m.role_code || m.roles?.code || 'STAFF').toUpperCase();
                      const isOwner = roleCode === 'OWNER' || roleCode === 'SHOP_OWNER';
                      const uEmail = m.email || m.profiles?.email || '—';
                      const uName = m.full_name || m.profiles?.full_name || (uEmail !== '—' ? uEmail.split('@')[0] : 'Nhân viên');
                      const uId = m.user_id || m.id;

                      return (
                        <tr key={m.id || uId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                                {uName.charAt(0).toUpperCase()}
                              </div>
                              <span>{uName}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>{uEmail}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                              background: isOwner ? '#fef3c7' : '#eff6ff',
                              color: isOwner ? '#92400e' : '#1d4ed8'
                            }}>
                              {m.roles?.name || m.role || 'Nhân viên'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                            {m.created_at ? new Date(m.created_at).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(uId, uEmail)}
                                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                              >
                                Xóa khỏi Shop
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: THIẾT BỊ & MÁY KẾT NỐI */}
        {activeTab === 'devices' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Máy tính & Trình duyệt đang kết nối ({devices.length})</span>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>Hạn mức cho phép: {shop.max_devices || 5} thiết bị đồng thời</p>
              </div>
              {devices.length > 0 && (
                <button
                  type="button"
                  onClick={handleRevokeAllDevices}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                >
                  <Shield size={14} /> Thu hồi toàn bộ máy
                </button>
              )}
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Trình Duyệt & Thiết Bị</th>
                    <th style={{ padding: '10px 14px' }}>Tài Khoản Đăng Nhập</th>
                    <th style={{ padding: '10px 14px' }}>Hệ Điều Hành & Phần Cứng</th>
                    <th style={{ padding: '10px 14px' }}>Mạng / Vị Trí</th>
                    <th style={{ padding: '10px 14px' }}>Trạng Thái Online</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có thiết bị Extension nào kết nối vào Shop này.
                      </td>
                    </tr>
                  ) : (
                    devices.map(d => {
                      const meta = d.metadata || {};
                      const browserName = d.browser || meta.browser || d.device_name || 'Google Chrome';
                      const isCocCoc = /coccoc|cốc cốc/i.test(browserName);
                      const isEdge = /edge|edg/i.test(browserName);
                      const isBrave = /brave/i.test(browserName);
                      const isFirefox = /firefox/i.test(browserName);
                      const isOpera = /opera/i.test(browserName);
                      const isSafari = /safari/i.test(browserName);

                      const browserColor = isCocCoc ? '#10b981' : isEdge ? '#0284c7' : isBrave ? '#f97316' : isFirefox ? '#ea580c' : isOpera ? '#ef4444' : '#2563eb';
                      const browserBg = isCocCoc ? '#ecfdf5' : isEdge ? '#f0f9ff' : isBrave ? '#fff7ed' : isFirefox ? '#fff7ed' : isOpera ? '#fef2f2' : '#eff6ff';

                      const osText = d.os_info || meta.os || (d.device_name?.includes('Mac') ? 'macOS (Apple)' : 'Windows 10/11 (64-bit)');
                      const screenRes = meta.screenResolution || '1920 x 1080';
                      const cpuInfo = meta.cpuCores ? `${meta.cpuCores}` : '4-8 cores';
                      const memInfo = meta.deviceMemory || '>= 8 GB RAM';
                      const extVer = d.client_version || d.version || meta.extensionVersion || 'v2.4 Pro';

                      const onlineInfo = getDeviceOnlineInfo(d);

                      return (
                        <tr key={d.device_id || d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 8,
                                background: browserBg, color: browserColor,
                                border: `1px solid ${browserColor}33`,
                                display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13
                              }}>
                                🌐
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{browserName}</span>
                                  <span style={{ fontSize: 10.5, padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                                    {extVer}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                                  ID: {String(d.device_id || d.id || '').slice(0, 16)}...
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{d.full_name || d.email || '—'}</div>
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>{d.email || d.user_id}</div>
                          </td>

                          <td style={{ padding: '10px 14px', fontSize: 12 }}>
                            <div style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                              💻 {osText}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              🖥️ {screenRes} • ⚡ {cpuInfo} • 🧠 {memInfo}
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>
                            <div>IP: <b>{d.ip_address || d.last_ip || '127.0.0.1'}</b></div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              📍 {meta.timezone || 'Asia/Ho_Chi_Minh'} ({meta.language || 'vi-VN'})
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'grid', gap: 2 }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content',
                                padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                background: onlineInfo.bg,
                                color: onlineInfo.color,
                                border: `1px solid ${onlineInfo.border || 'transparent'}`
                              }}>
                                {onlineInfo.isRealtime ? (
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                                ) : (
                                  <span>●</span>
                                )}
                                {onlineInfo.text}
                              </span>
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                {onlineInfo.timeAgo}
                              </span>
                            </div>
                          </td>

                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(d)}
                              style={{
                                background: d.revoked ? '#dcfce7' : '#fee2e2',
                                color: d.revoked ? '#166534' : '#991b1b',
                                border: `1px solid ${d.revoked ? '#bbf7d0' : '#fecaca'}`,
                                borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              {d.revoked ? 'Khôi phục' : 'Thu hồi máy'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: NẠP QUOTA & NẠP VÍ */}
        {activeTab === 'quota_wallet' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Widget Nạp Quota */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                <Zap size={18} color="#eab308" /> Nạp Thêm Quota AI Hôm Nay
              </div>
              <p style={{ margin: '0 0 14px 0', fontSize: 12, color: '#64748b' }}>
                Hạn mức hiện tại: <b>{aiQuota.used} / {aiQuota.limit}</b> đơn. Nạp thêm sẽ áp dụng ngay tức thì.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8,
                      border: topupAmount === amt ? '2px solid #eab308' : '1px solid #cbd5e1',
                      background: topupAmount === amt ? '#fefce8' : '#fff',
                      color: topupAmount === amt ? '#854d0e' : '#475569',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    +{amt} lượt
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleTopupQuota}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#eab308', color: '#000', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                ⚡ Xác Nhận Cấp +{topupAmount} Quota
              </button>
            </div>

            {/* Widget Nạp Ví Tiền */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                <DollarSign size={18} color="#7c3aed" /> Nạp Tiền Vào Ví Shop
              </div>
              <p style={{ margin: '0 0 14px 0', fontSize: 12, color: '#64748b' }}>
                Số dư hiện tại: <b style={{ color: '#7c3aed' }}>{new Intl.NumberFormat('vi-VN').format(walletBalance)} đ</b>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[100000, 200000, 500000, 1000000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCreditAmount(amt)}
                    style={{
                      padding: '8px 4px', borderRadius: 8,
                      border: creditAmount === amt ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: creditAmount === amt ? '#f5f3ff' : '#fff',
                      color: creditAmount === amt ? '#5b21b6' : '#475569',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer'
                    }}
                  >
                    +{new Intl.NumberFormat('vi-VN').format(amt / 1000)}k đ
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCreditWallet}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                💰 Xác Nhận Nạp +{new Intl.NumberFormat('vi-VN').format(creditAmount)} đ
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: CẤU HÌNH AI & PROMPT RIÊNG */}
        {activeTab === 'ai_rules' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                <Bot size={18} color="#2563eb" /> Quy Tắc Prompt AI Tùy Chỉnh Cho Riêng Shop Này
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>
                Hệ thống AI sẽ tự động áp dụng các quy tắc đặc thù dưới đây khi bóc tách đơn hàng cho cửa hàng này (VD: quy cách mặt hàng, ghi chú kèm theo, cách đọc mã size/màu).
              </p>

              <textarea
                rows={7}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="VD: - Mặc định hàng hóa là Quần áo thời trang&#10;- Nếu thấy ghi chú 'giao giờ hành chính' thì đưa vào trường ghi chú đặc biệt&#10;- Bỏ qua các ký tự hashtag #..."
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                  fontSize: 13, fontFamily: 'monospace', lineHeight: 1.5, boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleSaveCustomPrompt}
                  disabled={savingPrompt}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
                    borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  {savingPrompt ? 'Đang lưu...' : '💾 Lưu Quy Tắc AI'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ĐƠN HÀNG GẦN ĐÂY */}
        {activeTab === 'orders' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Banner Tuân thủ Nghị định 13/2023/NĐ-CP */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #2563eb',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={18} color="#2563eb" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    Chế độ Giám sát Vận hành & Bảo vệ Dữ liệu Cá nhân (Nghị định 13/2023/NĐ-CP)
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Tài khoản Quản trị viên chỉ đối soát mã vận đơn, tiến trình giao vận và điểm đến cấp Tỉnh/Thành phố. Toàn bộ SĐT và địa chỉ số nhà chi tiết của khách hàng được bảo vệ & che tự động.
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                🔒 BẢO VỆ PII
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>
                Danh sách {recentOrders.length} đơn hàng gần nhất của Shop
              </span>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#64748b' }}>
                <span>📦 Tổng đơn hiển thị: <strong style={{ color: '#0f172a' }}>{recentOrders.length}</strong></span>
                <span>💰 Tổng COD: <strong style={{ color: '#16a34a' }}>
                  {new Intl.NumberFormat('vi-VN').format(recentOrders.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0))} đ
                </strong></span>
              </div>
            </div>

            {/* Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Mã Đơn / Tracking</th>
                    <th style={{ padding: '10px 14px' }}>Hãng Vận Chuyển</th>
                    <th style={{ padding: '10px 14px' }}>Khách Nhận (Bảo vệ PII)</th>
                    <th style={{ padding: '10px 14px' }}>Điểm Đến (Tỉnh / Thành phố)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tiền COD</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thời Gian Gửi</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px 14px', textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có đơn hàng nào được gửi từ Shop này.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map(o => {
                      const tracking = o.tracking_code || o.order_code || o.id?.slice(0, 8);
                      const carrier = getCarrierInfo(tracking, o);
                      return (
                        <tr key={o.id || tracking} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                          {/* Mã đơn / Tracking */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: 13 }}>
                              {tracking}
                            </div>
                            {o.order_code && o.tracking_code && o.order_code !== o.tracking_code && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                Đơn gốc: {o.order_code}
                              </div>
                            )}
                          </td>

                          {/* Hãng vận chuyển */}
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: carrier.bg,
                              color: carrier.color,
                              border: `1px solid ${carrier.border}`,
                              padding: '2px 8px',
                              borderRadius: 6
                            }}>
                              {carrier.name}
                            </span>
                          </td>

                          {/* Người nhận (Đã che PII) */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {maskCustomerName(o.receiver_name || o.customer_name || o.name)}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                              <span title="Số điện thoại đã che bảo vệ quyền riêng tư công dân">🔒 {maskPhone(o.receiver_phone || o.phone)}</span>
                            </div>
                          </td>

                          {/* Điểm đến cấp Tỉnh / TP */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#334155' }}>
                              {extractDestinationProvince(o.receiver_address || o.address)}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                              (Địa chỉ chi tiết đã ẩn theo NĐ 13)
                            </div>
                          </td>

                          {/* Tiền COD */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontSize: 13 }}>
                            {o.cod_amount ? new Intl.NumberFormat('vi-VN').format(o.cod_amount) + ' đ' : '0 đ'}
                          </td>

                          {/* Thời gian */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b', fontSize: 12 }}>
                            {o.created_at ? new Date(o.created_at).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric'
                            }) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </AdminModal>
  );
}
