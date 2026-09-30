import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Download,
  CheckCircle2,
  FileQuestion,
  Copy,
  Clock,
  DollarSign,
  MapPin,
  Eye,
  Check,
  X,
  Filter
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import {
  DATA_QUALITY_KPIS,
  DATA_QUALITY_LABELS,
  verifyKpiDrilldownReconciliation,
  exportDataQualityCsv
} from '../../../../domain/admin/data-quality.engine.js';

export default function DataQuality() {
  const [range, setRange] = useState('30d');
  const [kpis, setKpis] = useState(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [activeKpi, setActiveKpi] = useState(DATA_QUALITY_KPIS.MISSING_TRACKING);
  const [drilldownData, setDrilldownData] = useState({ total: 0, records: [] });
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [previewModal, setPreviewModal] = useState(null);
  const [resolvingId, setResolvingId] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadKpis = useCallback(async () => {
    setLoadingKpis(true);
    try {
      const res = await AdminService.getDataQualityKpis(range);
      if (res) {
        setKpis(res);
      }
    } catch (e) {
      console.warn('[DataQuality] loadKpis error:', e);
    } finally {
      setLoadingKpis(false);
    }
  }, [range]);

  const loadDrilldown = useCallback(async () => {
    if (!activeKpi) return;
    setLoadingDrilldown(true);
    try {
      const res = await AdminService.getDataQualityDrilldown(activeKpi, range, 100, 0);
      if (res) {
        setDrilldownData(res);
      }
    } catch (e) {
      console.warn('[DataQuality] loadDrilldown error:', e);
    } finally {
      setLoadingDrilldown(false);
    }
  }, [activeKpi, range]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    loadDrilldown();
  }, [loadDrilldown]);

  const handleExportCsv = () => {
    if (!drilldownData || !drilldownData.records || drilldownData.records.length === 0) {
      showToast('Không có dữ liệu bản ghi để xuất CSV.', 'error');
      return;
    }
    const csvContent = exportDataQualityCsv(drilldownData.records);
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_quality_${activeKpi}_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Đã xuất báo cáo kiểm toán chất lượng dữ liệu thành công.', 'success');
  };

  const handlePreviewFix = (record) => {
    setPreviewModal({
      record,
      issueType: activeKpi,
      notes: `Xác nhận xử lý thủ công vấn đề [${DATA_QUALITY_LABELS[activeKpi]?.label}] cho đơn ${record.order_code || record.record_id}`
    });
  };

  const handleConfirmFix = async () => {
    if (!previewModal) return;
    setResolvingId(previewModal.record.record_id);
    try {
      const res = await AdminService.resolveDataQualityIssue(
        previewModal.issueType,
        previewModal.record.record_id,
        previewModal.notes
      );
      if (res && res.success) {
        showToast('Đã ghi nhận giải quyết vấn đề chất lượng dữ liệu vào kiểm toán.', 'success');
        setPreviewModal(null);
        await Promise.all([loadKpis(), loadDrilldown()]);
      } else {
        showToast(res?.message || 'Lỗi khi giải quyết vấn đề', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setResolvingId('');
    }
  };

  // Reconciliation audit check
  const activeKpiCount = kpis ? Number(kpis[activeKpi] || 0) : 0;
  const reconciliation = verifyKpiDrilldownReconciliation(activeKpiCount, drilldownData);

  return (
    <div style={{ paddingBottom: '50px' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '8px',
          fontWeight: 700,
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
            Giám Sát Chất Lượng Dữ Liệu (Data Quality Intelligence)
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>
            Kiểm toán sai lệch 5 chiều: Mã vận đơn trống, Trùng mã đơn, Địa chỉ confidence thấp, Carrier status đóng băng và Thanh toán không khớp.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Range Selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {[
              { id: '7d', label: '7 ngày' },
              { id: '30d', label: '30 ngày' },
              { id: 'all', label: 'Tất cả' }
            ].map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                style={{
                  background: range === r.id ? '#ffffff' : 'transparent',
                  color: range === r.id ? 'var(--primary)' : '#64748b',
                  fontWeight: range === r.id ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: range === r.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loadingDrilldown || drilldownData.records.length === 0}
            style={{
              background: '#ffffff',
              color: '#334155',
              border: '1px solid var(--border)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Xuất Báo Cáo CSV
          </button>

          <button
            type="button"
            onClick={() => { loadKpis(); loadDrilldown(); }}
            disabled={loadingKpis || loadingDrilldown}
            style={{
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loadingKpis || loadingDrilldown ? 'spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {/* 5 KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { key: 'missing_tracking_code', icon: FileQuestion, color: '#f59e0b' },
          { key: 'invalid_duplicate_order_code', icon: Copy, color: '#ef4444' },
          { key: 'low_confidence_address', icon: MapPin, color: '#8b5cf6' },
          { key: 'stale_carrier_status', icon: Clock, color: '#3b82f6' },
          { key: 'unmatched_payment', icon: DollarSign, color: '#dc2626' }
        ].map(({ key, icon: Icon, color }) => {
          const config = DATA_QUALITY_LABELS[key];
          const count = kpis ? Number(kpis[key] || 0) : 0;
          const isSelected = activeKpi === key;

          return (
            <div
              key={key}
              onClick={() => setActiveKpi(key)}
              style={{
                background: '#ffffff',
                border: isSelected ? `2px solid ${color}` : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? `0 4px 14px ${color}25` : '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: `${color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: color
                }}>
                  <Icon size={18} />
                </div>
                <span style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: count > 0 ? (config.severity === 'critical' ? '#dc2626' : '#d97706') : '#10b981'
                }}>
                  {loadingKpis ? '—' : count}
                </span>
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                {config.label}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {config.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* DRILL-DOWN PANEL */}
      <div className="card" style={{
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '20px'
      }}>
        {/* Drill-down Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                Bản Ghi Chi Tiết: {DATA_QUALITY_LABELS[activeKpi]?.label}
              </h3>
              <span style={{
                background: '#f1f5f9',
                color: '#475569',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {drilldownData.total || 0} bản ghi
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Toàn bộ dữ liệu khách hàng (Tên, SĐT) đã được che PII nghiêm ngặt bảo vệ quyền riêng tư.
            </div>
          </div>

          {/* Reconciliation Invariant Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: reconciliation.reconciled ? '#ecfdf5' : '#fef2f2',
            color: reconciliation.reconciled ? '#065f46' : '#991b1b',
            border: `1px solid ${reconciliation.reconciled ? '#a7f3d0' : '#fecaca'}`,
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '11.5px',
            fontWeight: 700
          }}>
            {reconciliation.reconciled ? <CheckCircle2 size={14} color="#059669" /> : <AlertTriangle size={14} color="#dc2626" />}
            <span>
              Đối Soát KPI vs Drill-Down: {reconciliation.reconciled ? 'Khớp 100% (Lệch: 0)' : `Lệch ${reconciliation.variance} bản ghi`}
            </span>
          </div>
        </div>

        {/* Table of Source Records */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '12px', color: '#64748b' }}>
                <th style={{ padding: '10px 12px' }}>MÃ ĐƠN / ID</th>
                <th style={{ padding: '10px 12px' }}>CỬA HÀNG</th>
                <th style={{ padding: '10px 12px' }}>KHÁCH HÀNG (MASKED PII)</th>
                <th style={{ padding: '10px 12px' }}>BƯU CỤC / MÃ VẬN ĐƠN</th>
                <th style={{ padding: '10px 12px' }}>VẤN ĐỀ CHI TIẾT</th>
                <th style={{ padding: '10px 12px' }}>THỜI ĐIỂM</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loadingDrilldown ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px' }} />
                    <div>Đang tải bản ghi nguồn đối chứng...</div>
                  </td>
                </tr>
              ) : drilldownData.records.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                    <CheckCircle2 size={26} color="#10b981" style={{ margin: '0 auto 8px' }} />
                    <div>Không phát hiện vi phạm nào thuộc nhóm [{DATA_QUALITY_LABELS[activeKpi]?.label}] trong kỳ {range}.</div>
                  </td>
                </tr>
              ) : (
                drilldownData.records.map((r, i) => (
                  <tr key={r.record_id || i} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '12.5px' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-main)' }}>
                      <div>{r.order_code || '—'}</div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {r.record_id ? String(r.record_id).slice(0, 8) + '...' : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{r.shop_name || 'Shop'}</div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        {r.shop_id ? String(r.shop_id).slice(0, 8) : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{r.customer_name_masked || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{r.customer_phone_masked || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{r.carrier || 'N/A'}</div>
                      <div style={{ fontSize: '11px', color: r.tracking_code ? '#2563eb' : '#dc2626', fontFamily: 'monospace' }}>
                        {r.tracking_code || '(Trống vận đơn)'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        background: '#fef2f2',
                        color: '#991b1b',
                        display: 'inline-block'
                      }}>
                        {r.issue_description || 'Sai lệch dữ liệu'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {r.detected_at ? new Date(r.detected_at).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handlePreviewFix(r)}
                        disabled={resolvingId === r.record_id}
                        style={{
                          background: '#f1f5f9',
                          color: '#1e293b',
                          border: '1px solid #cbd5e1',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {resolvingId === r.record_id ? 'Đang lưu...' : 'Xem / Xử Lý'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PREVIEW & CONFIRMATION MODAL (GUARD AGAINST BLIND BULK FIXES) */}
      {previewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Xem Trước & Xác Nhận Xử Lý Dữ Liệu</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Hệ thống tuyệt đối không tự sửa hàng loạt dữ liệu khách hàng. Mọi hành động giải quyết sai lệch đều được lưu vết kiểm toán (Audit Trail) phục vụ đối soát.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12.5px' }}>
              <div><b>Mã đơn:</b> {previewModal.record.order_code || '—'}</div>
              <div><b>Cửa hàng:</b> {previewModal.record.shop_name} ({previewModal.record.shop_id})</div>
              <div><b>Vấn đề:</b> {previewModal.record.issue_description}</div>
              <div><b>Khách hàng:</b> {previewModal.record.customer_name_masked} - {previewModal.record.customer_phone_masked}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Ghi chú khắc phục / kiểm toán:
              </label>
              <textarea
                value={previewModal.notes}
                onChange={e => setPreviewModal({ ...previewModal, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  fontSize: '12.5px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirmFix}
                disabled={resolvingId !== ''}
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={15} /> Xác Nhận Giải Quyết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
