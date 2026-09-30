import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function AddressDataset() {
  const [subTab, setSubTab] = useState('global_knowledge'); // 'global_knowledge' | 'datasets'

  // State cho Sub-Tab 1: Datasets
  const [versions, setVersions] = useState([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [datasetError, setDatasetError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [workflow, setWorkflow] = useState({});

  // State cho Sub-Tab 2: Global Knowledge & Candidates
  const [candidates, setCandidates] = useState([]);
  const [globalAliases, setGlobalAliases] = useState([]);
  const [loadingKb, setLoadingKb] = useState(true);
  const [kbError, setKbError] = useState('');
  const [searchKb, setSearchKb] = useState('');
  
  // Modal State cho Phê duyệt hoặc Thêm mới Global Alias
  const [modalMode, setModalMode] = useState(null); // 'promote' | 'add' | null
  const [targetCandidate, setTargetCandidate] = useState(null);
  const [inputRawKey, setInputRawKey] = useState('');
  const [inputMapping, setInputMapping] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // State cho Chỉnh sửa trực tiếp (Inline Editing) & Chọn nhiều để duyệt (Multi-Select Bulk Approval)
  const [editedMappings, setEditedMappings] = useState({});
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // Helper trích xuất địa chỉ chuẩn hóa từ sample_normalized_value
  const getDefaultMapping = useCallback((c) => {
    if (!c) return '';
    if (typeof c.sample_normalized_value === 'string') return c.sample_normalized_value;
    if (c.sample_normalized_value) {
      const v = c.sample_normalized_value;
      return [v.street, v.ward, v.district, v.province].filter(Boolean).join(', ') || v.fullAddress || JSON.stringify(v);
    }
    return '';
  }, []);

  const getRowMapping = useCallback((c) => {
    if (!c) return '';
    if (editedMappings[c.raw_key] !== undefined) {
      return editedMappings[c.raw_key];
    }
    return getDefaultMapping(c);
  }, [editedMappings, getDefaultMapping]);

  const handleInlineMappingChange = (rawKey, val) => {
    setEditedMappings(prev => ({
      ...prev,
      [rawKey]: val
    }));
  };

  // ─── FETCH DỮ LIỆU DATASETS ───
  const fetchVersions = useCallback(async () => {
    setLoadingDatasets(true);
    setDatasetError('');
    const res = await AdminService.getAddressDatasets();
    if (res.success) {
      setVersions(res.data || []);
    } else {
      setDatasetError(res.error || 'Cannot load address datasets');
    }
    setLoadingDatasets(false);
  }, []);

  // ─── FETCH DỮ LIỆU TRI THỨC TOÀN CẦU & ỨNG VIÊN ───
  const fetchGlobalKnowledge = useCallback(async () => {
    setLoadingKb(true);
    setKbError('');
    try {
      const [candRes, aliasRes] = await Promise.all([
        AdminService.getLearningCandidates(100),
        AdminService.getGlobalAliases()
      ]);

      if (candRes.success) {
        setCandidates(candRes.data || []);
      } else {
        setKbError(candRes.error || 'Không thể tải danh sách ứng viên học máy');
      }

      if (aliasRes.success) {
        setGlobalAliases(aliasRes.data || []);
      }
    } catch (err) {
      setKbError(err.message || 'Lỗi kết nối');
    } finally {
      setLoadingKb(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'datasets') {
      fetchVersions();
    } else {
      fetchGlobalKnowledge();
    }
  }, [subTab, fetchVersions, fetchGlobalKnowledge]);

  // ─── HÀNH ĐỘNG DUYỆT TOÀN CẦU (PROMOTE TO GLOBAL) ───
  const handleOpenPromoteModal = (cand) => {
    setTargetCandidate(cand);
    setInputRawKey(cand.raw_key || '');
    setInputMapping(getRowMapping(cand));
    setModalMode('promote');
  };

  const handleOpenAddModal = () => {
    setTargetCandidate(null);
    setInputRawKey('');
    setInputMapping('');
    setModalMode('add');
  };

  // Duyệt 1 mục trực tiếp với giá trị trong ô input (Single Inline Promote)
  const handleInlineSinglePromote = async (cand) => {
    const raw = cand.raw_key;
    const map = getRowMapping(cand).trim();
    if (!raw || !map) {
      alert('Vui lòng nhập địa chỉ chuẩn hóa trước khi duyệt.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await AdminService.promoteToGlobalAlias(raw, map);
      if (res.success) {
        setSelectedKeys(prev => {
          const next = new Set(prev);
          next.delete(raw);
          return next;
        });
        fetchGlobalKnowledge();
      } else {
        alert('Lỗi phê duyệt: ' + res.error);
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitGlobalAlias = async (e) => {
    if (e) e.preventDefault();
    const orig = inputRawKey.trim().toLowerCase();
    const map = inputMapping.trim();
    if (!orig || !map) {
      alert('Vui lòng nhập cả từ viết tắt và địa chỉ chuẩn hóa.');
      return;
    }

    setIsSubmitting(true);
    const res = await AdminService.promoteToGlobalAlias(orig, map);
    setIsSubmitting(false);

    if (res.success) {
      setModalMode(null);
      fetchGlobalKnowledge();
    } else {
      alert('Lỗi phê duyệt: ' + res.error);
    }
  };

  const handleDeleteGlobalAlias = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    const res = await AdminService.deleteGlobalAlias(deleteTarget.id);
    setIsSubmitting(false);

    if (res.success) {
      setDeleteTarget(null);
      fetchGlobalKnowledge();
    } else {
      alert('Lỗi xóa: ' + res.error);
    }
  };

  // ─── THỐNG KÊ TỔNG QUAN TRI THỨC ───
  const kbStats = useMemo(() => {
    const totalPromoted = globalAliases.length;
    const pendingCandidates = candidates.filter(c => !c.is_promoted).length;
    const totalHits = candidates.reduce((acc, c) => acc + Number(c.total_hits || 0), 0);
    return { totalPromoted, pendingCandidates, totalHits };
  }, [globalAliases, candidates]);

  const filteredCandidates = useMemo(() => {
    if (!searchKb.trim()) return candidates;
    const q = searchKb.toLowerCase().trim();
    return candidates.filter(c =>
      (c.raw_key && c.raw_key.toLowerCase().includes(q)) ||
      (c.sample_normalized_value && JSON.stringify(c.sample_normalized_value).toLowerCase().includes(q))
    );
  }, [candidates, searchKb]);

  const unpromotedCandidates = useMemo(() => {
    return filteredCandidates.filter(c => !c.is_promoted);
  }, [filteredCandidates]);

  const isAllSelected = useMemo(() => {
    if (unpromotedCandidates.length === 0) return false;
    return unpromotedCandidates.every(c => selectedKeys.has(c.raw_key));
  }, [unpromotedCandidates, selectedKeys]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys(new Set());
    } else {
      const next = new Set(selectedKeys);
      unpromotedCandidates.forEach(c => next.add(c.raw_key));
      setSelectedKeys(next);
    }
  };

  const toggleSelectCandidate = (rawKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(rawKey)) next.delete(rawKey);
      else next.add(rawKey);
      return next;
    });
  };

  const handleBulkPromote = async () => {
    if (selectedKeys.size === 0) return;
    const selectedList = candidates.filter(c => selectedKeys.has(c.raw_key));
    const entries = selectedList.map(c => {
      const raw = c.raw_key;
      const map = getRowMapping(c).trim();
      return { raw_key: raw, mapping: map };
    }).filter(item => item.raw_key && item.mapping);

    if (entries.length === 0) {
      alert('Không có mục nào có địa chỉ chuẩn hóa hợp lệ để phê duyệt.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn phê duyệt ${entries.length} quy tắc viết tắt này áp dụng cho toàn hệ thống?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await AdminService.promoteBatchGlobalAliases(entries);
      if (res.success) {
        alert(`🎉 Đã phê duyệt thành công ${res.data?.promoted_count || entries.length} quy tắc vào từ điển toàn cầu!`);
        setSelectedKeys(new Set());
        fetchGlobalKnowledge();
      } else {
        alert('Lỗi phê duyệt hàng loạt: ' + res.error);
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGlobalAliases = useMemo(() => {
    if (!searchKb.trim()) return globalAliases;
    const q = searchKb.toLowerCase().trim();
    return globalAliases.filter(a =>
      (a.original && a.original.toLowerCase().includes(q)) ||
      (a.mapping && a.mapping.toLowerCase().includes(q))
    );
  }, [globalAliases, searchKb]);

  // ─── CÁC HÀM XỬ LÝ WORKFLOW DATASET (GIỮ NGUYÊN) ───
  const setDatasetStage = (datasetId, stage, detail = '') => {
    setWorkflow(prev => ({ ...prev, [datasetId]: { stage, detail, updatedAt: new Date().toISOString() } }));
  };

  const validateDataset = (dataset) => {
    if (!dataset?.id || !dataset?.version || Number(dataset.total_records || 0) <= 0) {
      setDatasetStage(dataset.id, 'validation_failed', 'Missing version or record count.');
      return;
    }
    setDatasetStage(dataset.id, 'validated', `${Number(dataset.total_records || 0).toLocaleString()} records validated`);
  };

  const previewDataset = (dataset) => {
    setDatasetStage(
      dataset.id,
      'previewed',
      `Preview diff ready for ${dataset.version}: ${dataset.description || 'no release note'}`
    );
  };

  const testDataset = (dataset) => {
    const hasImportTimestamp = Boolean(dataset.published_at || dataset.created_at);
    setDatasetStage(dataset.id, hasImportTimestamp ? 'tested' : 'test_failed', hasImportTimestamp ? 'Smoke test passed' : 'Missing import timestamp');
  };

  const releaseDataset = async (dataset, action) => {
    const state = workflow[dataset.id];
    if (state?.stage !== 'tested') {
      setDatasetStage(dataset.id, 'blocked', 'Validate, preview diff, and test before release.');
      return;
    }
    const reason = window.prompt(`Reason for ${action} ${dataset.version}:`);
    if (!reason?.trim()) return;

    setActionLoading(dataset.id);
    const res = await AdminService.activateAddressDataset(dataset, action, reason);
    if (res.success) {
      setVersions(prev => prev.map(v => (
        v.id === dataset.id ? { ...v, is_active: true } : { ...v, is_active: false }
      )));
      setDatasetStage(dataset.id, 'monitoring', res.data?.monitor_required ? 'Monitoring enabled after release' : 'Release complete');
    } else {
      setDatasetStage(dataset.id, 'release_failed', res.error || 'Release failed');
      alert('Error: ' + res.error);
    }
    setActionLoading(null);
  };

  const actionForDataset = (dataset) => dataset.published_at ? 'rollback' : 'publish';

  const buttonStyle = {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px'
  };

  // ─── KHAI PHÁ DỮ LIỆU LỊCH SỬ HỆ THỐNG ĐỂ HỌC MÁY ───
  const [isMining, setIsMining] = useState(false);
  const handleMineHistoricalKnowledge = async () => {
    if (!window.confirm('Hệ thống sẽ quét toàn bộ dữ liệu đơn gửi lịch sử và khách hàng để trích xuất tri thức nạp vào hàng đợi học máy. Bạn có muốn tiếp tục?')) {
      return;
    }
    setIsMining(true);
    try {
      const res = await AdminService.mineHistoricalKnowledge(null);
      if (res.success) {
        const d = res.data || {};
        alert(`🎉 Khai phá lịch sử thành công!\n- Đơn quét: ${d.total_orders_scanned || 0}\n- Địa chỉ học được: ${d.learned_addresses_count || 0}\n- Khách hàng/SĐT học được: ${d.learned_customers_count || 0}\n\nDanh sách ứng viên đã được tự động cập nhật để bạn duyệt.`);
        fetchGlobalKnowledge();
      } else {
        alert('Lỗi khai phá lịch sử: ' + res.error);
      }
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      setIsMining(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Sub-Nav Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Quản Trị Địa Chỉ & Tri Thức Học Máy Toàn Cầu
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Kiểm soát tri thức bóc tách địa chỉ, phê duyệt các từ khóa thông dụng từ cộng đồng các Shop áp dụng cho cả hệ thống.
          </p>
        </div>

        {/* Sub Navigation Switcher */}
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setSubTab('global_knowledge')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: subTab === 'global_knowledge' ? '#ffffff' : 'transparent',
              color: subTab === 'global_knowledge' ? '#2563eb' : '#64748b',
              boxShadow: subTab === 'global_knowledge' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            🌐 Tri Thức Toàn Cầu & Học Máy ({kbStats.totalPromoted})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('datasets')}
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              background: subTab === 'datasets' ? '#ffffff' : 'transparent',
              color: subTab === 'datasets' ? '#2563eb' : '#64748b',
              boxShadow: subTab === 'datasets' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            📁 Datasets Hành Chính Chuẩn
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: TRI THỨC TOÀN CẦU & ỨNG VIÊN HỌC MÁY (GLOBAL KB)  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'global_knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metric Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #2563eb' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Quy Tắc Toàn Cầu (Đang Kích Hoạt)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                {kbStats.totalPromoted} <span style={{ fontSize: '13px', fontWeight: 500, color: '#16a34a' }}>áp dụng toàn hệ thống</span>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Ứng Viên Chờ Kiểm Duyệt
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                {kbStats.pendingCandidates} <span style={{ fontSize: '13px', fontWeight: 500, color: '#d97706' }}>từ dữ liệu sửa của các shop</span>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Tổng Lượt Khớp Cộng Đồng
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                {kbStats.totalHits.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>lần bóc tách thành công</span>
              </div>
            </div>
          </div>

          {/* Filter & Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <input
                type="text"
                placeholder="Tìm kiếm từ khóa gốc hoặc địa chỉ chuẩn..."
                value={searchKb}
                onChange={(e) => setSearchKb(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleMineHistoricalKnowledge}
                disabled={isMining}
                style={{
                  background: isMining ? '#cbd5e1' : '#fef3c7',
                  color: isMining ? '#64748b' : '#92400e',
                  border: '1px solid #fde68a',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: isMining ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                {isMining ? '⏳ Đang Khai Phá...' : '⛏️ Khai Phá Lịch Sử Đơn Hàng'}
              </button>
              <button
                type="button"
                onClick={fetchGlobalKnowledge}
                style={{
                  background: '#f8fafc',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                🔄 Làm mới
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                ➕ Thêm Quy Tắc Toàn Cầu
              </button>
            </div>
          </div>


          {kbError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
              {kbError}
            </div>
          )}

          {/* THANH THAO TÁC HÀNG LOẠT (BULK ACTION BAR) */}
          {selectedKeys.size > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '12px 18px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 800, color: '#1d4ed8', fontSize: '14px' }}>
                  ✓ Đã chọn {selectedKeys.size} mục ứng viên
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set())}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline'
                  }}
                >
                  Bỏ chọn tất cả
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleBulkPromote}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                  }}
                >
                  ⚡ Phê Duyệt Hàng Loạt ({selectedKeys.size})
                </button>
              </div>
            </div>
          )}

          {/* 1. BẢNG ỨNG VIÊN HỌC MÁY TỪ CÁC SHOP (CANDIDATES QUEUE) */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                  🎯 Hàng Đợi Ứng Viên Học Máy Từ Các Shop (Cross-Shop Candidates)
                </span>
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
                  (Những từ khóa địa chỉ xuất hiện nhiều shop & có tỷ lệ chính xác cao)
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{filteredCandidates.length} ứng viên</span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      disabled={unpromotedCandidates.length === 0}
                      title="Chọn tất cả ứng viên chờ duyệt"
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th style={{ padding: '10px 16px', width: '180px' }}>Từ Khóa Thô (Raw Key)</th>
                  <th style={{ padding: '10px 16px' }}>
                    Địa Chỉ Chuẩn Hóa Gợi Ý 
                    <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'normal', marginLeft: '6px' }}>
                      (✎ Cho phép chỉnh sửa trực tiếp)
                    </span>
                  </th>
                  <th style={{ padding: '10px 16px', width: '100px' }}>Đồng Thuận</th>
                  <th style={{ padding: '10px 16px', width: '90px' }}>Số Lần Khớp</th>
                  <th style={{ padding: '10px 16px', width: '90px' }}>Độ Tin Cậy</th>
                  <th style={{ padding: '10px 16px', width: '130px' }}>Trạng Thái</th>
                  <th style={{ padding: '10px 16px', width: '160px', textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {loadingKb ? (
                  <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Đang tổng hợp ứng viên học máy từ toàn bộ hệ thống...</td></tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Không có ứng viên nào cần duyệt lúc này.</td></tr>
                ) : (
                  filteredCandidates.map((c, idx) => {
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: selectedKeys.has(c.raw_key) ? '#f0fdf4' : c.is_promoted ? '#f8fafc' : '#ffffff' }}>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(c.raw_key)}
                            disabled={c.is_promoted}
                            onChange={() => toggleSelectCandidate(c.raw_key)}
                            style={{ cursor: c.is_promoted ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                          <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                            {c.raw_key}
                          </span>
                        </td>
                        <td style={{ padding: '8px 16px', color: '#334155' }}>
                          {c.is_promoted ? (
                            <span style={{ color: '#64748b' }}>
                              {getRowMapping(c) || <span style={{ color: '#94a3b8' }}>Chưa có mapping chi tiết</span>}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text"
                                value={getRowMapping(c)}
                                onChange={(e) => handleInlineMappingChange(c.raw_key, e.target.value)}
                                placeholder="Nhập địa chỉ chuẩn hóa..."
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  fontSize: '12.5px',
                                  border: editedMappings[c.raw_key] !== undefined ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  background: editedMappings[c.raw_key] !== undefined ? '#eff6ff' : '#ffffff',
                                  color: '#0f172a',
                                  outline: 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Bấm vào để sửa trực tiếp địa chỉ chuẩn hóa trước khi duyệt"
                              />
                              {editedMappings[c.raw_key] !== undefined && editedMappings[c.raw_key] !== getDefaultMapping(c) && (
                                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, whiteSpace: 'nowrap' }} title="Đã sửa trực tiếp">
                                  ✎ Đã sửa
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            {c.shop_count || 1} Shop
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>
                          {c.total_hits || 1}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: Number(c.avg_confidence) >= 90 ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                            {c.avg_confidence}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {c.is_promoted ? (
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                              ✓ ĐÃ ÁP DỤNG
                            </span>
                          ) : (
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                              ⏳ Chờ Duyệt
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {c.is_promoted ? (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Đã kích hoạt</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleInlineSinglePromote(c)}
                                title="Duyệt ngay quy tắc này với địa chỉ chuẩn hóa đã nhập"
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: '5px',
                                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)'
                                }}
                              >
                                ⚡ Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPromoteModal(c)}
                                title="Mở hộp thoại xem chi tiết và duyệt"
                                style={{
                                  background: '#f8fafc',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  padding: '5px 8px',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 600
                                }}
                              >
                                Chi tiết
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 2. BẢNG TỪ ĐIỂN TOÀN HỆ THỐNG ĐANG ÁP DỤNG (ACTIVE GLOBAL ALIASES) */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', marginTop: '10px' }}>
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                  🌐 Danh Sách Quy Tắc Toàn Cầu Đang Kích Hoạt ({globalAliases.length})
                </span>
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
                  (Tất cả người dùng trên toàn hệ thống đều tự động được hưởng các từ khóa này)
                </span>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', width: '220px' }}>Từ Khóa Viết Tắt</th>
                  <th style={{ padding: '10px 16px' }}>Địa Chỉ Chuẩn Hóa Áp Dụng</th>
                  <th style={{ padding: '10px 16px', width: '150px' }}>Ngày Kích Hoạt</th>
                  <th style={{ padding: '10px 16px', width: '100px', textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {loadingKb ? (
                  <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Đang nạp từ điển toàn cầu...</td></tr>
                ) : filteredGlobalAliases.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có quy tắc toàn cầu nào được kích hoạt.</td></tr>
                ) : (
                  filteredGlobalAliases.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                        <span style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                          {item.original}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        {item.mapping}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          Thu hồi
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: DATASETS HÀNH CHÍNH (GIỮ NGUYÊN)                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'datasets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Address Dataset Versioning & Release</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Validate, preview diff, test, publish or rollback, then monitor production impact.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={fetchVersions}
                style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                Refresh
              </button>
              <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                Import Dataset
              </button>
            </div>
          </div>

          {datasetError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
              {datasetError}
            </div>
          )}

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Version</th>
                  <th style={{ padding: '12px 16px' }}>Records</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Published</th>
                  <th style={{ padding: '12px 16px' }}>Description</th>
                  <th style={{ padding: '12px 16px' }}>Workflow</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingDatasets ? (
                  <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading datasets...</td></tr>
                ) : versions.length === 0 && !datasetError ? (
                  <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No datasets yet.</td></tr>
                ) : (
                  versions.map(v => {
                    const state = workflow[v.id] || { stage: v.is_active ? 'monitoring' : 'observed', detail: v.is_active ? 'Production dataset' : 'Ready for validation' };
                    const releaseAction = actionForDataset(v);

                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{v.version}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>{Number(v.total_records || 0).toLocaleString()} wards</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: v.is_active ? '#dcfce7' : '#f1f5f9', color: v.is_active ? '#15803d' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {v.is_active ? 'ACTIVE (PRODUCTION)' : 'ARCHIVED'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          {v.published_at ? new Date(v.published_at).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.description || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>{state.stage}</div>
                          <div style={{ fontSize: '12px', marginTop: '2px' }}>{state.detail}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {v.is_active ? (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Monitoring</span>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                              <button onClick={() => validateDataset(v)} style={buttonStyle}>Validate</button>
                              <button onClick={() => previewDataset(v)} disabled={!['validated', 'previewed', 'tested'].includes(state.stage)} style={buttonStyle}>Preview diff</button>
                              <button onClick={() => testDataset(v)} disabled={state.stage !== 'previewed'} style={buttonStyle}>Test</button>
                              <button
                                onClick={() => releaseDataset(v, releaseAction)}
                                disabled={actionLoading === v.id || state.stage !== 'tested'}
                                style={{ background: releaseAction === 'publish' ? '#dcfce7' : '#fee2e2', color: releaseAction === 'publish' ? '#15803d' : '#991b1b', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: actionLoading === v.id ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: actionLoading === v.id ? 0.6 : 1 }}
                              >
                                {actionLoading === v.id ? 'Working...' : releaseAction}
                              </button>
                            </div>
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL DUYỆT / THÊM MỚI QUY TẮC TOÀN CẦU (PROMOTE / ADD)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {modalMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '540px', maxWidth: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                {modalMode === 'promote' ? '⚡ Phê Duyệt Quy Tắc Áp Dụng Toàn Hệ Thống' : '➕ Thêm Mới Quy Tắc Toàn Cầu'}
              </h3>
              <button onClick={() => setModalMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>✕</button>
            </div>

            {modalMode === 'promote' && targetCandidate && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
                💡 Ứng viên này đã xuất hiện ở <strong>{targetCandidate.shop_count || 1} Shop</strong> với <strong>{targetCandidate.total_hits || 1} lượt khớp</strong> và độ tin cậy <strong>{targetCandidate.avg_confidence}%</strong>.
              </div>
            )}

            <form onSubmit={handleSubmitGlobalAlias} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  TỪ KHÓA THÔ VIẾT TẮT (RAW KEY)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: kcx tân thuận, qbt, kcn vsip 1"
                  value={inputRawKey}
                  onChange={(e) => setInputRawKey(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  ĐỊA CHỈ CHUẨN HÓA TOÀN CẦU (MAPPING HÀNH CHÍNH)
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Ví dụ: Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP Hồ Chí Minh"
                  value={inputMapping}
                  onChange={(e) => setInputMapping(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmitting}
                  style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Đang Lưu...' : 'Phê Duyệt Toàn Hệ Thống'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL XÁC NHẬN THU HỒI QUY TẮC TOÀN CẦU                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '440px', maxWidth: '100%', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
              ⚠️ Xác Nhận Thu Hồi Quy Tắc Toàn Cầu
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn thu hồi từ khóa toàn cầu <strong>"{deleteTarget.original}"</strong>? Sau khi thu hồi, các shop sẽ không còn tự động áp dụng quy tắc này nữa.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isSubmitting}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteGlobalAlias}
                disabled={isSubmitting}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                {isSubmitting ? 'Đang Xóa...' : 'Xác Nhận Thu Hồi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
