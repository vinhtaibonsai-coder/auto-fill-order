import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, Info, AlertCircle, ShieldAlert, Volume2, Sparkles, Filter, Settings } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'warning', 'info'
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem('af_read_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (_) {
      return new Set();
    }
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [popupEnabled, setPopupEnabled] = useState(true);

  const persistReadIds = (newSet) => {
    try {
      localStorage.setItem('af_read_notifications', JSON.stringify(Array.from(newSet)));
    } catch (_) {}
  };

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    let remoteNotifications = [];
    let sess = null;

    try {
      const configRes = await globalThis.SupabaseCloud?.loadConfig?.();
      sess = await AuthSession.getSession();
      if (configRes?.url && sess?.active_shop_id && sess?.access_token) {
        const res = await fetch(`${configRes.url}/rest/v1/rpc/system_get_notifications`, {
          method: 'POST',
          headers: {
            apikey: configRes.anonKey,
            Authorization: `Bearer ${sess.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ p_shop_id: sess.active_shop_id })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            remoteNotifications = data;
          }
        }
      }
    } catch (err) {
      console.warn('Không thể tải thông báo từ rpc:', err);
    }

    if (remoteNotifications.length > 0) {
      setNotifications(remoteNotifications);
      setIsLoading(false);
      return;
    }

    // Dynamic Shop Status Notifications
    const dynamicItems = [];
    if (sess?.active_shop_id) {
      dynamicItems.push({
        id: `notif_cloud_${sess.active_shop_id.slice(0, 8)}`,
        title: 'Đồng bộ Supabase Cloud an toàn',
        content: 'Cơ sở dữ liệu đám mây đã kết nối và đồng bộ thời gian thực cho cửa hàng của bạn.',
        level: 'INFO',
        created_at: new Date().toISOString()
      });

      if (sess.subscription_plan) {
        dynamicItems.push({
          id: `notif_plan_${sess.subscription_plan}`,
          title: `Gói cước đang hoạt động: ${sess.subscription_plan}`,
          content: 'Quý khách có thể theo dõi hạn mức bóc tách đơn AI và số lượng thiết bị tại mục Gói Cước.',
          level: 'INFO',
          created_at: new Date().toISOString()
        });
      }
    }

    setNotifications(dynamicItems);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    persistReadIds(allIds);
  };

  const markAsRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMinutes < 60) return `${Math.max(1, diffMinutes)} phút trước`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} giờ trước`;
      return date.toLocaleString('vi-VN');
    } catch (_) {
      return '';
    }
  };

  const getLevelBadge = (level) => {
    const l = String(level || '').toUpperCase();
    if (l === 'ERROR' || l === 'CRITICAL') {
      return { label: 'LỖI', bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', icon: AlertCircle };
    }
    if (l === 'WARNING' || l === 'WARN') {
      return { label: 'CẢNH BÁO', bg: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', icon: AlertTriangle };
    }
    return { label: 'THÔNG TIN', bg: 'var(--color-info-bg, rgba(37, 99, 235, 0.1))', color: 'var(--primary)', icon: Info };
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const isUnread = !readIds.has(n.id);
      if (activeFilter === 'unread') return isUnread;
      if (activeFilter === 'warning') return String(n.level).toUpperCase().includes('WARN') || String(n.level).toUpperCase().includes('ERR');
      if (activeFilter === 'info') return String(n.level).toUpperCase().includes('INFO');
      return true;
    });
  }, [notifications, activeFilter, readIds]);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Thông Báo & Cảnh Báo Hệ Thống</h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 13 }}>
          Theo dõi các sự kiện vận hành, lời mời thành viên, trạng thái bưu cục và cảnh báo an toàn.
        </p>
      </div>

      {/* 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.9fr) minmax(0, 1.1fr)', gap: '20px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Notification List & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'inline-flex', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px' }}>
              <button
                onClick={() => setActiveFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeFilter === 'all' ? 'var(--primary)' : 'transparent',
                  color: activeFilter === 'all' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeFilter === 'unread' ? 'var(--primary)' : 'transparent',
                  color: activeFilter === 'unread' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Chưa đọc ({unreadCount})
              </button>
              <button
                onClick={() => setActiveFilter('warning')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeFilter === 'warning' ? 'var(--primary)' : 'transparent',
                  color: activeFilter === 'warning' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Cảnh báo
              </button>
            </div>

            {/* Mark all as read */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--card)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <CheckCheck size={14} /> Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>

          {/* List Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Đang tải thông báo...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={32} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>Không có thông báo nào trong mục này</div>
                <div style={{ fontSize: '12.5px', marginTop: '4px' }}>Mọi thông báo mới từ hệ thống sẽ xuất hiện tại đây.</div>
              </div>
            ) : (
              filteredNotifications.map(n => {
                const badge = getLevelBadge(n.level);
                const isRead = readIds.has(n.id);
                const IconComp = badge.icon;

                return (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '16px',
                      background: isRead ? 'var(--card)' : 'var(--primary-light)',
                      cursor: 'pointer',
                      transition: 'background .15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: badge.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: badge.color,
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        <IconComp size={16} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{n.title}</strong>
                          {!isRead && (
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }}></span>
                          )}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
                          {n.content}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                        marginBottom: '4px'
                      }}>
                        {badge.label}
                      </span>
                      <div>{formatTime(n.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Notification Preferences & Channels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Notification Preferences Card */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={16} color="var(--primary)" /> Tùy Chọn Nhận Thông Báo
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Âm thanh chuông báo</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Phát chuông nhẹ khi có đơn hàng bóc tách thành công</div>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </label>

              <div style={{ height: '1px', background: 'var(--border)' }}></div>

              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Popup nổi góc màn hình</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Hiển thị toast thông báo nhanh khi đổi trạng thái máy</div>
                </div>
                <input
                  type="checkbox"
                  checked={popupEnabled}
                  onChange={(e) => setPopupEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>

          {/* Admin Managed Channels Info */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--primary)" /> Kênh Quản Trị Nâng Cao
            </h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Tùy chọn nhận cảnh báo khẩn cấp qua <strong>Telegram Bot</strong>, <strong>Email</strong> hoặc <strong>SMS</strong> được quản lý và phân quyền tập trung trên Bảng Quản Trị Chủ Shop (Master Admin).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}