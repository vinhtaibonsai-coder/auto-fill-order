import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudUpload, RefreshCw, CheckCircle2, AlertCircle, Clock, Database, Radio, Wifi, Zap, Check, ArrowUpRight } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { OrderStorage } from '../../../../application/storage.esm.js';

export default function SyncSettings() {
  const [outbox, setOutbox] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('Đang kiểm tra...');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState('');
  const [activeShopName, setActiveShopName] = useState('');
  const [localOrdersCount, setLocalOrdersCount] = useState(0);
  const [cloudOrdersCount, setCloudOrdersCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (sess?.active_shop_name) setActiveShopName(sess.active_shop_name);

      // 1. Đếm đơn cục bộ
      try {
        if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getSubmittedOrders === 'function') {
          const localOrders = await OrderStorage.getSubmittedOrders().catch(() => []);
          setLocalOrdersCount(Array.isArray(localOrders) ? localOrders.length : 0);
        }
      } catch (_) {}

      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        setSyncStatus('Chưa đăng nhập Shop');
        return;
      }

      // 2. Tải Outbox và Đếm đơn Cloud
      const [outboxRes, cloudCountRes] = await Promise.all([
        fetch(
          `${configRes.url}/rest/v1/sync_outbox?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&limit=20&select=id,operation,table_name,status,error_message,created_at`,
          {
            headers: {
              apikey: configRes.anonKey,
              Authorization: `Bearer ${sess.access_token}`
            }
          }
        ),
        fetch(
          `${configRes.url}/rest/v1/submitted_orders?shop_id=eq.${sess.active_shop_id}&select=id`,
          {
            headers: {
              apikey: configRes.anonKey,
              Authorization: `Bearer ${sess.access_token}`,
              'Range-Unit': 'items',
              'Prefer': 'count=exact'
            }
          }
        )
      ]);

      if (outboxRes.ok) {
        const rows = await outboxRes.json();
        setOutbox(rows || []);
        setSyncStatus('Đang kết nối');
        setLastSyncTime(new Date());
      } else {
        setSyncStatus('Không truy cập được Cloud');
      }

      if (cloudCountRes.ok) {
        const countHeader = cloudCountRes.headers.get('content-range');
        if (countHeader) {
          const total = countHeader.split('/')[1];
          if (total && !isNaN(Number(total))) setCloudOrdersCount(Number(total));
        } else {
          const data = await cloudCountRes.json();
          setCloudOrdersCount(Array.isArray(data) ? data.length : 0);
        }
      }
    } catch (err) {
      console.error('Lỗi tải sync outbox:', err);
      setSyncStatus('Không truy cập được Cloud');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      loadData();
      setIsSyncing(false);
    }, 600);
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('vi-VN');
    } catch (_) {
      return '';
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') {
      return { label: 'ĐANG CHỜ', bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' };
    }
    if (s === 'FAILED') {
      return { label: 'THẤT BẠI', bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' };
    }
    return { label: 'ĐÃ ĐỒNG BỘ', bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' };
  };

  const handlePushAllToCloud = async () => {
    if (!confirm('Bạn có chắc muốn đẩy toàn bộ đơn hàng lưu trên máy tính này lên Cloud cho Cửa hàng hiện tại?')) return;
    setIsPushing(true);
    setPushStatus('Đang chuẩn bị kết nối Cloud...');
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud.loadConfig();
      if (!sess?.active_shop_id || !sess?.access_token || !config?.url || !config?.anonKey) {
        alert('Vui lòng đăng nhập tài khoản và chọn Cửa hàng trước khi đẩy lên Cloud.');
        setIsPushing(false);
        setPushStatus('');
        return;
      }
      const localOrders = (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getSubmittedOrders === 'function')
        ? await OrderStorage.getSubmittedOrders().catch(() => [])
        : [];
      if (!localOrders || localOrders.length === 0) {
        alert('Không tìm thấy đơn hàng cục bộ nào trên máy tính.');
        setIsPushing(false);
        setPushStatus('');
        return;
      }

      setPushStatus(`Đang đẩy ${localOrders.length} đơn hàng lên Cloud cho Shop ${sess.active_shop_name || activeShopName || ''}...`);

      const headers = {
        apikey: config.anonKey,
        Authorization: `Bearer ${sess.access_token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      };

      const batchSize = 25;
      let successCount = 0;
      for (let i = 0; i < localOrders.length; i += batchSize) {
        const chunk = localOrders.slice(i, i + batchSize);
        const rowsToInsert = chunk.map(o => ({
          shop_id: sess.active_shop_id,
          order_code: o.orderCode || o.order_code || null,
          tracking_code: o.trackingCode || o.tracking_code || null,
          name: o.name || o.customer_name || 'Khách hàng',
          customer_name: o.name || o.customer_name || 'Khách hàng',
          phone: String(o.phone || '').replace(/\D/g, ''),
          address: o.address || '',
          cod_amount: Number(o.codAmount ?? o.cod_amount ?? o.cod ?? 0),
          platform: o.platform || o.carrier || 'VNPost',
          carrier_account: o.carrierAccount || o.carrier_account || null,
          status: o.status || 'submitted',
          submitted_at: o.submittedAt || o.submitted_at || o.createdAt || new Date().toISOString()
        })).filter(r => r.phone && r.phone.length >= 9);

        if (rowsToInsert.length > 0) {
          const res = await fetch(`${config.url}/rest/v1/submitted_orders`, {
            method: 'POST',
            headers,
            body: JSON.stringify(rowsToInsert)
          });
          if (res.ok) {
            successCount += rowsToInsert.length;
          }
        }
        setPushStatus(`Đang đồng bộ: ${Math.min(i + batchSize, localOrders.length)} / ${localOrders.length} đơn...`);
      }

      setPushStatus(`🎉 Thành công! Đã đồng bộ ${successCount} đơn hàng lên Cloud cho Shop.`);
      loadData();
      setTimeout(() => {
        setIsPushing(false);
        setPushStatus('');
      }, 4000);
    } catch (err) {
      alert('Lỗi đồng bộ lên Cloud: ' + err.message);
      setIsPushing(false);
      setPushStatus('');
    }
  };

  const isConnected = syncStatus === 'Đang kết nối';

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Trung Tâm Đồng Bộ Dữ Liệu</h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 13 }}>
          Quản lý luồng truyền dữ liệu hai chiều giữa máy trạm cá nhân và Máy chủ Đám mây (Supabase Cloud).
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* KPI 1 */}
        <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>ĐƠN TRÊN CLOUD</span>
            <Database size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '8px' }}>
            {cloudOrdersCount.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>đơn</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Đã đồng bộ vào cơ sở dữ liệu chung
          </div>
        </div>

        {/* KPI 2 */}
        <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>ĐƠN TRÊN MÁY NÀY</span>
            <CloudUpload size={16} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
            {localOrdersCount.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>đơn</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Lưu trong bộ nhớ cục bộ máy trạm
          </div>
        </div>

        {/* KPI 3 */}
        <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>TRẠNG THÁI KẾT NỐI</span>
            <Radio size={16} color={isConnected ? 'var(--success)' : 'var(--warning)'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isConnected ? 'var(--success)' : 'var(--warning)' }}></div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: isConnected ? 'var(--success)' : 'var(--warning)' }}>
              {syncStatus}
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Supabase REST & Realtime Socket
          </div>
        </div>

        {/* KPI 4 */}
        <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
            <span>LẦN ĐỒNG BỘ CUỐI</span>
            <Clock size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '10px' }}>
            {lastSyncTime ? lastSyncTime.toLocaleTimeString('vi-VN') : 'Vừa xong'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lastSyncTime ? lastSyncTime.toLocaleDateString('vi-VN') : 'Tự động nền'}
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '20px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Push Action & Outbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Cloud Push Action Banner */}
          <div className="card" style={{
            padding: '22px',
            borderRadius: '12px',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            background: 'var(--primary-light)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ maxWidth: '420px' }}>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 800 }}>
                  <CloudUpload size={18} /> Đẩy Toàn Bộ Đơn Cục Bộ Lên Cloud
                </h3>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  Đưa toàn bộ đơn hàng đang lưu trên máy tính lên Máy chủ Cloud của <strong>{activeShopName || 'Cửa hàng hiện tại'}</strong> để liên kết với Sổ Bạ Khách Hàng (CRM 360).
                </p>
              </div>
              <button
                onClick={handlePushAllToCloud}
                disabled={isPushing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isPushing ? 'default' : 'pointer',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                }}
              >
                {isPushing ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                {isPushing ? 'Đang đồng bộ...' : 'Đẩy toàn bộ đơn lên Cloud'}
              </button>
            </div>
            {pushStatus && (
              <div style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                fontSize: '12.5px',
                fontWeight: 600
              }}>
                {pushStatus}
              </div>
            )}
          </div>

          {/* Outbox Table */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Hàng Chờ Đồng Bộ Ngoại Tuyến (Outbox)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                  Các thay đổi khi mất mạng sẽ được xếp hàng an toàn tại đây và tự động gửi lên khi có kết nối.
                </p>
              </div>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                style={{
                  background: 'var(--bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: isSyncing ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
                {isSyncing ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>Thời gian</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>Hành động</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Đang tải dữ liệu hàng chờ...
                      </td>
                    </tr>
                  ) : outbox.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <CheckCircle2 size={24} color="var(--success)" style={{ margin: '0 auto 6px', display: 'block', opacity: 0.8 }} />
                        <div>Không có dữ liệu chờ đồng bộ. Tất cả đã được đẩy lên Cloud an toàn!</div>
                      </td>
                    </tr>
                  ) : outbox.map((item, i) => {
                    const badge = getStatusBadge(item.status);
                    return (
                      <tr key={item.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>{formatTime(item.created_at)}</td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-main)' }}>
                          <strong>{item.operation}</strong> {item.table_name}
                          {item.error_message && <div style={{ fontSize: '11px', color: 'var(--danger)' }}>{item.error_message}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                            background: badge.bg,
                            color: badge.color
                          }}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Diagnostics & Architecture Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Realtime Channel Card */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wifi size={16} color="var(--primary)" /> Thông Số Đường Truyền
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cơ chế đồng bộ:</span>
                <strong style={{ color: 'var(--text-main)' }}>Hai chiều (Two-way Sync)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mã hóa dữ liệu:</span>
                <strong style={{ color: 'var(--success)' }}>TLS 1.3 / HTTPS</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phân mảnh gói tin:</span>
                <strong>25 đơn / Batch</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Xử lý trùng lặp:</span>
                <strong style={{ color: 'var(--primary)' }}>Merge-Duplicates</strong>
              </div>
            </div>
          </div>

          {/* Sync Policy Info */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--warning)" /> Chính Sách Bảo Toàn Dữ Liệu
            </h3>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
              <li>
                <strong>Offline-First:</strong> Khi mất mạng đột ngột, đơn hàng vẫn được lưu trong máy và tiếp tục lên đơn bình thường.
              </li>
              <li>
                <strong>Tự động Retry:</strong> Tiện ích tự động thử kết nối lại mỗi 30 giây khi phát hiện mạng internet khôi phục.
              </li>
              <li>
                <strong>Không mất đơn:</strong> Mã đơn và mã vận đơn được khóa chống ghi đè nhầm lẫn giữa các máy trạm.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}