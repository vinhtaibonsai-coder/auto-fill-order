import React, { useState, useEffect } from 'react';
import { X, Clock, User, Cpu, Server, Truck, Shield, Filter, Download } from 'lucide-react';
import { maskOrderPII } from '../../../domain/order/order-event.taxonomy.js';

export default function OrderTimelineDrawer({
  isOpen,
  onClose,
  order,
  shopId,
  canViewPii = true,
  canViewAudit = true
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actorFilter, setActorFilter] = useState('ALL');
  const [eventFilter, setEventFilter] = useState('ALL');

  useEffect(() => {
    if (!isOpen || !order) return;
    loadOrderEvents();
  }, [isOpen, order]);

  async function loadOrderEvents() {
    setLoading(true);
    try {
      let remoteEvents = [];

      // Query Supabase order_events if available
      if (typeof globalThis.supabase !== 'undefined' || typeof AuthService !== 'undefined') {
        const client = typeof globalThis.supabase !== 'undefined' 
          ? globalThis.supabase 
          : await AuthService.getSupabaseClient?.();

        if (client) {
          const orderId = order.order_id || order.orderId || order.id || '';
          const orderCode = order.order_code || order.orderCode || '';

          const { data, error } = await client
            .from('order_events')
            .select('*')
            .eq('shop_id', shopId || order.shop_id)
            .or(`order_id.eq.${orderId},order_code.eq.${orderCode}`)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            remoteEvents = data;
          }
        }
      }

      // If no remote events recorded yet, construct baseline synthesized lifecycle events from order snapshot
      if (remoteEvents.length === 0) {
        remoteEvents = synthesizeBaselineEvents(order);
      }

      setEvents(remoteEvents);
    } catch (err) {
      console.warn('[OrderTimelineDrawer] Load events failed:', err);
      setEvents(synthesizeBaselineEvents(order));
    } finally {
      setLoading(false);
    }
  }

  function synthesizeBaselineEvents(ord) {
    const list = [];
    const baseTime = ord.created_at || ord.createdAt || new Date().toISOString();

    list.push({
      id: 'synth_save',
      event_type: 'ORDER_SAVED',
      actor_type: 'SYSTEM',
      source: 'extension',
      created_at: ord.submitted_at || baseTime,
      metadata: { snapshot: 'Lưu đơn hoàn tất vào hệ thống' },
      before_patch: {},
      after_patch: { status: 'submitted', tracking_code: ord.tracking_code || ord.trackingCode }
    });

    if (ord.tracking_code || ord.trackingCode) {
      list.push({
        id: 'synth_tracking',
        event_type: 'TRACKING_RECEIVED',
        actor_type: 'CARRIER',
        source: ord.carrier || 'VNPOST',
        created_at: ord.submitted_at || baseTime,
        metadata: { tracking_code: ord.tracking_code || ord.trackingCode },
        before_patch: { tracking_code: null },
        after_patch: { tracking_code: ord.tracking_code || ord.trackingCode }
      });
    }

    list.push({
      id: 'synth_submit',
      event_type: 'SUBMIT_STARTED',
      actor_type: 'USER',
      source: 'carrier_page',
      created_at: ord.submitted_at || baseTime,
      metadata: { carrier: ord.carrier || 'VNPOST' },
      before_patch: { status: 'draft' },
      after_patch: { status: 'submitting' }
    });

    list.push({
      id: 'synth_parse',
      event_type: 'ORDER_PARSED',
      actor_type: 'USER',
      source: 'web_panel',
      created_at: baseTime,
      metadata: { customerName: ord.customerName },
      before_patch: {},
      after_patch: { order_code: ord.order_code || ord.orderCode }
    });

    return list;
  }

  function getActorIcon(actorType) {
    switch (actorType) {
      case 'USER': return <User size={13} className="text-blue-600" />;
      case 'AI': return <Cpu size={13} className="text-purple-600" />;
      case 'CARRIER': return <Truck size={13} className="text-amber-600" />;
      case 'PARTNER_API': return <Shield size={13} className="text-emerald-600" />;
      default: return <Server size={13} className="text-gray-600" />;
    }
  }

  function getEventBadgeColor(type) {
    if (type.startsWith('PRINT_') || type.startsWith('LABEL_')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (type.includes('SUBMIT') || type.includes('TRACKING')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (type.includes('AI_')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (type.includes('ERROR') || type.includes('FAILED')) return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  const filteredEvents = events.filter(ev => {
    if (actorFilter !== 'ALL' && ev.actor_type !== actorFilter) return false;
    if (eventFilter !== 'ALL' && ev.event_type !== eventFilter) return false;
    return true;
  });

  function exportAuditJson() {
    if (!canViewAudit) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `order-audit-${order?.order_code || 'log'}.json`);
    dlAnchor.click();
  }

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Nhật ký vòng đời đơn hàng</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Mã đơn: <span className="font-semibold text-gray-800">{order.order_code || order.orderCode || order.id}</span>
              {order.tracking_code && (
                <span className="ml-2 font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {order.tracking_code}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canViewAudit && (
              <button
                onClick={exportAuditJson}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition shadow-xs"
                title="Xuất JSON audit"
              >
                <Download size={13} />
                <span>Xuất Audit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-2.5 bg-gray-100/70 border-b border-gray-200 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-gray-600">
            <Filter size={13} />
            <span>Lọc:</span>
          </div>
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả tác tử</option>
            <option value="USER">Người dùng (USER)</option>
            <option value="AI">Trí tuệ nhân tạo (AI)</option>
            <option value="SYSTEM">Hệ thống (SYSTEM)</option>
            <option value="CARRIER">Bưu cục (CARRIER)</option>
          </select>

          <select
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
            className="px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả sự kiện</option>
            <option value="ORDER_PARSED">Bóc tách đơn (PARSED)</option>
            <option value="USER_FIELD_CHANGED">Sửa trường (USER_EDIT)</option>
            <option value="AI_FIELD_CHANGED">AI chuẩn hóa (AI_EDIT)</option>
            <option value="SUBMIT_STARTED">Nộp đơn (SUBMIT)</option>
            <option value="TRACKING_RECEIVED">Nhận mã vận đơn (TRACKING)</option>
            <option value="ORDER_SAVED">Lưu đơn (SAVED)</option>
            <option value="LABEL_PRINTED">In nhãn (PRINTED)</option>
          </select>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Đang tải lịch sử sự kiện...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">Không tìm thấy sự kiện phù hợp bộ lọc.</div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {filteredEvents.map((ev, idx) => {
                const maskedBefore = canViewPii ? ev.before_patch : maskOrderPII(ev.before_patch || {});
                const maskedAfter = canViewPii ? ev.after_patch : maskOrderPII(ev.after_patch || {});

                return (
                  <div key={ev.id || idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-3.5 shadow-2xs hover:shadow-xs transition">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getEventBadgeColor(ev.event_type || '')}`}>
                          {ev.event_type || 'EVENT'}
                        </span>
                        <span className="text-2xs text-gray-400 font-mono">
                          {ev.created_at ? new Date(ev.created_at).toLocaleString('vi-VN') : '—'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                        <div className="flex items-center gap-1 font-medium">
                          {getActorIcon(ev.actor_type)}
                          <span>{ev.actor_type}</span>
                        </div>
                        {ev.source && (
                          <span className="text-gray-400 font-mono text-2xs bg-gray-100 px-1 rounded">
                            {ev.source}
                          </span>
                        )}
                      </div>

                      {/* Diff Viewer */}
                      {ev.after_patch && Object.keys(ev.after_patch).length > 0 && (
                        <div className="mt-2 bg-gray-50 rounded p-2 text-xs border border-gray-150 font-mono space-y-1">
                          {Object.entries(ev.after_patch).map(([key, afterVal]) => {
                            const beforeVal = maskedBefore?.[key];
                            return (
                              <div key={key} className="flex items-start gap-1.5">
                                <span className="font-semibold text-gray-700">{key}:</span>
                                {beforeVal !== undefined && (
                                  <span className="text-red-600 line-through mr-1">
                                    {typeof beforeVal === 'object' ? JSON.stringify(beforeVal) : String(beforeVal)}
                                  </span>
                                )}
                                <span className="text-emerald-700 font-medium">
                                  {typeof afterVal === 'object' ? JSON.stringify(afterVal) : String(afterVal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Metadata Details */}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <div className="mt-2 text-2xs text-gray-500">
                          {Object.entries(ev.metadata).map(([k, v]) => (
                            <span key={k} className="mr-3">
                              <span className="text-gray-400">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
