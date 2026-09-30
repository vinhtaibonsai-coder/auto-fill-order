import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import { RealtimeService } from '../../../../domain/realtime/realtime.service.esm.js';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Cpu,
  Truck,
  Database,
  Zap,
  Download,
  Radio,
  Clock,
  Laptop,
  Bell,
  Send,
  Globe,
  Check,
  FileText,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Inbox,
  Layers
} from 'lucide-react';

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [actionMessage, setActionMessage] = useState({ text: '', type: 'success' });
  const [livePresenceCount, setLivePresenceCount] = useState(null);

  // Incident Center State
  const [incidents, setIncidents] = useState([]);
  const [incidentSummary, setIncidentSummary] = useState({ firing: 0, acknowledged: 0, resolved: 0, critical: 0, total_filtered: 0 });
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  // Outbox & Job Reliability State (G007)
  const [outboxMetrics, setOutboxMetrics] = useState(null);
  const [loadingOutbox, setLoadingOutbox] = useState(false);
  const [replayingDeadLetter, setReplayingDeadLetter] = useState(false);

  // Webhook đa kênh cảnh báo (Discord, Lark, Zalo, n8n...)
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookPlatform, setWebhookPlatform] = useState('DISCORD');
  const [webhookEvents, setWebhookEvents] = useState(['carrier_down', 'quota_exhausted', 'payment_received']);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState(null);

  const showToast = (text, type = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage({ text: '', type: 'success' }), 4000);
  };

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await AdminService.getSystemHealth();
      if (res.success && res.data) {
        setHealth(res.data);
      } else {
        setError(res.error || 'Không thể tải dữ liệu sức khỏe hệ thống.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    AdminService.getSystemWebhooks().then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const first = res.data[0];
        setWebhookUrl(first.url || '');
        setWebhookPlatform(first.platform || 'DISCORD');
        setWebhookEvents(first.events || ['carrier_down', 'quota_exhausted', 'payment_received']);
      }
    });
  }, []);

  // Phương Án 1: Đếm số lượng máy trạm phát tín hiệu Realtime Presence WebSocket
  useEffect(() => {
    let cancelled = false;
    const unsubscribers = [];

    (async () => {
      try {
        const shopsRes = await AdminService.getShopsList().catch(() => ({ data: [] }));
        const shops = Array.isArray(shopsRes?.data) ? shopsRes.data : [];
        if (shops.length === 0 || cancelled) return;

        const presenceByShop = {};

        for (const shop of shops) {
          if (!shop?.id || cancelled) continue;
          const unsub = await RealtimeService.subscribeWorkstationPresence(shop.id, (onlineMap) => {
            if (cancelled) return;
            presenceByShop[shop.id] = onlineMap;
            const uniqueDevices = new Set();
            Object.values(presenceByShop).forEach(m => {
              if (m && typeof m === 'object') {
                Object.keys(m).forEach(id => uniqueDevices.add(id));
              }
            });
            setLivePresenceCount(uniqueDevices.size);
          });
          if (cancelled) {
            if (typeof unsub === 'function') unsub();
          } else if (typeof unsub === 'function') {
            unsubscribers.push(unsub);
          }
        }
      } catch (e) {
        console.warn('[SystemHealth] presence error:', e);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribers.forEach(u => {
        try { u(); } catch (_) {}
      });
    };
  }, []);

  const handleSaveWebhook = async () => {
    if (!webhookUrl) {
      showToast('Vui lòng nhập URL Webhook!', 'error');
      return;
    }
    setSavingWebhook(true);
    try {
      const res = await AdminService.saveSystemWebhook({
        url: webhookUrl.trim(),
        platform: webhookPlatform,
        events: webhookEvents,
        is_active: true
      });
      if (res.success) {
        showToast('Đã lưu cấu hình Webhook thành công!', 'success');
      } else {
        showToast(res.error || 'Lỗi lưu webhook', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestPingWebhook = async () => {
    if (!webhookUrl) {
      showToast('Vui lòng nhập URL Webhook trước khi thử!', 'error');
      return;
    }
    setTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await AdminService.sendTestWebhook(webhookUrl.trim(), webhookPlatform);
      if (res.success) {
        setWebhookTestResult({ success: true, message: 'Gửi Test Ping thành công! Kiểm tra tin nhắn thông báo trên kênh.' });
        showToast('Đã gửi tin nhắn test thành công!', 'success');
      } else {
        setWebhookTestResult({ success: false, message: 'Thất bại: ' + (res.error || 'Lỗi HTTP') });
        showToast(res.error || 'Test webhook thất bại', 'error');
      }
    } catch (e) {
      setWebhookTestResult({ success: false, message: e.message });
      showToast(e.message, 'error');
    } finally {
      setTestingWebhook(false);
    }
  };

  // Quick Action Handlers
  const handleRetryFailedSyncs = async () => {
    setActionLoading('sync');
    try {
      const res = await AdminService.retryFailedSyncs();
      if (res.success) {
        showToast(res.data?.message || 'Đã kích hoạt thử lại toàn bộ hàng đợi đồng bộ.', 'success');
        await fetchHealth();
      } else {
        showToast(res.error || 'Không thể thử lại đồng bộ.', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Lỗi thực thi.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handlePingCarrier = async (carrierCode) => {
    setActionLoading(`ping_${carrierCode}`);
    try {
      const res = await AdminService.pingCarrier(carrierCode);
      if (res.success) {
        showToast(res.data?.message || `Cổng ${carrierCode} đang hoạt động ổn định!`, 'success');
        await fetchHealth();
      } else {
        showToast(res.error || `Lỗi kiểm tra cổng ${carrierCode}`, 'error');
      }
    } catch (e) {
      showToast(e.message || 'Lỗi gửi tín hiệu.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleFlushCache = async () => {
    setActionLoading('flush');
    try {
      const res = await AdminService.flushSystemCache();
      if (res.success) {
        showToast(res.data?.message || 'Đã xóa cache và tải lại toàn bộ Schema!', 'success');
        await fetchHealth();
      } else {
        showToast(res.error || 'Không thể xóa cache.', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Lỗi thực thi.', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleExportDiagnostics = () => {
    if (!health) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      export_type: 'SYSTEM_HEALTH_DIAGNOSTICS',
      generated_at: new Date().toISOString(),
      report: health
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `system_health_report_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Đã xuất báo cáo chẩn đoán hệ thống định dạng JSON.', 'success');
  };

  const fetchIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const res = await AdminService.getIncidents({
        status: filterStatus || null,
        severity: filterSeverity || null,
        limit: 50,
        offset: 0
      });
      if (res.success && res.data) {
        setIncidents(res.data.incidents || []);
        if (res.data.summary) {
          setIncidentSummary(res.data.summary);
        }
      }
    } catch (e) {
      console.warn('[SystemHealth] fetchIncidents error:', e);
    } finally {
      setLoadingIncidents(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const fetchOutboxMetrics = useCallback(async () => {
    setLoadingOutbox(true);
    try {
      const res = await AdminService.getOutboxMetrics();
      if (res) {
        setOutboxMetrics(res);
      }
    } catch (e) {
      console.warn('[SystemHealth] fetchOutboxMetrics error:', e);
    } finally {
      setLoadingOutbox(false);
    }
  }, []);

  useEffect(() => {
    fetchOutboxMetrics();
  }, [fetchOutboxMetrics]);

  const handleReplayDeadLetter = async (queueType = null) => {
    const queueLabel = queueType ? `hàng đợi [${queueType}]` : 'toàn bộ hàng đợi';
    if (!window.confirm(`Xác nhận đưa các job Dead-Letter của ${queueLabel} quay lại trạng thái Chờ Xử Lý (pending)?`)) {
      return;
    }
    setReplayingDeadLetter(true);
    try {
      const res = await AdminService.replayDeadLetterJobs(queueType);
      if (res && res.success) {
        showToast(res.message || `Đã phục hồi ${res.replayed_count || 0} jobs dead-letter.`, 'success');
        await fetchOutboxMetrics();
      } else {
        showToast(res?.message || 'Lỗi khi phục hồi dead-letter jobs', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setReplayingDeadLetter(false);
    }
  };

  const handleAcknowledgeIncident = async (incidentId) => {
    const ownerName = window.prompt('Nhập tên người tiếp nhận sự cố (Owner):', 'On-call Admin') || 'Admin';
    setActionLoading(`ack_${incidentId}`);
    try {
      const res = await AdminService.updateIncidentStatus({
        incidentId,
        action: 'acknowledge',
        owner: ownerName,
        notes: `Tiếp nhận bởi ${ownerName}`
      });
      if (res.success) {
        showToast('Đã tiếp nhận sự cố thành công.', 'success');
        await fetchIncidents();
      } else {
        showToast(res.error || 'Lỗi tiếp nhận sự cố', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleResolveIncident = async (incidentId) => {
    const resolutionNotes = window.prompt('Nhập ghi chú cách khắc phục sự cố:', 'Đã kiểm tra và xử lý xong') || 'Đã khắc phục';
    setActionLoading(`res_${incidentId}`);
    try {
      const res = await AdminService.updateIncidentStatus({
        incidentId,
        action: 'resolve',
        notes: resolutionNotes
      });
      if (res.success) {
        showToast('Đã đánh dấu sự cố được giải quyết thành công.', 'success');
        await fetchIncidents();
      } else {
        showToast(res.error || 'Lỗi xử lý sự cố', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleExportIncidentsCsv = () => {
    if (!incidents || incidents.length === 0) {
      showToast('Không có sự cố nào để xuất CSV!', 'error');
      return;
    }
    const headers = ['ID', 'Ma_Quy_Tac', 'Muc_Do', 'Tieu_De', 'Gia_Tri_Do', 'Nguong', 'So_Lan_Lap', 'Trang_Thai', 'Phu_Trach', 'Lan_Dau', 'Lan_Cuoi', 'Ghi_Chu'];
    const rows = incidents.map(i => [
      `"${i.id}"`,
      `"${i.rule_code}"`,
      `"${i.severity}"`,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.metric_value != null ? i.metric_value : '',
      i.threshold != null ? i.threshold : '',
      i.occurrence_count || 1,
      `"${i.status}"`,
      `"${(i.owner || '').replace(/"/g, '""')}"`,
      `"${i.first_seen_at ? new Date(i.first_seen_at).toLocaleString('vi-VN') : ''}"`,
      `"${i.last_seen_at ? new Date(i.last_seen_at).toLocaleString('vi-VN') : ''}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `system_incidents_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Đã xuất danh sách sự cố sang định dạng CSV thành công.', 'success');
  };

  const isHealthy = (status) => ['healthy', 'ok', 'enabled', 'active', 'enforced', 'online'].includes(String(status || '').toLowerCase());

  const getStatusText = (status) => {
    const s = String(status || '').toLowerCase();
    if (['healthy', 'ok', 'online', 'active'].includes(s)) return 'Hoạt động tốt';
    if (['enforced', 'enabled'].includes(s)) return 'Đang bảo vệ 100%';
    if (['degraded', 'warning'].includes(s)) return 'Cần chú ý';
    if (['failed', 'error', 'down'].includes(s)) return 'Gặp sự cố';
    return status || 'Chưa rõ';
  };

  const infrastructure = health ? [
    {
      label: 'Cơ Sở Dữ Liệu Cloud',
      code: 'supabase_status',
      icon: Database,
      status: health.supabase_status || 'unknown',
      detail: health.supabase_latency_ms != null ? `Độ trễ API: ${health.supabase_latency_ms}ms` : 'Chưa có phép đo'
    },
    {
      label: 'Phiên Xác Thực & Users',
      code: 'auth_status',
      icon: Server,
      status: health.auth_status || 'unknown',
      detail: `${health.auth_users_24h ?? '—'} người dùng tương tác / 24h`
    },
    {
      label: 'Bảo Mật Phân Quyền RLS',
      code: 'rls_status',
      icon: ShieldCheck,
      status: health.rls_status || 'unknown',
      detail: `${health.rls_policy_count ?? '—'} chính sách cô lập Shop`
    },
    {
      label: 'Hàng Đợi Đồng Bộ Outbox',
      code: 'sync_status',
      icon: RefreshCw,
      status: health.sync_status || (health.sync_failed == null ? 'unknown' : health.sync_failed === 0 ? 'healthy' : 'degraded'),
      detail: `${health.sync_failed_24h || health.sync_failed || 0} đơn lỗi / ${health.sync_pending || 0} đơn chờ`
    },
    {
      label: 'Cổng Trí Tuệ Nhân Tạo (AI)',
      code: 'ai_gateway_status',
      icon: Cpu,
      status: health.ai_gateway_status || 'unknown',
      detail: `${health.ai_total_24h || 0} lượt bóc tách / 24h`
    },
    {
      label: 'Nhà Cung Cấp Model AI',
      code: 'provider_status',
      icon: Zap,
      status: health.provider_status || 'unknown',
      detail: health.provider_name || 'Chưa xác định nhà cung cấp'
    }
  ] : [];
  const overallHealthy = infrastructure.length > 0 && infrastructure.every(item => isHealthy(item.status));
  const overallUnknown = infrastructure.length === 0 || infrastructure.some(item => item.status === 'unknown');

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
            Sức Khỏe Hệ Thống & Kiểm Soát Vận Hành
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
            Giám sát thời gian thực hạ tầng Cloud, Cổng AI, Tự động điền bưu cục và Thiết bị máy trạm.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleExportDiagnostics}
            disabled={loading || !health}
            style={{
              background: 'white',
              color: '#334155',
              border: '1px solid var(--border)',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Xuất Báo Cáo
          </button>
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            style={{
              background: 'var(--primary, #2563eb)',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: loading ? 'default' : 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Đang kiểm tra...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* TOAST MESSAGE */}
      {actionMessage.text && (
        <div style={{
          background: actionMessage.type === 'error' ? '#fef2f2' : '#ecfdf5',
          border: `1px solid ${actionMessage.type === 'error' ? '#f87171' : '#34d399'}`,
          color: actionMessage.type === 'error' ? '#991b1b' : '#065f46',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: 600,
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {actionMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #f87171',
          color: '#991b1b',
          padding: '14px 18px',
          borderRadius: '10px',
          fontSize: '13px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#dc2626" />
            <div>
              <div style={{ fontWeight: 800 }}>Cảnh báo lỗi tải dữ liệu Sức Khỏe:</div>
              <div style={{ fontWeight: 500 }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchHealth}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {loading && !health ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
          <Activity size={32} className="spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
          <div style={{ fontWeight: 600 }}>Đang kiểm tra kết nối và đo lường sức khỏe toàn bộ hệ thống...</div>
        </div>
      ) : health ? (
        <>
          {/* SYSTEM PULSE HERO BANNER */}
          <div style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            borderRadius: '14px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 8px 24px rgba(49, 46, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(52, 211, 153, 0.4)'
              }}>
                <Radio size={24} color="#34d399" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>Tình Trạng Hệ Thống:</span>
                  <span style={{
                    background: overallHealthy ? '#10b981' : overallUnknown ? '#64748b' : '#dc2626',
                    color: '#ffffff',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    {overallHealthy ? 'HOẠT ĐỘNG TỐT' : overallUnknown ? 'CHƯA ĐỦ DỮ LIỆU' : 'CÓ CẢNH BÁO'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#c7d2fe', marginTop: '3px' }}>
                  {overallHealthy ? 'Các phép đo hiện có đang trong ngưỡng an toàn.' : 'Kiểm tra chi tiết từng dịch vụ và thời điểm đo gần nhất.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>Độ trễ Supabase</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399' }}>{health.supabase_latency_ms == null ? '—' : `${health.supabase_latency_ms}ms`}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 700 }}>Máy trạm trực tuyến</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#60a5fa' }}>
                  {livePresenceCount != null && livePresenceCount > 0 ? (
                    <span title="Dữ liệu kết nối Realtime WebSocket 0s">🟢 {livePresenceCount} thiết bị</span>
                  ) : (
                    health.workstations_online == null ? '—' : `${health.workstations_online} thiết bị`
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 6 INFRASTRUCTURE CORE CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {infrastructure.map(item => {
              const IconComponent = item.icon;
              const ok = isHealthy(item.status);
              return (
                <div key={item.code} className="card" style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: ok ? '#ecfdf5' : '#fef2f2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: ok ? '#059669' : '#dc2626'
                        }}>
                          <IconComponent size={18} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</h4>
                      </div>
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: ok ? '#10b981' : '#ef4444',
                        boxShadow: ok ? '0 0 8px rgba(16, 185, 129, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)'
                      }} />
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '12px' }}>
                      {item.detail}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '12px'
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Trạng thái:</span>
                    <span style={{
                      fontWeight: 800,
                      color: ok ? '#059669' : '#dc2626',
                      textTransform: 'uppercase'
                    }}>
                      {getStatusText(item.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI GATEWAY & DOM AUTOMATION SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* AI Success Rate Card */}
            <div className="card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cpu size={20} color="var(--primary)" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Chất Lượng Bóc Tách Đơn AI</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Thống kê độ chính xác và hạn mức Quota trong 24 giờ qua</div>
                  </div>
                </div>
                {(() => {
                  const hasRate = typeof health.ai_success_rate === 'number' && Number.isFinite(health.ai_success_rate);
                  const rate = hasRate ? Math.max(0, Math.min(100, Math.round(health.ai_success_rate))) : null;
                  const isGood = hasRate && rate >= 95;
                  return (
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: !hasRate ? '#f1f5f9' : isGood ? '#ecfdf5' : '#fef2f2',
                      color: !hasRate ? '#64748b' : isGood ? '#059669' : '#dc2626',
                      fontWeight: 800,
                      fontSize: '13px'
                    }}>
                      {hasRate ? `${rate}% Thành công` : '— Chưa có dữ liệu'}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px', background: 'var(--bg-main, #f8fafc)', padding: '14px', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>Tổng Yêu Cầu</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{health.ai_total_24h || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>Lỗi Bóc Tách</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: (health.ai_errors_24h || 0) > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                    {health.ai_errors_24h || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>Hết Quota</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: (health.ai_quota_limited_24h || 0) > 0 ? '#f59e0b' : '#10b981', marginTop: '2px' }}>
                    {health.ai_quota_limited_24h || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Carriers Quick Live Status Card */}
            <div className="card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Truck size={20} color="#059669" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Tự Động Điền Bưu Cục</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tình trạng nhận diện Form và độ phản hồi bưu cục</div>
                  </div>
                </div>
                <div style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: '#ecfdf5',
                  color: '#059669',
                  fontWeight: 800,
                  fontSize: '12px'
                }}>
                  Sẵn sàng
                </div>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {(health.carriers || []).length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '12px 0' }}>Đang nạp dữ liệu kiểm tra bưu cục...</div>
                ) : (
                  health.carriers.map(c => (
                    <div key={c.carrier_code} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-main, #f8fafc)',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{c.carrier_code}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {c.carrier_code === 'VNPOST' ? '(Bưu Điện VN)' : '(J&T Express)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{c.response_time_ms}ms</span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: c.status === 'healthy' ? '#ecfdf5' : '#fef2f2',
                          color: c.status === 'healthy' ? '#059669' : '#dc2626'
                        }}>
                          {c.status === 'healthy' ? 'HOẠT ĐỘNG' : 'CÓ LỖI'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* INCIDENT CENTER (G005) */}
          <div className="card" style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '22px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={22} color="#dc2626" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
                    Trung Tâm Sự Cố & Cảnh Báo Vận Hành (Incident Center)
                  </h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Theo dõi và xử lý các sự cố tự động từ AI, Bưu cục, Đồng bộ đơn và Webhook theo quy tắc vận hành SLA.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportIncidentsCsv}
                  disabled={incidents.length === 0}
                  style={{
                    background: 'white',
                    color: '#334155',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: incidents.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={13} /> Xuất CSV Sự Cố
                </button>
                <button
                  type="button"
                  onClick={fetchIncidents}
                  disabled={loadingIncidents}
                  style={{
                    background: '#f8fafc',
                    color: 'var(--primary)',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: loadingIncidents ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={13} className={loadingIncidents ? 'spin' : ''} /> Làm Mới
                </button>
              </div>
            </div>

            {/* KPI Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>Đang phát cảnh báo</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{incidentSummary.firing || 0}</div>
              </div>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#881337', fontWeight: 700, textTransform: 'uppercase' }}>Nghiêm trọng (Critical)</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48' }}>{incidentSummary.critical || 0}</div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>Đã tiếp nhận</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>{incidentSummary.acknowledged || 0}</div>
              </div>
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 700, textTransform: 'uppercase' }}>Đã khắc phục</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>{incidentSummary.resolved || 0}</div>
              </div>
            </div>

            {/* Filter Controls */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Trạng thái:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12.5px', background: 'white' }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="firing">Đang phát cảnh báo (Firing)</option>
                  <option value="acknowledged">Đã tiếp nhận (Acknowledged)</option>
                  <option value="resolved">Đã giải quyết (Resolved)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Mức độ:</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12.5px', background: 'white' }}
                >
                  <option value="">Tất cả mức độ</option>
                  <option value="critical">Critical (Nghiêm trọng)</option>
                  <option value="warning">Warning (Cảnh báo)</option>
                  <option value="info">Info (Thông tin)</option>
                </select>
              </div>
            </div>

            {/* Incident Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>MỨC ĐỘ</th>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>SỰ CỐ & NGUỒN</th>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>ĐO ĐƯỢC / NGƯỠNG</th>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>SỐ LẦN / DEDUPE KEY</th>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>THỜI ĐIỂM</th>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>TRẠNG THÁI</th>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700, textAlign: 'center' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingIncidents ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <RefreshCw size={18} className="spin" style={{ margin: '0 auto 6px' }} />
                        <div>Đang tải danh sách sự cố...</div>
                      </td>
                    </tr>
                  ) : incidents.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>Hệ Thống Hoạt Động Ổn Định</div>
                        <div style={{ fontSize: '12px' }}>Không có sự cố nào phù hợp với bộ lọc hiện tại.</div>
                      </td>
                    </tr>
                  ) : (
                    incidents.map(inc => (
                      <tr key={inc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: inc.severity === 'critical' ? '#fef2f2' : inc.severity === 'warning' ? '#fffbeb' : '#eff6ff',
                            color: inc.severity === 'critical' ? '#dc2626' : inc.severity === 'warning' ? '#d97706' : '#2563eb',
                            border: `1px solid ${inc.severity === 'critical' ? '#fecaca' : inc.severity === 'warning' ? '#fde68a' : '#bfdbfe'}`
                          }}>
                            {inc.severity}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inc.title}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{inc.message}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <code>{inc.rule_code}</code>
                            {inc.source_link && (
                              <a href={inc.source_link} style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                Xem nguồn <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12.5px' }}>
                          <div>Đo: <b>{inc.metric_value != null ? inc.metric_value : '—'}</b></div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>Ngưỡng: {inc.threshold != null ? inc.threshold : '—'} ({inc.window_seconds}s)</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 700 }}>{inc.occurrence_count || 1} lần</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{inc.dedupe_key}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          <div>Đầu: {inc.first_seen_at ? new Date(inc.first_seen_at).toLocaleTimeString('vi-VN') : '—'}</div>
                          <div>Cuối: {inc.last_seen_at ? new Date(inc.last_seen_at).toLocaleTimeString('vi-VN') : '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: inc.status === 'firing' ? '#fef2f2' : inc.status === 'acknowledged' ? '#fffbeb' : '#ecfdf5',
                            color: inc.status === 'firing' ? '#991b1b' : inc.status === 'acknowledged' ? '#92400e' : '#065f46'
                          }}>
                            {inc.status === 'firing' ? 'Đang phát' : inc.status === 'acknowledged' ? 'Đã tiếp nhận' : 'Đã giải quyết'}
                          </span>
                          {inc.owner && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                              Phụ trách: <b>{inc.owner}</b>
                            </div>
                          )}
                          {inc.notes && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                              {inc.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            {inc.status === 'firing' && (
                              <button
                                type="button"
                                onClick={() => handleAcknowledgeIncident(inc.id)}
                                disabled={actionLoading === `ack_${inc.id}`}
                                style={{
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  width: '90px'
                                }}
                              >
                                {actionLoading === `ack_${inc.id}` ? 'Đang lưu...' : 'Tiếp Nhận'}
                              </button>
                            )}
                            {inc.status !== 'resolved' && (
                              <button
                                type="button"
                                onClick={() => handleResolveIncident(inc.id)}
                                disabled={actionLoading === `res_${inc.id}`}
                                style={{
                                  background: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  width: '90px'
                                }}
                              >
                                {actionLoading === `res_${inc.id}` ? 'Đang lưu...' : 'Đã Xử Lý'}
                              </button>
                            )}
                            {inc.status === 'resolved' && (
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>✓ Hoàn tất</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* OUTBOX & JOB RELIABILITY DASHBOARD (G007) */}
          <div className="card" style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={20} color="#6366f1" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Hàng Đợi Outbox & Job - Độ Tin Cậy Vận Hành</h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Kiểm soát 5 hàng đợi trọng yếu: Đồng bộ nháp, Đơn hàng, Telegram Ops, Webhook Retry, Thông báo Retention.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleReplayDeadLetter()}
                  disabled={replayingDeadLetter || !outboxMetrics?.summary?.dead_letter}
                  style={{
                    background: outboxMetrics?.summary?.dead_letter ? '#fef2f2' : '#f1f5f9',
                    color: outboxMetrics?.summary?.dead_letter ? '#dc2626' : '#94a3b8',
                    border: `1px solid ${outboxMetrics?.summary?.dead_letter ? '#fecaca' : '#e2e8f0'}`,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: outboxMetrics?.summary?.dead_letter ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RotateCcw size={13} className={replayingDeadLetter ? 'spin' : ''} />
                  <span>Xử Lý Lại Dead-Letter ({outboxMetrics?.summary?.dead_letter || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={fetchOutboxMetrics}
                  disabled={loadingOutbox}
                  style={{
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid var(--border)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={13} className={loadingOutbox ? 'spin' : ''} />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {/* Overall Outbox Status Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tổng Số Job</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{outboxMetrics?.summary?.total ?? '—'}</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Chờ Xử Lý (pending)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e40af' }}>{outboxMetrics?.summary?.pending ?? 0}</div>
              </div>
              <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase' }}>Đang Khóa Lease (running)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#a16207' }}>{outboxMetrics?.summary?.running ?? 0}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Thành Công (succeeded)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534' }}>{outboxMetrics?.summary?.succeeded ?? 0}</div>
              </div>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 600, textTransform: 'uppercase' }}>Lỗi Chờ Retry (failed)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#9a3412' }}>{outboxMetrics?.summary?.failed ?? 0}</div>
              </div>
              <div style={{ background: (outboxMetrics?.summary?.dead_letter || 0) > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${(outboxMetrics?.summary?.dead_letter || 0) > 0 ? '#fecaca' : '#e2e8f0'}`, borderRadius: '10px', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', color: (outboxMetrics?.summary?.dead_letter || 0) > 0 ? '#b91c1c' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Dead Letter (Bế Tắc)</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: (outboxMetrics?.summary?.dead_letter || 0) > 0 ? '#dc2626' : '#334155' }}>{outboxMetrics?.summary?.dead_letter ?? 0}</div>
              </div>
            </div>

            {/* 5 Distinct Queue Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {[
                { key: 'draft_sync', label: 'Đồng Bộ Bản Nháp', desc: 'Sync đơn draft ngoại tuyến' },
                { key: 'order_sync', label: 'Đồng Bộ Đơn Hàng', desc: 'Cập nhật trạng thái đơn đã lên' },
                { key: 'telegram_alert', label: 'Cảnh Báo Telegram Ops', desc: 'Hàng đợi bot vận hành' },
                { key: 'webhook_retry', label: 'Thử Lại Webhook', desc: 'Đối soát và callback bên ngoài' },
                { key: 'retention_notification', label: 'Thông Báo Retention', desc: 'Playbook CSKH và tái tục' }
              ].map(q => {
                const stat = outboxMetrics?.queues?.[q.key] || { pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 };
                return (
                  <div key={q.key} style={{
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    background: '#fcfcfd'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>{q.label}</div>
                      {stat.dead_letter > 0 && (
                        <button
                          type="button"
                          onClick={() => handleReplayDeadLetter(q.key)}
                          title="Phục hồi dead-letter cho hàng đợi này"
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Replay ({stat.dead_letter})
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>{q.desc}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#475569' }}>
                      <span>Chờ: <b>{stat.pending}</b></span>
                      <span>Chạy: <b>{stat.running}</b></span>
                      <span>Xong: <b style={{ color: '#16a34a' }}>{stat.succeeded}</b></span>
                      {stat.failed > 0 && <span style={{ color: '#ea580c' }}>Lỗi: <b>{stat.failed}</b></span>}
                      {stat.dead_letter > 0 && <span style={{ color: '#dc2626' }}>Dead: <b>{stat.dead_letter}</b></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* EMERGENCY QUICK ACTION CENTER */}
          <div className="card" style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Zap size={20} color="#eab308" />
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Trung Tâm Hành Động Khẩn Cấp 1-Chạm (Quick Actions)</h3>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Các lệnh can thiệp và xử lý sự cố trực tiếp dành cho Quản trị viên Master Admin.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <button
                type="button"
                onClick={handleFlushCache}
                disabled={actionLoading !== ''}
                style={{
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: actionLoading ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                  <RefreshCw size={15} className={actionLoading === 'flush' ? 'spin' : ''} />
                  <span>Xóa Cache & Nạp Schema</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Làm mới kết nối và nạp lại cấu trúc bảng cơ sở dữ liệu.
                </div>
              </button>

              <button
                type="button"
                onClick={handleRetryFailedSyncs}
                disabled={actionLoading !== ''}
                style={{
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: actionLoading ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                  <Zap size={15} className={actionLoading === 'sync' ? 'spin' : ''} />
                  <span>Thử Lại Hàng Đợi Đồng Bộ</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Kích hoạt lại các đơn hàng bị nghẽn mạng tải lên Cloud.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePingCarrier('VNPOST')}
                disabled={actionLoading !== ''}
                style={{
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: actionLoading ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                  <Radio size={15} className={actionLoading === 'ping_VNPOST' ? 'spin' : ''} />
                  <span>Kiểm Tra Cổng VNPost</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Gửi tín hiệu kiểm tra đường truyền và DOM VNPost.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handlePingCarrier('J&T')}
                disabled={actionLoading !== ''}
                style={{
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: actionLoading ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                  <Radio size={15} className={actionLoading === 'ping_J&T' ? 'spin' : ''} />
                  <span>Kiểm Tra Cổng J&T</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Gửi tín hiệu kiểm tra đường truyền và DOM J&T Express.
                </div>
              </button>
            </div>
          </div>

          {/* GENERIC WEBHOOK ALERTS (DISCORD / LARK / ZALO / N8N) */}
          <div className="card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Cảnh Báo Sự Cố Đa Kênh (Generic Webhooks)</h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Hỗ trợ Discord, Lark, Slack, Zalo OA, n8n, Make...
              </span>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Tự động gửi thông báo khẩn cấp khi bưu cục sập, Shop hết hạn/hết lượt AI hoặc có lỗi đồng bộ nghiêm trọng tới nhóm chat kỹ thuật của bạn.
            </p>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Nền tảng:
                  </label>
                  <select
                    value={webhookPlatform}
                    onChange={e => setWebhookPlatform(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  >
                    <option value="DISCORD">Discord Webhook</option>
                    <option value="LARK">Lark / Feishu Bot</option>
                    <option value="SLACK">Slack Incoming</option>
                    <option value="GENERIC">Generic (Zalo / n8n / Make)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Webhook URL nhận thông báo:
                  </label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/... hoặc https://open.larksuite.com/..."
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Sự kiện đăng ký */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Các sự kiện kích hoạt gửi thông báo:
                </label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-main)' }}>
                  {[
                    { id: 'carrier_down', label: 'Cổng bưu cục sập / đổi DOM' },
                    { id: 'quota_exhausted', label: 'Shop hết sạch lượt AI' },
                    { id: 'payment_received', label: 'Khách thanh toán SePay thành công' },
                    { id: 'device_limit', label: 'Cảnh báo đăng nhập vượt thiết bị' }
                  ].map(evt => (
                    <label key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={webhookEvents.includes(evt.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setWebhookEvents([...webhookEvents, evt.id]);
                          } else {
                            setWebhookEvents(webhookEvents.filter(x => x !== evt.id));
                          }
                        }}
                      />
                      <span>{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions & Test Feedback */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleTestPingWebhook}
                    disabled={testingWebhook || !webhookUrl}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: '#f8fafc',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: testingWebhook || !webhookUrl ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Send size={14} className={testingWebhook ? 'spin' : ''} />
                    {testingWebhook ? 'Đang gửi...' : 'Gửi Thử Test Ping'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={savingWebhook}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: savingWebhook ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Check size={14} />
                    {savingWebhook ? 'Đang lưu...' : 'Lưu Cấu Hình Webhook'}
                  </button>
                </div>

                {webhookTestResult && (
                  <div style={{
                    fontSize: '12.5px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: webhookTestResult.success ? '#ecfdf5' : '#fef2f2',
                    color: webhookTestResult.success ? '#059669' : '#dc2626',
                    border: `1px solid ${webhookTestResult.success ? '#a7f3d0' : '#fecaca'}`
                  }}>
                    {webhookTestResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CARRIER LOGS TABLE */}
          <div className="card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} color="var(--text-main)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Nhật Ký Giám Sát Cổng Bưu Cục Tự Động</h3>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} />
                <span>Kiểm tra gần nhất: {health.checked_at ? new Date(health.checked_at).toLocaleString('vi-VN') : 'Vừa xong'}</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main, #f8fafc)' }}>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>ĐƠN VỊ VẬN CHUYỂN</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>TRẠNG THÁI</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>ĐỘ TRỄ ĐO ĐƯỢC</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>CHI TIẾT LỖI</th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>THỜI ĐIỂM GHI NHẬN</th>
                  </tr>
                </thead>
                <tbody>
                  {(health.carriers || []).length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        Chưa có lịch sử kiểm tra bưu cục. Bấm "Kiểm Tra Cổng" ở trên để đo lường ngay.
                      </td>
                    </tr>
                  ) : (
                    health.carriers.map(c => (
                      <tr key={c.carrier_code} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', fontSize: '13.5px', fontWeight: 700 }}>
                          {c.carrier_code === 'VNPOST' ? 'VNPost (Bưu Điện Việt Nam)' : c.carrier_code === 'J&T' ? 'J&T Express Việt Nam' : c.carrier_code}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            background: c.status === 'healthy' ? '#ecfdf5' : '#fef2f2',
                            color: c.status === 'healthy' ? '#059669' : '#dc2626'
                          }}>
                            {c.status === 'healthy' ? 'Bình thường' : 'Có cảnh báo'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {c.response_time_ms}ms
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12.5px', color: c.error_message ? '#dc2626' : 'var(--text-muted)' }}>
                          {c.error_message || 'Không có lỗi nào'}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {c.detected_at ? new Date(c.detected_at).toLocaleString('vi-VN') : 'Mới ghi nhận'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
