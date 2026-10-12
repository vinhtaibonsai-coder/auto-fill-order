import React, { useState, useEffect } from 'react';
import { 
  X, Truck, MapPin, Phone, User, ExternalLink, 
  RefreshCw, CheckCircle2, Clock, AlertCircle, 
  ArrowUpRight, Copy, Check
} from 'lucide-react';
import { copyToClipboard } from '../../index/clipboard.js';

export default function CarrierJourneyDrawer({
  isOpen,
  onClose,
  order
}) {
  const [loading, setLoading] = useState(false);
  const [journeyData, setJourneyData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const trackingCode = order?.tracking_code || order?.trackingCode || order?.itemCode || '';
  const orderCode = order?.order_code || order?.orderCode || '';
  const carrier = String(order?.carrier || order?.platform || 'VNPOST').toUpperCase();
  const isVnpost = carrier.includes('VNPOST') || (!carrier.includes('J&T') && !carrier.includes('JT'));

  const handleCopy = async (text, key) => {
    if (!text) return;
    const ok = await copyToClipboard(String(text).trim());
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    }
  };

  useEffect(() => {
    if (isOpen && trackingCode && isVnpost) {
      loadVNPostJourney();
    } else if (isOpen) {
      setJourneyData(null);
      setErrorMsg('');
    }
  }, [isOpen, trackingCode]);

  async function loadVNPostJourney() {
    setLoading(true);
    setErrorMsg('');
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        throw new Error('Chưa hỗ trợ extension API.');
      }

      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ url: "*://my.vnpost.vn/*" }, resolve);
      });

      if (!tabs || tabs.length === 0) {
        setErrorMsg('Chưa mở tab my.vnpost.vn trên trình duyệt. Bạn có thể bấm nút "Mở trên MyVNPost" bên dưới.');
        setLoading(false);
        return;
      }

      const targetTab = tabs[0];
      const res = await new Promise(resolve => {
        chrome.tabs.sendMessage(targetTab.id, {
          action: 'VNPOST_FETCH_JOURNEY_VIA_WEB',
          code: trackingCode || orderCode
        }, response => {
          if (chrome.runtime?.lastError) {
            resolve({
              success: false,
              error: 'Không thể kết nối với tab MyVNPost (Tab mở từ trước). Hãy F5 lại tab my.vnpost.vn rồi thử lại!'
            });
            return;
          }
          resolve(response || { success: false, error: 'Không nhận được dữ liệu từ VNPost.' });
        });
      });

      if (res && res.success) {
        setJourneyData(res);
      } else {
        setErrorMsg(res?.error || 'Không tìm thấy dữ liệu hành trình trên VNPost.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi tra cứu hành trình.');
    } finally {
      setLoading(false);
    }
  }

  // Tự động mở trang MyVNPost và bung popup hành trình
  const handleOpenMyVNPost = async () => {
    const code = trackingCode || orderCode;
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      window.open(`https://my.vnpost.vn/manage/order-manager`, '_blank');
      return;
    }

    // 1. Kiểm tra xem đã có tab my.vnpost.vn nào chưa
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ url: "*://my.vnpost.vn/*" }, resolve);
    });

    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      // Focus vào tab
      chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true });

      // Gửi lệnh tự động điền và mở popup
      chrome.tabs.sendMessage(tab.id, {
        action: 'VNPOST_AUTO_OPEN_JOURNEY_MODAL',
        code
      }, () => {});
    } else {
      // Mở tab mới
      chrome.tabs.create({
        url: `https://my.vnpost.vn/manage/order-manager`
      }, (newTab) => {
        // Đợi 2.5s trang load rồi trigger
        setTimeout(() => {
          chrome.tabs.sendMessage(newTab.id, {
            action: 'VNPOST_AUTO_OPEN_JOURNEY_MODAL',
            code
          }, () => {});
        }, 2800);
      });
    }
  };

  if (!isOpen || !order) return null;

  const rawOrder = journeyData?.order || {};
  const traces = Array.isArray(journeyData?.traces) ? journeyData.traces : [];
  const senderPostOffice = rawOrder?.senderPostOfficeName || rawOrder?.postOfficeName || 'Bưu cục thu gom';
  const shipperName = rawOrder?.shipperName || rawOrder?.deliveryStaffName || journeyData?.detail?.deliveryStaffName || '';
  const shipperPhone = rawOrder?.shipperPhone || rawOrder?.deliveryStaffPhone || journeyData?.detail?.deliveryStaffPhone || '';
  const currentStatus = rawOrder?.orderStatusName || rawOrder?.statusName || order?.status || 'Bưu tá nhận yêu cầu';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        height: '100%',
        background: 'var(--bg-main, #ffffff)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={20} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Hành Trình Vận Đơn {isVnpost ? 'VNPost' : 'J&T'}
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Mã: <strong>{trackingCode || orderCode || '—'}</strong></span>
              {trackingCode && (
                <button
                  type="button"
                  onClick={() => handleCopy(trackingCode, 'hdr_track')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedKey === 'hdr_track' ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                  <span>{copiedKey === 'hdr_track' ? 'Đã chép' : 'Chép'}</span>
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div style={{
          padding: '10px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={loadVNPostJourney}
            disabled={loading}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
            <span>Tải lại</span>
          </button>

          <button
            type="button"
            onClick={handleOpenMyVNPost}
            style={{
              background: '#f59e0b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)'
            }}
            title="Tự động mở tab MyVNPost và bung popup hành trình gốc"
          >
            <ExternalLink size={13} />
            <span>Mở trên MyVNPost ↗</span>
          </button>
        </div>

        {/* Shipper & Delivery Contact Card */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Bưu tá phát hàng:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {shipperName || 'Đang cập nhật'}
              </span>
              {shipperPhone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <a
                    href={`tel:${shipperPhone}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    <Phone size={10} /> {shipperPhone}
                  </a>
                </div>
              )}
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Trạng thái vận chuyển:</span>
              <span style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#2563eb',
                lineHeight: 1.3
              }}>
                {currentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Journey Timeline Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
              <RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto 8px', color: '#4f46e5' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Đang kết nối phiên MyVNPost và lấy hành trình...</div>
            </div>
          ) : errorMsg ? (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '10px',
              padding: '14px',
              textAlign: 'center'
            }}>
              <AlertCircle size={28} color="#d97706" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                Thông báo kết nối MyVNPost
              </div>
              <div style={{ fontSize: '12px', color: '#b45309', lineHeight: 1.5, marginBottom: '12px' }}>
                {errorMsg}
              </div>
              <button
                type="button"
                onClick={handleOpenMyVNPost}
                style={{
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ExternalLink size={13} />
                <span>Mở tự động trên MyVNPost ↗</span>
              </button>
            </div>
          ) : traces.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
              <Clock size={28} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Chưa có sự kiện hành trình nào được ghi nhận.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px', position: 'relative' }}>
              {traces.map((trace, idx) => {
                const isFirst = idx === 0;
                const statusDate = trace.statusDate || trace.eventDate || trace.date || trace.created_at;
                const statusName = trace.statusName || trace.action || trace.status || 'Cập nhật trạng thái';
                const location = trace.location || trace.postOfficeName || trace.address || '';
                const note = trace.note || trace.description || '';

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      position: 'relative'
                    }}
                  >
                    {/* Bullet line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: isFirst ? '#10b981' : '#cbd5e1',
                        border: isFirst ? '2px solid #a7f3d0' : '2px solid #ffffff',
                        boxShadow: isFirst ? '0 0 0 2px #10b981' : 'none',
                        flexShrink: 0
                      }} />
                      {idx < traces.length - 1 && (
                        <div style={{
                          width: '2px',
                          flex: 1,
                          background: '#e2e8f0',
                          marginTop: '4px'
                        }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{
                      flex: 1,
                      background: isFirst ? '#f0fdf4' : '#ffffff',
                      border: isFirst ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '12.5px',
                          fontWeight: 700,
                          color: isFirst ? '#15803d' : '#1e293b'
                        }}>
                          {statusName}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                          {statusDate ? new Date(statusDate).toLocaleString('vi-VN') : ''}
                        </span>
                      </div>

                      {location && (
                        <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <MapPin size={12} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{location}</span>
                        </div>
                      )}

                      {note && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                          Ghi chú: {note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '12px 16px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Bấm <strong>Mở trên MyVNPost</strong> để xem bản đồ chi tiết.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
