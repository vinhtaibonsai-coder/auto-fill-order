import React, { useState, useEffect, useRef } from 'react';
import { OrderStorage } from '../../../../application/storage.esm.js';

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

const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

export default function OrderList() {
  const [activeTab, setActiveTab] = useState('draft');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [search, setSearch] = useState(() => (typeof window !== 'undefined' && window.__af_global_search) || '');
  const [isQueueEnabled, setIsQueueEnabled] = useState(true);
  const debounceRef = useRef(null);

  const debouncedLoadOrders = (forceSync = false, delay = 350) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadOrders(forceSync);
    }, delay);
  };

  useEffect(() => {
    loadOrders(true);
  }, [activeTab]);

  useEffect(() => {
    // Đọc trạng thái bật/tắt hàng đợi
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['draft_queue_enabled'], (res) => {
        if (res && res.draft_queue_enabled !== undefined) {
          setIsQueueEnabled(!!res.draft_queue_enabled);
        }
      });
    } else {
      const pref = localStorage.getItem('draft_queue_enabled');
      if (pref !== null) setIsQueueEnabled(pref === 'true');
    }

    // Tự động lắng nghe thay đổi storage từ các tab/panel khác
    const handleStorageChange = (changes, area) => {
      if (area === 'local') {
        if (changes.draft_queue_enabled !== undefined) {
          setIsQueueEnabled(!!changes.draft_queue_enabled.newValue);
        }
        const hasOrdersChanged = Object.keys(changes).some(k => 
          k === 'savedOrders' || 
          k.startsWith('savedOrders_') || 
          k === 'submittedOrders' || 
          k.startsWith('submittedOrders_') ||
          k === 'draft_queue_updated_at' ||
          k === 'last_cloud_order_sync' ||
          k === 'last_submitted_order_sync'
        );
        if (hasOrdersChanged) {
          debouncedLoadOrders(false, 350);
        }
      }
    };

    const handleRuntimeMessage = (msg) => {
      if (msg && (
        msg.action === 'draftOrdersUpdated' || 
        msg.action === 'ordersUpdated' || 
        msg.action === 'refreshDraftQueue' ||
        msg.action === 'refresh_orders' ||
        msg.type === 'cloud_sync_update' ||
        msg.type === 'order_submitted'
      )) {
        debouncedLoadOrders(false, 350);
      }
    };

    const handleWindowStorage = (e) => {
      if (!e || e.key === 'draft_queue_updated_at' || e.key === 'savedOrders' || e.key?.startsWith('savedOrders_')) {
        debouncedLoadOrders(false, 350);
      }
    };

    const handleDraftCustomEvent = () => {
      debouncedLoadOrders(false, 350);
    };

    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener(handleStorageChange);
      }
      if (chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleWindowStorage);
      window.addEventListener('draft-queue-updated', handleDraftCustomEvent);
      window.addEventListener('orders-updated', handleDraftCustomEvent);
    }

    const handleSearchEvent = (e) => {
      if (e?.detail?.search !== undefined) {
        setSearch(e.detail.search);
      }
    };
    window.addEventListener('options:search', handleSearchEvent);
    window.addEventListener('options:navigate', handleSearchEvent);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (typeof chrome !== 'undefined') {
        chrome.storage?.onChanged?.removeListener(handleStorageChange);
        chrome.runtime?.onMessage?.removeListener(handleRuntimeMessage);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleWindowStorage);
        window.removeEventListener('draft-queue-updated', handleDraftCustomEvent);
        window.removeEventListener('orders-updated', handleDraftCustomEvent);
        window.removeEventListener('options:search', handleSearchEvent);
        window.removeEventListener('options:navigate', handleSearchEvent);
      }
    };
  }, []);

  const handleToggleQueue = async () => {
    const nextVal = !isQueueEnabled;
    setIsQueueEnabled(nextVal);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ draft_queue_enabled: nextVal, draft_queue_updated_at: Date.now() });
    }
    try { localStorage.setItem('draft_queue_enabled', String(nextVal)); } catch (_) {}
  };

  const loadOrders = async (forceSync = false) => {
    if (forceSync) {
      setLoading(true);
      setIsSyncing(true);
    }
    try {
      if (forceSync && typeof OrderStorage._invalidateOrdersCache === 'function') {
        OrderStorage._invalidateOrdersCache();
      }
      if (activeTab === 'draft') {
        const all = await OrderStorage.getOrders(forceSync).catch(() => []);
        // Lọc chính xác các đơn nháp chưa lên đơn và chưa có mã vận đơn
        const drafts = (all || []).filter(o => o && !o.submittedAt && !o.trackingCode && !o.tracking_code);
        setOrders(drafts);
        if (forceSync) {
          setSyncStatus(`Đã đồng bộ ${drafts.length} đơn nháp`);
          setTimeout(() => setSyncStatus(''), 3000);
        }
      } else {
        const data = await OrderStorage.getSubmittedOrders().catch(() => []);
        setOrders(data || []);
        if (forceSync) {
          setSyncStatus(`Đã đồng bộ ${data.length} đơn đã gửi`);
          setTimeout(() => setSyncStatus(''), 3000);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải đơn hàng:", err);
      if (forceSync) {
        setSyncStatus('Lỗi: ' + (err.message || err));
        setTimeout(() => setSyncStatus(''), 4000);
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa đơn hàng này?')) return;
    try {
      if (activeTab === 'draft') {
        await OrderStorage.deleteOrder(id);
      } else {
        await OrderStorage.deleteSubmittedOrder(id);
      }
      setOrders(prev => prev.filter(o => o.id !== id));
      if (typeof chrome !== 'undefined') {
        if (chrome.storage?.local) {
          await chrome.storage.local.set({ draft_queue_updated_at: Date.now() });
        }
        if (chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'draftOrdersUpdated' }).catch(() => {});
        }
      }
      try {
        window.dispatchEvent(new CustomEvent('draft-queue-updated'));
      } catch (_) {}
    } catch (err) {
      alert('Lỗi khi xóa: ' + err.message);
    }
  };

  const handleClearAllDrafts = async () => {
    if (!orders.length) return;
    if (!confirm(`Bạn có chắc muốn xóa sạch toàn bộ ${orders.length} đơn nháp khỏi hàng đợi?`)) return;
    try {
      const ids = orders.map(o => o.id).filter(Boolean);
      if (typeof OrderStorage.deleteBulkOrders === 'function') {
        await OrderStorage.deleteBulkOrders(ids);
      } else {
        for (const id of ids) {
          await OrderStorage.deleteOrder(id);
        }
      }
      setOrders([]);
      if (typeof chrome !== 'undefined') {
        if (chrome.storage?.local) {
          await chrome.storage.local.set({ draft_queue_updated_at: Date.now() });
        }
        if (chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'draftOrdersUpdated', count: 0 }).catch(() => {});
        }
      }
      try {
        window.dispatchEvent(new CustomEvent('draft-queue-updated', { detail: { count: 0 } }));
      } catch (_) {}
      alert('✅ Đã xóa sạch toàn bộ đơn nháp khỏi hàng đợi!');
    } catch (err) {
      alert('Lỗi khi dọn hàng đợi: ' + err.message);
    }
  };

  const handleMarkSubmitted = async (order) => {
    const code = prompt(`Nhập mã vận đơn bưu cục cho đơn của ${order.name || order.phone || 'khách này'} (để trống nếu không có):`, '');
    if (code === null) return;
    try {
      const submittedData = {
        ...order,
        trackingCode: code.trim() || '—',
        submittedAt: new Date().toISOString()
      };
      await OrderStorage.saveSubmittedOrder(submittedData);
      await OrderStorage.deleteOrder(order.id);
      setOrders(prev => prev.filter(o => o.id !== order.id));
      alert('✅ Đã chuyển đơn sang danh sách "Đơn hàng đã gửi" thành công!');
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true;
    const cleanQ = removeVietnameseTones(search);
    const qDigits = normalizePhone(search);
    const phone = normalizePhone(o.parsedData?.phone || o.phone || '');
    const name = removeVietnameseTones(o.parsedData?.name || o.name || '');
    const addr = removeVietnameseTones(o.parsedData?.address || o.address || '');
    const orderCode = String(o.parsedData?.orderCode || o.orderCode || '').toLowerCase();

    const matchName = name.includes(cleanQ);
    const matchPhone = qDigits.length >= 3 && (phone.includes(qDigits) || phone.endsWith(qDigits));
    const matchAddr = addr.includes(cleanQ);
    const matchCode = orderCode.includes(search.toLowerCase().trim());
    return matchName || matchPhone || matchAddr || matchCode;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: '4px' }}>Quản lý Hàng Đợi & Đơn Nháp</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
            Xem, chỉnh sửa, gán mã vận đơn cho đơn đã lên tay, hoặc dọn sạch các đơn nháp đang chờ điền trên bưu cục.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleQueue}
            style={{
              padding: '8px 14px',
              background: isQueueEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
              color: isQueueEnabled ? '#059669' : '#64748b',
              border: `1px solid ${isQueueEnabled ? '#a7f3d0' : '#cbd5e1'}`,
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            title="Bật hoặc Tắt hiển thị Hàng đợi đơn nháp trên Panel tiện ích"
          >
            {isQueueEnabled ? '📥 Hàng đợi trên Panel: BẬT' : '⏸️ Hàng đợi trên Panel: TẮT'}
          </button>
          <button
            onClick={() => loadOrders(true)}
            disabled={isSyncing}
            style={{
              padding: '8px 14px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            title="Làm mới & Đồng bộ đơn mới nhất từ Supabase Cloud"
          >
            <span style={{ display: 'inline-block', transform: isSyncing ? 'rotate(360deg)' : 'none', transition: isSyncing ? 'transform 0.8s linear infinite' : 'none' }}>🔄</span>
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud'}
          </button>
          {syncStatus && (
            <span style={{ fontSize: '12px', color: syncStatus.startsWith('Lỗi') ? '#dc2626' : '#059669', fontWeight: 500 }}>
              {syncStatus}
            </span>
          )}
          <input 
            type="text" 
            placeholder="Tìm theo tên, SĐT, mã đơn, địa chỉ..."
            value={search}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              if (typeof window !== 'undefined') window.__af_global_search = val;
            }}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '220px', fontSize: '13px' }}
          />
          {activeTab === 'draft' && orders.length > 0 && (
            <button
              onClick={handleClearAllDrafts}
              style={{
                padding: '8px 14px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Xóa toàn bộ các đơn nháp đang nằm trong hàng đợi"
            >
              🧹 Xóa Toàn Bộ ({orders.length})
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('draft')}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'draft' ? 700 : 500,
            color: activeTab === 'draft' ? 'var(--primary)' : 'var(--text-muted)',
            padding: '4px 8px', borderRadius: '4px'
          }}
        >
          📥 Hàng đợi đơn nháp ({activeTab === 'draft' ? orders.length : '...'})
        </button>
        <button 
          onClick={() => setActiveTab('submitted')}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === 'submitted' ? 700 : 500,
            color: activeTab === 'submitted' ? 'var(--success)' : 'var(--text-muted)',
            padding: '4px 8px', borderRadius: '4px'
          }}
        >
          ✅ Đã lên đơn ({activeTab === 'submitted' ? orders.length : '...'})
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {activeTab === 'draft' ? 'Không có đơn nháp nào trong hàng đợi.' : 'Không có đơn hàng nào.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Thời gian</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Khách hàng</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Địa chỉ</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Tiền COD</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const cod = Number(order.codAmount || order.cod_amount || order.cod || 0);
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{order.parsedData?.name || order.name || 'Khách lẻ'}</div>
                      <div style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 500 }}>{order.parsedData?.phone || order.phone || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', maxWidth: '300px' }}>
                      {order.parsedData?.address || order.address || order.rawText || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: cod > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {cod > 0 ? `${cod.toLocaleString('vi-VN')} đ` : '0 đ (Miễn thu)'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {activeTab === 'draft' && (
                          <button 
                            onClick={() => handleMarkSubmitted(order)}
                            style={{ 
                              background: '#ecfdf5', 
                              border: '1px solid #a7f3d0', 
                              color: '#059669', 
                              padding: '5px 10px', 
                              borderRadius: '5px', 
                              fontSize: '12px', 
                              fontWeight: 600, 
                              cursor: 'pointer' 
                            }}
                            title="Đánh dấu đơn này đã lên bằng tay và nhập mã vận đơn"
                          >
                            ✓ Đã lên đơn
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(order.id)}
                          style={{ 
                            background: '#fee2e2', 
                            border: '1px solid #fecdd3', 
                            color: '#dc2626', 
                            padding: '5px 10px', 
                            borderRadius: '5px', 
                            fontSize: '12px', 
                            fontWeight: 600, 
                            cursor: 'pointer' 
                          }}
                          title="Xóa đơn này"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
