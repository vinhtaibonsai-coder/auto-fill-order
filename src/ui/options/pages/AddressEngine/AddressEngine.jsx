import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Search, BookOpen, AlertCircle, Check, X, Sparkles, Filter, RefreshCw, ShieldCheck, ArrowUpRight, CheckCircle2, Layers } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import Pagination from '../../components/Pagination';

const SUGGESTIONS = [
  { original: 'q1', mapping: 'Quận 1, TP Hồ Chí Minh' },
  { original: 'qbt', mapping: 'Quận Bình Thạnh, TP Hồ Chí Minh' },
  { original: 'td', mapping: 'TP Thủ Đức, TP Hồ Chí Minh' },
  { original: 'hn', mapping: 'Thành phố Hà Nội' },
  { original: 'dn', mapping: 'Thành phố Đà Nẵng' }
];

export default function AddressEngine() {
  const [activeSubTab, setActiveSubTab] = useState('aliases'); // 'aliases' | 'learning_kb'
  const [aliases, setAliases] = useState([]);
  const [learningKb, setLearningKb] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [kbCategory, setKbCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOriginal, setNewOriginal] = useState('');
  const [newMapping, setNewMapping] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteKbTarget, setDeleteKbTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (text, type = 'success') => {
    setStatus({ type, text });
    setTimeout(() => setStatus({ type: '', text: '' }), 3500);
  };

  useEffect(() => {
    loadAliases();
    loadLearningKb();
  }, []);

  const getClient = async () => {
    const configRes = await globalThis.SupabaseCloud.loadConfig();
    const sess = await AuthSession.getSession();
    return { configRes, sess };
  };

  const updateLocalCache = (list) => {
    const cleanList = Array.isArray(list) ? list : [];
    globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ = cleanList;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ shop_address_aliases_cache: cleanList }).catch(() => {});
    }
  };

  const loadAliases = async () => {
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const res = await fetch(
        `${configRes.url}/rest/v1/shop_address_aliases?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&select=id,original,mapping`,
        {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        const list = rows || [];
        setAliases(list);
        updateLocalCache(list);
      }
    } catch (err) {
      console.error('Lỗi tải từ điển địa chỉ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLearningKb = async () => {
    setIsKbLoading(true);
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsKbLoading(false);
        return;
      }
      const res = await fetch(
        `${configRes.url}/rest/v1/shop_learning_kb?shop_id=eq.${sess.active_shop_id}&order=last_used_at.desc&select=*`,
        {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${sess.access_token}`
          }
        }
      );
      if (res.ok) {
        const rows = await res.json();
        setLearningKb(rows || []);
      }
    } catch (err) {
      console.error('Lỗi tải tri thức học máy:', err);
    } finally {
      setIsKbLoading(false);
    }
  };

  const handleSaveNew = async (e) => {
    if (e) e.preventDefault();
    const orig = newOriginal.trim().toLowerCase();
    const map = newMapping.trim();

    if (!orig || !map) {
      setFormError('Vui lòng điền đầy đủ cả từ viết tắt và địa chỉ chuẩn xác.');
      return;
    }

    setFormError('');
    setIsSaving(true);

    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setFormError('Phiên đăng nhập không hợp lệ.');
        return;
      }

      const res = await fetch(`${configRes.url}/rest/v1/shop_address_aliases`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          shop_id: sess.active_shop_id,
          original: orig,
          mapping: map
        })
      });

      if (res.ok) {
        const row = await res.json();
        const createdItem = row[0] || { id: Date.now(), original: orig, mapping: map };
        setAliases(prev => {
          const updated = [createdItem, ...prev];
          updateLocalCache(updated);
          return updated;
        });
        setShowAddModal(false);
        setNewOriginal('');
        setNewMapping('');
        showToast('✅ Đã thêm từ khóa vào Từ điển Cloud!');
      } else {
        const data = await res.json();
        setFormError(data.message || 'Không thể lưu (từ khóa có thể đã tồn tại).');
      }
    } catch (err) {
      setFormError('Lỗi kết nối: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.access_token) return;
      const res = await fetch(`${configRes.url}/rest/v1/shop_address_aliases?id=eq.${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`
        }
      });
      if (res.ok) {
        setAliases(prev => {
          const updated = prev.filter(a => a.id !== deleteTarget.id);
          updateLocalCache(updated);
          return updated;
        });
        setDeleteTarget(null);
        showToast('✅ Đã xóa từ khóa khỏi từ điển.');
      } else {
        showToast('❌ Không thể xóa từ khóa.', 'error');
      }
    } catch (err) {
      showToast('❌ Lỗi: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Xác nhận độ tin cậy 100% cho mẫu học máy
  const handleVerifyKbEntry = async (item) => {
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.access_token || !sess.active_shop_id) return;
      const res = await fetch(`${configRes.url}/rest/v1/rpc/verify_shop_learning_entry`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_shop_id: sess.active_shop_id, p_id: item.id })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success !== false) {
        setLearningKb(prev => prev.map(k => k.id === item.id ? { ...k, confidence: 100, source_type: 'admin_verified' } : k));
        if (typeof globalThis.AddressLearning?.markLocalEntryVerified === 'function') {
          await globalThis.AddressLearning.markLocalEntryVerified(item.category, item.raw_key, sess.active_shop_id).catch(() => {});
        }
        showToast('🔒 Đã xác nhận chuẩn xác 100% cho mẫu học máy!');
      } else {
        showToast('❌ Lỗi cập nhật: ' + (data?.error || 'Thất bại'), 'error');
      }
    } catch (err) {
      showToast('❌ Lỗi cập nhật: ' + err.message, 'error');
    }
  };

  // Thăng hạng một mẫu học địa chỉ thành Từ Điển Viết Tắt (Promote to Alias)
  const handlePromoteToAlias = (item) => {
    const orig = item.raw_key || '';
    let map = '';
    if (typeof item.normalized_value === 'string') {
      map = item.normalized_value;
    } else if (item.normalized_value) {
      const v = item.normalized_value;
      const parts = [v.street, v.ward, v.district, v.province].filter(Boolean);
      map = parts.join(', ') || v.fullAddress || JSON.stringify(v);
    }
    setNewOriginal(orig);
    setNewMapping(map);
    setActiveSubTab('aliases');
    setShowAddModal(true);
  };

  // Xóa một bản ghi tri thức học máy
  const confirmDeleteKb = async () => {
    if (!deleteKbTarget) return;
    setIsDeleting(true);
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.access_token || !sess.active_shop_id) return;
      const res = await fetch(`${configRes.url}/rest/v1/rpc/delete_shop_learning_entry`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_shop_id: sess.active_shop_id, p_id: deleteKbTarget.id })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success !== false) {
        setLearningKb(prev => prev.filter(k => k.id !== deleteKbTarget.id));
        if (typeof globalThis.AddressLearning?.removeLocalEntry === 'function') {
          await globalThis.AddressLearning.removeLocalEntry(deleteKbTarget.category, deleteKbTarget.raw_key, sess.active_shop_id).catch(() => {});
        } else if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const cacheKey = `addressLearningDB:${sess.active_shop_id}`;
          chrome.storage.local.get([cacheKey], resLocal => {
            const db = resLocal?.[cacheKey];
            if (db) {
              if (deleteKbTarget.category === 'address_raw' && db.byRaw) delete db.byRaw[String(deleteKbTarget.raw_key).trim().toLowerCase()];
              if (deleteKbTarget.category === 'customer_phone' && db.byPhone) delete db.byPhone[String(deleteKbTarget.raw_key).replace(/\D/g, '')];
              chrome.storage.local.set({ [cacheKey]: db }).catch(() => {});
            }
          });
        }
        setDeleteKbTarget(null);
        showToast('✅ Đã xóa mẫu học máy khỏi Cloud và Cache máy trạm.');
      } else {
        showToast('❌ Không thể xóa mẫu học: ' + (data?.error || 'Thất bại'), 'error');
      }
    } catch (err) {
      showToast('❌ Lỗi: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Khai phá dữ liệu đơn gửi lịch sử & khách hàng của Shop
  const [isMining, setIsMining] = useState(false);
  const handleMineHistoricalShopData = async () => {
    if (!window.confirm('Hệ thống sẽ quét toàn bộ đơn gửi lịch sử và khách hàng của Shop để trích xuất tri thức nạp vào danh sách này. Bạn có muốn tiếp tục?')) {
      return;
    }
    setIsMining(true);
    try {
      const { configRes, sess } = await getClient();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        showToast('Phiên đăng nhập không hợp lệ.', 'error');
        return;
      }

      const res = await fetch(`${configRes.url}/rest/v1/rpc/mine_historical_orders_to_learning_kb`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_shop_id: sess.active_shop_id })
      });

      if (res.ok) {
        const result = await res.json();
        showToast(`🎉 Khai phá thành công! ${result.learned_addresses_count || 0} địa chỉ và ${result.learned_customers_count || 0} khách hàng từ lịch sử đã nạp vào hàng đợi.`);
        loadLearningKb();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast('❌ Lỗi khai phá: ' + (err.message || res.statusText), 'error');
      }
    } catch (e) {
      showToast('❌ Lỗi: ' + e.message, 'error');
    } finally {
      setIsMining(false);
    }
  };


  const filteredAliases = useMemo(() => {
    if (!searchQuery.trim()) return aliases;
    const q = searchQuery.toLowerCase().trim();
    return aliases.filter(a =>
      (a.original && a.original.toLowerCase().includes(q)) ||
      (a.mapping && a.mapping.toLowerCase().includes(q))
    );
  }, [aliases, searchQuery]);

  const filteredKb = useMemo(() => {
    let list = learningKb;
    if (kbCategory !== 'ALL') {
      list = list.filter(k => k.category === kbCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(k => {
        const kStr = (k.raw_key || '').toLowerCase();
        const vStr = JSON.stringify(k.normalized_value || '').toLowerCase();
        return kStr.includes(q) || vStr.includes(q);
      });
    }
    return list;
  }, [learningKb, kbCategory, searchQuery]);

  const paginatedAliases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAliases.slice(start, start + pageSize);
  }, [filteredAliases, page, pageSize]);

  const paginatedKb = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredKb.slice(start, start + pageSize);
  }, [filteredKb, page, pageSize]);

  const formatNormalizedValue = (val) => {
    if (!val) return '—';
    if (typeof val === 'string') return val;
    const parts = [val.street, val.ward, val.district, val.province].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    if (val.fullAddress) return val.fullAddress;
    if (val.code) return `Mã: ${val.code}`;
    return JSON.stringify(val);
  };

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'address_raw':
        return <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>📍 Địa chỉ thô</span>;
      case 'customer_phone':
        return <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>📞 SĐT Khách</span>;
      case 'product_sku':
        return <span style={{ background: '#ffedd5', color: '#9a3412', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>📦 Mã sản phẩm</span>;
      case 'order_code_pattern':
        return <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>🏷️ Quy tắc mã</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>{cat}</span>;
    }
  };

  return (
    <div>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="var(--primary)" /> Từ Điển & Tri Thức Địa Chỉ (Address Engine)
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>
            Dạy hệ thống hiểu từ viết tắt địa phương và tự động tích lũy tri thức học máy từ mỗi lần tạo đơn của Shop.
          </p>
        </div>
        {activeSubTab === 'aliases' && (
          <button
            onClick={() => {
              setFormError('');
              setShowAddModal(true);
            }}
            className="btn-primary"
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Plus size={15} /> Thêm Từ Khóa
          </button>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '16px', paddingBottom: '2px' }}>
        <button
          onClick={() => { setActiveSubTab('aliases'); setPage(1); setSearchQuery(''); }}
          style={{
            padding: '9px 16px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeSubTab === 'aliases' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            background: activeSubTab === 'aliases' ? 'var(--card)' : 'transparent',
            color: activeSubTab === 'aliases' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'aliases' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BookOpen size={16} /> Từ Điển Viết Tắt ({aliases.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('learning_kb'); setPage(1); setSearchQuery(''); }}
          style={{
            padding: '9px 16px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: activeSubTab === 'learning_kb' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            background: activeSubTab === 'learning_kb' ? 'var(--card)' : 'transparent',
            color: activeSubTab === 'learning_kb' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeSubTab === 'learning_kb' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={16} color="#eab308" /> Tri Thức Học Máy Cloud ({learningKb.length})
        </button>
      </div>

      {/* Toast Alert */}
      {status.text && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
          background: status.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
          color: status.type === 'error' ? 'var(--color-danger-text)' : 'var(--color-success-text)',
          border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {status.text}
        </div>
      )}

      {/* TAB 1: TỪ ĐIỂN VIẾT TẮT (ALIASES) */}
      {activeSubTab === 'aliases' && (
        <>
          {/* Quick suggestions */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={13} color="#eab308" /> Gợi ý mẫu:
            </span>
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setNewOriginal(s.original);
                  setNewMapping(s.mapping);
                  setFormError('');
                  setShowAddModal(true);
                }}
                style={{
                  background: 'var(--bg)',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.original}</span> → {s.mapping}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Tìm theo từ viết tắt hoặc địa chỉ chuẩn..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Table Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', width: '220px' }}>
                    Từ Khóa Viết Tắt
                  </th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Địa Chỉ Chuẩn Hóa
                  </th>
                  <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', width: '100px', textAlign: 'right' }}>
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <div className="db-status-dot live"></div> Đang tải từ điển địa chỉ...
                      </div>
                    </td>
                  </tr>
                ) : paginatedAliases.map(alias => (
                  <tr key={alias.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s ease' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '13px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(37, 99, 235, 0.2)'
                      }}>
                        {alias.original}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500 }}>
                      {alias.mapping}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => setDeleteTarget(alias)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                        title="Xóa từ khóa"
                      >
                        <Trash2 size={14} /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredAliases.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <BookOpen size={32} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '8px' }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {searchQuery ? 'Không tìm thấy từ khóa phù hợp' : 'Chưa có từ điển địa chỉ nào'}
                      </div>
                      <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                        {searchQuery ? 'Thử tìm với từ khóa khác.' : 'Bấm "+ Thêm Từ Khóa" để tạo từ khóa viết tắt đầu tiên.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* PAGINATION */}
            {!isLoading && filteredAliases.length > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                totalItems={filteredAliases.length}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
              />
            )}
          </div>
        </>
      )}

      {/* TAB 2: TRI THỨC HỌC MÁY CLOUD (LEARNING KB) */}
      {activeSubTab === 'learning_kb' && (
        <>
          {/* Category Filter Pills & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'address_raw', label: '📍 Địa chỉ thô' },
                { id: 'customer_phone', label: '📞 SĐT Khách' },
                { id: 'product_sku', label: '📦 Mã sản phẩm' },
                { id: 'order_code_pattern', label: '🏷️ Quy tắc mã' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setKbCategory(cat.id); setPage(1); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12.5px',
                    fontWeight: kbCategory === cat.id ? 700 : 500,
                    border: kbCategory === cat.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: kbCategory === cat.id ? 'var(--primary-light)' : 'var(--card)',
                    color: kbCategory === cat.id ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Tìm khóa thô hoặc địa chỉ..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '7px 10px 7px 30px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--text-main)',
                    fontSize: '12.5px',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={handleMineHistoricalShopData}
                disabled={isMining}
                title="Khai phá đơn gửi lịch sử và khách hàng của Shop nạp vào hàng đợi học máy"
                style={{
                  background: isMining ? 'var(--bg)' : '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  cursor: isMining ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12.5px',
                  color: isMining ? 'var(--text-muted)' : '#92400e',
                  fontWeight: 700
                }}
              >
                {isMining ? '⏳ Đang quét...' : '⛏️ Khai Phá Lịch Sử'}
              </button>
              <button
                onClick={loadLearningKb}
                disabled={isKbLoading}
                title="Làm mới từ Cloud"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12.5px',
                  color: 'var(--text-main)',
                  fontWeight: 600
                }}
              >
                <RefreshCw size={13} className={isKbLoading ? 'spin' : ''} /> Làm mới
              </button>
            </div>
          </div>


          {/* Table Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, width: '130px' }}>
                    Phân Loại
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, width: '220px' }}>
                    Khóa Nhận Diện (Raw Key)
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700 }}>
                    Kết Quả Chuẩn Hóa
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, width: '110px' }}>
                    Độ Tin Cậy
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, width: '80px', textAlign: 'center' }}>
                    Lượt
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, width: '130px', textAlign: 'right' }}>
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {isKbLoading ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <RefreshCw size={16} className="spin" /> Đang tải dữ liệu tri thức học máy từ Cloud...
                      </div>
                    </td>
                  </tr>
                ) : paginatedKb.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s ease' }}>
                    <td style={{ padding: '12px 16px' }}>
                      {getCategoryBadge(item.category)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        background: 'var(--bg)',
                        color: 'var(--text-main)',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        wordBreak: 'break-all'
                      }}>
                        {item.raw_key}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500 }}>
                      {formatNormalizedValue(item.normalized_value)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: item.confidence >= 100 ? '#0284c7' : (item.confidence >= 90 ? '#16a34a' : '#d97706'),
                        background: item.confidence >= 100 ? '#e0f2fe' : (item.confidence >= 90 ? '#dcfce7' : '#fef3c7'),
                        padding: '2px 7px',
                        borderRadius: '12px'
                      }}>
                        {item.confidence >= 100 && <ShieldCheck size={12} />}
                        {item.confidence}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {item.hit_count || 1}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        {item.confidence < 100 && (
                          <button
                            onClick={() => handleVerifyKbEntry(item)}
                            title="Xác nhận chuẩn xác 100%"
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              color: '#15803d',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '11.5px',
                              fontWeight: 600
                            }}
                          >
                            <Check size={12} /> Duyệt
                          </button>
                        )}
                        {item.category === 'address_raw' && (
                          <button
                            onClick={() => handlePromoteToAlias(item)}
                            title="Thăng hạng thành Từ điển viết tắt"
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '11.5px',
                              fontWeight: 600
                            }}
                          >
                            <ArrowUpRight size={12} /> Alias
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteKbTarget(item)}
                          title="Xóa mẫu học máy"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            padding: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isKbLoading && filteredKb.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Sparkles size={32} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '8px' }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                        Chưa có mẫu tri thức học máy nào
                      </div>
                      <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                        Khi người dùng bóc tách đơn hoặc sửa địa chỉ trên Panel, hệ thống sẽ tự động học và lưu vào đây.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* PAGINATION */}
            {!isKbLoading && filteredKb.length > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                totalItems={filteredKb.length}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
              />
            )}
          </div>
        </>
      )}

      {/* Modal Thêm Từ Khóa */}
      {showAddModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '480px', background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: '12px', padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                Thêm Từ Khóa Viết Tắt Mới
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)',
                border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '16px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveNew}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Từ viết tắt / Ký hiệu thô <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newOriginal}
                  onChange={(e) => setNewOriginal(e.target.value)}
                  placeholder="Ví dụ: qbt, kcx tân thuận, td..."
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text-main)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Địa chỉ chuẩn hóa thay thế <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newMapping}
                  onChange={(e) => setNewMapping(e.target.value)}
                  placeholder="Ví dụ: Quận Bình Thạnh, TP Hồ Chí Minh..."
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                    borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text-main)', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSaving}
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    background: 'var(--primary)', border: 'none', color: '#fff',
                    padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu Vào Cloud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Alias */}
      {deleteTarget && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '420px', background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: '12px', padding: '24px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> Xác Nhận Xóa Từ Khóa
            </h3>
            <p style={{ color: 'var(--text-main)', fontSize: '13.5px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn xóa từ viết tắt <strong>"{deleteTarget.original}"</strong>? Thao tác này sẽ xóa từ khóa khỏi toàn bộ các máy trạm trong shop.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  background: 'var(--danger)', border: 'none', color: '#fff',
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa Vĩnh Viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Learning KB */}
      {deleteKbTarget && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '420px', background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: '12px', padding: '24px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> Xác Nhận Xóa Mẫu Học Máy
            </h3>
            <p style={{ color: 'var(--text-main)', fontSize: '13.5px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Bạn có chắc muốn xóa mẫu tri thức <strong>"{deleteKbTarget.raw_key}"</strong>? Hệ thống sẽ không áp dụng chuẩn hóa này nữa.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDeleteKbTarget(null)}
                disabled={isDeleting}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Hủy
              </button>
              <button
                onClick={confirmDeleteKb}
                disabled={isDeleting}
                style={{
                  background: 'var(--danger)', border: 'none', color: '#fff',
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa Khỏi Cloud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
