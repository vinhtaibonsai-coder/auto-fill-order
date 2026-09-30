import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PackageSearch, RefreshCw, Eye, ExternalLink, Copy, Check, 
  MapPin, Phone, User, Store, Calendar, DollarSign, Truck, FileText, Info,
  ShieldCheck, Laptop, Clock
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import FilterBar from '../../components/FilterBar';
import Pagination from '../../components/Pagination';
import { SkeletonTableRows } from '../../components/Skeleton';
import OrderTimelineDrawer from '../../../options/components/OrderTimelineDrawer';

export default function GlobalOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [shopsList, setShopsList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [timelineOrder, setTimelineOrder] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Load danh sách shops cho dropdown filter
  useEffect(() => {
    AdminService.getShopsList().then(res => {
      if (res.success && Array.isArray(res.data)) {
        setShopsList(res.data);
      }
    });
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AdminService.getGlobalOrders({
        search,
        shopId: shopFilter || null,
        platform: platformFilter || null,
        source: sourceFilter || null,
        limit: pageSize,
        offset: (page - 1) * pageSize
      });
      if (res.success) {
        setOrders(res.data || []);
      } else {
        console.error('Fetch global orders error:', res.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, shopFilter, platformFilter, sourceFilter, page, pageSize]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const handleRefresh = (e) => {
      const table = e?.detail?.table;
      if (!table || table === 'submitted_orders' || table === 'orders') {
        loadOrders();
      }
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [loadOrders]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 1500);
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

  const shopOptions = useMemo(() => [
    { value: '', label: 'Tất cả Shop' },
    ...shopsList.map(s => ({ value: s.id, label: `${s.name} (${s.shop_code || 'N/A'})` }))
  ], [shopsList]);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PackageSearch size={22} color="#2563eb" />
            Tra Cứu Đơn Hàng Toàn Cục (Global Orders Explorer)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Kiểm toán vận hành hệ thống & đối soát mã vận đơn đa bưu cục. Tuân thủ nguyên tắc bảo mật: Không hiển thị PII khách hàng của Shop.
          </p>
        </div>

        <button
          onClick={loadOrders}
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
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Làm mới
        </button>
      </div>

      {/* Safety Banner */}
      <div style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: '#166534',
        fontSize: 12
      }}>
        <ShieldCheck size={18} color="#16a34a" style={{ flexShrink: 0 }} />
        <span>
          <strong>Chính sách cách ly dữ liệu khách hàng (Tenant PII Isolation):</strong> Màn hình này phục vụ kiểm toán kỹ thuật, mã vận đơn và điều phối bưu cục toàn nền tảng. Toàn bộ danh tính cá nhân (SĐT, Họ tên, Địa chỉ chi tiết của người mua) được bảo mật nghiêm ngặt và chỉ thuộc quyền truy cập riêng của từng Shop.
        </span>
      </div>

      {/* Filter Bar */}
      <FilterBar
        value={search}
        onSearch={val => { setSearch(val); setPage(1); }}
        placeholder="Tìm theo Mã đơn, Mã vận đơn, Tên Shop..."
        filters={[
          {
            key: 'shop',
            label: 'Shop',
            value: shopFilter,
            onChange: val => { setShopFilter(val); setPage(1); },
            options: shopOptions
          },
          {
            key: 'platform',
            label: 'Bưu cục',
            value: platformFilter,
            onChange: val => { setPlatformFilter(val); setPage(1); },
            options: [
              { value: '', label: 'Tất cả Bưu cục' },
              { value: 'VNPost', label: 'VNPost' },
              { value: 'J&T', label: 'J&T Express' },
              { value: 'ViettelPost', label: 'ViettelPost' },
              { value: 'GHTK', label: 'Giao Hàng Tiết Kiệm' }
            ]
          },
          {
            key: 'source',
            label: 'Nguồn',
            value: sourceFilter,
            onChange: val => { setSourceFilter(val); setPage(1); },
            options: [
              { value: '', label: 'Tất cả Nguồn' },
              { value: 'AUTO_FILL', label: 'Tự động (Auto Fill)' },
              { value: 'MANUAL', label: 'Thủ công (Manual)' },
              { value: 'BATCH', label: 'Nhập hàng loạt' },
              { value: 'API', label: 'API Kết nối' }
            ]
          }
        ]}
      />

      {/* Orders Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '12px 16px' }}>Mã đơn / Vận đơn</th>
                <th style={{ padding: '12px 16px' }}>Cửa hàng (Shop)</th>
                <th style={{ padding: '12px 16px' }}>Tuyến phát / Điểm đến</th>
                <th style={{ padding: '12px 16px' }}>Bưu cục</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tiền COD</th>
                <th style={{ padding: '12px 16px' }}>Nguồn & Thiết bị</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows columns={7} rows={6} />
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    <PackageSearch size={36} style={{ opacity: 0.5, margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>Không tìm thấy đơn hàng nào phù hợp với bộ lọc.</p>
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const orderKey = order.id || order.order_code;
                  return (
                    <tr key={orderKey} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                      {/* Mã đơn & Tracking */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{order.order_code || 'Chưa có mã'}</span>
                            {order.order_code && (
                              <button
                                onClick={() => copyToClipboard(order.order_code, `order_${orderKey}`)}
                                title="Copy mã đơn"
                                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#64748b' }}
                              >
                                {copiedCode === `order_${orderKey}` ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                              </button>
                            )}
                          </div>
                          {order.tracking_code ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2563eb' }}>
                              <span>MVĐ: {order.tracking_code}</span>
                              <button
                                onClick={() => copyToClipboard(order.tracking_code, `track_${orderKey}`)}
                                title="Copy mã vận đơn"
                                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#64748b' }}
                              >
                                {copiedCode === `track_${orderKey}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>Chưa có mã vận đơn</span>
                          )}
                        </div>
                      </td>

                      {/* Shop Info */}
                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          const matchedShop = shopsList.find(s => s.id === order.shop_id);
                          const shopName = (order.shop_name && order.shop_name !== 'Shop') ? order.shop_name : (matchedShop?.name || order.shop_name || 'Shop');
                          const shopCode = order.shop_code || matchedShop?.shop_code;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Store size={14} color="#64748b" />
                              <div>
                                <div style={{ fontWeight: 600, color: '#334155' }}>{shopName}</div>
                                {shopCode && <div style={{ fontSize: 11, color: '#64748b' }}>#{shopCode}</div>}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Tuyến phát / Điểm đến (Bảo mật PII - chỉ hiển thị Tỉnh/Thành nhận hàng) */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={15} color="#0284c7" />
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {order.destination_region || 'Chưa phân tuyến'}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Tỉnh / Thành phố nhận</div>
                          </div>
                        </div>
                      </td>

                      {/* Platform */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: order.platform?.toUpperCase().includes('VNPOST') ? '#eff6ff' : '#fff7ed',
                          color: order.platform?.toUpperCase().includes('VNPOST') ? '#1d4ed8' : '#c2410c'
                        }}>
                          {order.platform || 'Chưa xác định'}
                        </span>
                      </td>

                      {/* COD Amount */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: Number(order.cod_amount) > 0 ? '#059669' : '#64748b' }}>
                          {formatVND(order.cod_amount)}
                        </span>
                      </td>

                      {/* Source & Device */}
                      <td style={{ padding: '12px 16px' }}>
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            background: order.source === 'AUTO_FILL' ? '#f0fdf4' : '#f8fafc',
                            color: order.source === 'AUTO_FILL' ? '#166534' : '#475569',
                            border: '1px solid #e2e8f0'
                          }}>
                            {order.source || 'AUTO_FILL'}
                          </span>
                          {order.device_name && (
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Laptop size={11} color="#64748b" />
                              <span>{order.device_name}</span>
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {formatDate(order.created_at)}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 10px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={14} /> Chi tiết
                        </button>
                        <button
                          onClick={() => setTimelineOrder(order)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 10px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#0f172a',
                            cursor: 'pointer',
                            marginLeft: 6
                          }}
                          title="Xem toàn bộ nhật ký vòng đời (Order Event Timeline)"
                        >
                          <Clock size={13} /> Nhật ký
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '0 16px', borderTop: '1px solid #e2e8f0' }}>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={orders[0]?.total_count ? Number(orders[0].total_count) : orders.length}
            onPageChange={setPage}
            onPageSizeChange={newPageSize => { setPageSize(newPageSize); setPage(1); }}
          />
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedOrder && (
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
            maxWidth: 680,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PackageSearch size={18} color="#2563eb" />
                  Chi Tiết Đơn Hàng (Kiểm Toán Hệ Thống)
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Mã hệ thống: {selectedOrder.id}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gap: 16, fontSize: 13 }}>
              {/* Alert Read-Only */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#1e40af',
                fontSize: 12
              }}>
                <Info size={16} />
                <span>Màn hình kiểm toán dữ liệu chỉ đọc (Read-Only). Mọi điều chỉnh đơn hàng trực tiếp chỉ thuộc thẩm quyền của Chủ Shop.</span>
              </div>

              {/* Grid 2 Cột */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {/* Thông tin đơn */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={15} color="#2563eb" /> Thông Tin Đơn Hàng
                  </div>
                  <div style={{ display: 'grid', gap: 6, color: '#334155' }}>
                    <div><strong>Mã đơn hàng:</strong> {selectedOrder.order_code || 'Không có'}</div>
                    <div><strong>Mã vận đơn:</strong> {selectedOrder.tracking_code || 'Chưa tạo'}</div>
                    <div><strong>Bưu cục:</strong> {selectedOrder.platform || '-'}</div>
                    <div><strong>Tiền COD:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>{formatVND(selectedOrder.cod_amount)}</span></div>
                    <div><strong>Nguồn tạo:</strong> {selectedOrder.source || 'AUTO_FILL'}</div>
                    <div><strong>Ngày tạo:</strong> {formatDate(selectedOrder.created_at)}</div>
                  </div>
                </div>

                {/* Thông tin Shop */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={15} color="#2563eb" /> Shop Sở Hữu
                  </div>
                  <div style={{ display: 'grid', gap: 6, color: '#334155' }}>
                    <div><strong>Tên Shop:</strong> {selectedOrder.shop_name || '-'}</div>
                    <div><strong>Mã Shop:</strong> {selectedOrder.shop_code ? `#${selectedOrder.shop_code}` : '-'}</div>
                    <div><strong>Shop ID:</strong> <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{selectedOrder.shop_id}</span></div>
                  </div>
                </div>
              </div>

              {/* Tuyến phát & Điều phối bưu cục (Bảo vệ thông tin cá nhân khách hàng) */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={15} color="#2563eb" /> Tuyến Giao Hàng & Điều Phối Bưu Cục
                </div>
                <div style={{ display: 'grid', gap: 6, color: '#334155' }}>
                  <div><strong>Điểm đến (Tỉnh/Thành):</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedOrder.destination_region || 'Chưa phân tuyến'}</span></div>
                  <div><strong>Đơn vị vận chuyển:</strong> {selectedOrder.platform || 'Chưa xác định'}</div>
                  <div><strong>Trạng thái:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 600, color: '#2563eb' }}>{selectedOrder.status || 'SUCCESS'}</span></div>
                  <div><strong>Thiết bị gửi:</strong> {selectedOrder.device_name || 'Extension Web'}</div>
                </div>
              </div>

              {/* Privacy Notice Banner */}
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                color: '#475569',
                fontSize: 12
              }}>
                <ShieldCheck size={18} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Nguyên Tắc Bảo Mật Dữ Liệu Khách Hàng (Multi-Tenant PII Protection):</strong>
                  <div style={{ marginTop: 4, lineHeight: 1.5 }}>
                    Để bảo vệ quyền riêng tư của khách hàng và tính bảo mật độc quyền của từng Shop, thông tin danh tính cá nhân (Họ tên, Số điện thoại cá nhân, Số nhà) không được tổng hợp trên trang Quản trị toàn cục. Quản trị viên chỉ đối soát mã đơn, mã vận đơn và thông số bưu cục kỹ thuật.
                  </div>
                </div>
              </div>

              {/* Raw JSON Inspect */}
              {selectedOrder.payload && (
                <details style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Xem Raw Metadata (Kỹ thuật)</summary>
                  <pre style={{ marginTop: 8, padding: 8, background: '#ffffff', borderRadius: 4, overflowX: 'auto', fontSize: 11 }}>
                    {(() => {
                      const cleanPayload = { ...selectedOrder.payload };
                      if (cleanPayload.phone) cleanPayload.phone = '***' + String(cleanPayload.phone).slice(-3);
                      if (cleanPayload.customer_name) cleanPayload.customer_name = '*** (PII Masked)';
                      if (cleanPayload.name) cleanPayload.name = '*** (PII Masked)';
                      if (cleanPayload.address) cleanPayload.address = selectedOrder.destination_region ? `***, ${selectedOrder.destination_region}` : '*** (Masked)';
                      return JSON.stringify(cleanPayload, null, 2);
                    })()}
                  </pre>
                </details>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#f8fafc'
            }}>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: '8px 18px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {timelineOrder && (
        <OrderTimelineDrawer
          orderId={timelineOrder.id || timelineOrder.order_id}
          orderCode={timelineOrder.order_code || timelineOrder.orderCode}
          onClose={() => setTimelineOrder(null)}
        />
      )}
    </div>
  );
}
