import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users, UserCheck, ShieldAlert, Star, Search, Download,
  Phone, MapPin, Package, Wallet, Clock, RefreshCw,
  Tag, AlertTriangle, CheckCircle2, ChevronRight, X, ExternalLink
} from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { createCustomerRepository } from '../../../../application/customer/customer.repository.js';
import { mapCustomerDashboard, saveCustomerNote, saveCustomerTag } from '../../../../application/customer/customer.service.js';
import { runCustomerSyncJob, parseCustomerFile, exportCustomersCsv } from '../../../../application/customer/customer-import.service.js';
import { NetworkRiskService } from '../../../../application/customer/network-risk.service.js';
import Pagination from '../../components/Pagination';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('vi-VN');

const normalizePhone = (p) => String(p || '').replace(/\D/g, '');

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

export default function CustomerHub() {
  const [customers, setCustomers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(() => (typeof window !== 'undefined' && window.__af_global_search) || '');
  const [filterSegment, setFilterSegment] = useState('all'); // all, vip, repeat, risk, new
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customTags, setCustomTags] = useState({});
  const [customerNotes, setCustomerNotes] = useState({});
  const [newNoteText, setNewNoteText] = useState('');
  const [syncProgress, setSyncProgress] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [permission, setPermission] = useState({ canManage: false, canExport: false, canViewPhone: true });
  const [networkRisk, setNetworkRisk] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [search, filterSegment]);

  const repositoryRef = useRef(null);
  const importInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let sess = null;
      let config = null;
      try { sess = await AuthSession.getSession(); } catch (_) {}
      try { config = await globalThis.SupabaseCloud.loadConfig(); } catch (_) {}

      // 1. Thử nạp từ Cloud Customer Hub Repository nếu có cấu hình & phiên đăng nhập
      if (sess?.active_shop_id && sess?.access_token && config?.url && config?.anonKey) {
        try {
          const repository = createCustomerRepository({ config, session: sess });
          repositoryRef.current = repository;
          const role = await repository.getCurrentRole().catch(() => String(sess.role_code || sess.role || sess.member_role || 'STAFF').toUpperCase());
          const canManage = /OWNER|MANAGER|SYSTEM_ADMIN/.test(role);
          setPermission({ canManage, canExport: /OWNER|SYSTEM_ADMIN/.test(role), canViewPhone: canManage });
          let dashboard = await repository.loadDashboard();
          if (dashboard && Array.isArray(dashboard.customers) && dashboard.customers.length > 0) {
            const migrationKey = `customer_hub_cloud_migrated_${repository.shopId}`;
            if (!localStorage.getItem(migrationKey) && dashboard.customers.length) {
              try {
                const legacyTags = JSON.parse(localStorage.getItem('customer_crm_tags') || '{}');
                const legacyNotes = JSON.parse(localStorage.getItem('customer_crm_notes') || '{}');
                for (const row of dashboard.customers) {
                  const phone = row.normalized_phone || normalizePhone(row.phone);
                  if (legacyTags[phone]) await repository.assignTag(row.id, legacyTags[phone]);
                  for (const note of legacyNotes[phone] || []) await repository.addNote(row.id, note.text || note.content || '', note.author || 'Dữ liệu cũ');
                }
                localStorage.setItem(migrationKey, new Date().toISOString());
                localStorage.removeItem('customer_crm_tags'); localStorage.removeItem('customer_crm_notes');
                dashboard = await repository.loadDashboard();
              } catch (migrationError) { console.warn('[CustomerHub] Legacy migration deferred:', migrationError); }
            }
            const mapped = mapCustomerDashboard(dashboard, { canViewFullPhone: canManage });
            const tags = {};
            mapped.customers.forEach(customer => { if (customer.manualTag) tags[customer.phone] = customer.manualTag; });
            setCustomTags(tags);
            setCustomerNotes(mapped.notesByPhone);
            setCustomers(mapped.customers.sort((a, b) => b.totalSpent - a.totalSpent));
            setAllOrders(mapped.customers.flatMap(customer => customer.orders));
            setLoading(false);
            return;
          }
        } catch (cloudError) {
          console.warn('[CustomerHub] Cloud schema unavailable, using local aggregation:', cloudError);
        }
      }

      // 2. Nạp toàn bộ đơn hàng từ OrderStorage (bộ nhớ cục bộ Extension) + Supabase REST
      const valueOf = (item, ...keys) => {
        if (!item || typeof item !== 'object') return '';
        for (const key of keys) {
          const val = item[key];
          if (val !== undefined && val !== null && String(val).trim() !== '') return val;
        }
        return '';
      };

      const fetchPromises = [
        typeof OrderStorage !== 'undefined' && typeof OrderStorage.getSubmittedOrders === 'function'
          ? OrderStorage.getSubmittedOrders().catch(() => [])
          : Promise.resolve([]),
        typeof OrderStorage !== 'undefined' && typeof OrderStorage.getOrders === 'function'
          ? OrderStorage.getOrders().catch(() => [])
          : Promise.resolve([])
      ];

      const activeShopId = sess?.active_shop_id || '';
      if (activeShopId && sess?.access_token && config?.url && config?.anonKey) {
        const headers = {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        };
        const base = `${String(config.url).replace(/\/$/, '')}/rest/v1/`;
        fetchPromises.push(
          fetch(`${base}orders?shop_id=eq.${encodeURIComponent(activeShopId)}&deleted_at=is.null&order=created_at.desc&limit=500&select=*`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`${base}submitted_orders?shop_id=eq.${encodeURIComponent(activeShopId)}&order=submitted_at.desc&limit=1000&select=*`, { headers }).then(r => r.ok ? r.json() : []).catch(() => [])
        );
      }

      const [localSubsRes, localDraftsRes, cloudDraftsRes, cloudSubsRes] = await Promise.allSettled(fetchPromises);

      const subsStorage = localSubsRes?.status === 'fulfilled' && Array.isArray(localSubsRes.value) ? localSubsRes.value : [];
      const draftsStorage = localDraftsRes?.status === 'fulfilled' && Array.isArray(localDraftsRes.value) ? localDraftsRes.value : [];
      const draftsApi = cloudDraftsRes?.status === 'fulfilled' && Array.isArray(cloudDraftsRes.value) ? cloudDraftsRes.value : [];
      const subsApi = cloudSubsRes?.status === 'fulfilled' && Array.isArray(cloudSubsRes.value) ? cloudSubsRes.value : [];

      const allSubmittedSource = [...(Array.isArray(subsApi) ? subsApi : []), ...subsStorage].filter(o => {
        if (!o) return false;
        if (!activeShopId) return true;
        const sId = String(o.shopId || o.shop_id || '');
        return sId === activeShopId;
      });
      const allDraftsSource = [...(Array.isArray(draftsApi) ? draftsApi : []), ...draftsStorage].filter(o => {
        if (!o) return false;
        if (!activeShopId) return true;
        const sId = String(o.shopId || o.shop_id || '');
        return sId === activeShopId;
      });

      const seenSubKeys = new Set();
      const submittedList = allSubmittedSource.map(o => {
        if (!o) return null;
        const phone = normalizePhone(valueOf(o, 'phone', 'customer_phone', 'customerPhone', 'sdt', 'soDienThoai'));
        const orderCode = String(valueOf(o, 'order_code', 'orderCode', 'code', 'ma_don') || '').trim().toLowerCase();
        const id = String(valueOf(o, 'id', 'saved_order_id', 'savedOrderId') || '').trim();
        const savedId = String(valueOf(o, 'saved_order_id', 'savedOrderId') || '').trim();
        const tracking = String(valueOf(o, 'tracking_code', 'trackingCode', 'tracking') || '').trim().toLowerCase();
        const name = String(valueOf(o, 'name', 'customer_name', 'customerName', 'ten_khach') || '').trim();

        if (id) seenSubKeys.add('id_' + id);
        if (savedId && savedId !== '—' && savedId !== '-') seenSubKeys.add('id_' + savedId);
        if (tracking && tracking !== '—' && tracking !== '-' && tracking !== 'chờ cập nhật mã') {
          seenSubKeys.add('tr_' + tracking);
        }
        if (phone && phone.length >= 9 && orderCode && orderCode !== '—' && orderCode !== '-') seenSubKeys.add('oc_' + phone + '_' + orderCode);

        return {
          id: id || `sub_${Date.now()}_${Math.random()}`,
          type: 'submitted',
          code: valueOf(o, 'order_code', 'orderCode', 'code') || tracking || `#${id.slice(0, 8)}`,
          trackingCode: tracking,
          name: name || 'Khách hàng',
          phone: phone,
          address: String(valueOf(o, 'address', 'customer_address', 'customerAddress', 'dia_chi') || '').trim(),
          cod: Number(valueOf(o, 'cod_amount', 'codAmount', 'cod', 'tien_thu_ho')) || 0,
          carrier: String(valueOf(o, 'platform', 'carrier', 'hang_van_chuyen') || 'VNPost'),
          status: String(valueOf(o, 'status', 'trang_thai') || 'submitted'),
          date: String(valueOf(o, 'submitted_at', 'submittedAt', 'created_at', 'createdAt', 'date') || new Date().toISOString())
        };
      }).filter(Boolean);

      const activeDraftsList = allDraftsSource.filter(o => {
        if (!o) return false;
        const s = String(valueOf(o, 'status') || '').toLowerCase();
        if (s.includes('submitted')) return false;
        const id = String(valueOf(o, 'id', 'saved_order_id', 'savedOrderId') || '').trim();
        const phone = normalizePhone(valueOf(o, 'phone', 'customer_phone', 'customerPhone', 'sdt'));
        if (id && seenSubKeys.has('id_' + id)) return false;
        const orderCode = String(valueOf(o, 'order_code', 'orderCode', 'code') || '').trim().toLowerCase();
        if (phone && orderCode && seenSubKeys.has('oc_' + phone + '_' + orderCode)) return false;
        return true;
      }).map(o => {
        const id = String(valueOf(o, 'id') || '').trim();
        const phone = normalizePhone(valueOf(o, 'phone', 'customer_phone', 'sdt'));
        return {
          id: id || `draft_${Date.now()}_${Math.random()}`,
          type: 'draft',
          code: String(valueOf(o, 'order_code', 'orderCode', 'code') || `#${id.slice(0, 8)}`),
          trackingCode: '',
          name: String(valueOf(o, 'name', 'customer_name', 'customerName') || 'Khách hàng'),
          phone: phone,
          address: String(valueOf(o, 'address', 'customer_address') || '').trim(),
          cod: Number(valueOf(o, 'cod_amount', 'codAmount', 'cod')) || 0,
          carrier: String(valueOf(o, 'platform', 'carrier') || 'VNPost'),
          status: String(valueOf(o, 'status') || 'draft'),
          date: String(valueOf(o, 'created_at', 'createdAt', 'date') || new Date().toISOString())
        };
      });

      const rawList = [...submittedList, ...activeDraftsList];

      setAllOrders(rawList);

      // Group into Customers 360 Map
      const custMap = new Map();

      rawList.forEach(item => {
        if (!item.phone || item.phone.length < 9) return;
        const phoneKey = item.phone;
        const existing = custMap.get(phoneKey);

        if (!existing) {
          custMap.set(phoneKey, {
            phone: phoneKey,
            name: item.name !== 'Khách hàng' && item.name ? item.name : 'Khách hàng',
            primaryAddress: item.address || '',
            totalOrders: 1,
            successfulOrders: item.type === 'submitted' ? 1 : 0,
            failedOrders: item.status?.toLowerCase().includes('fail') ? 1 : 0,
            totalSpent: item.cod,
            firstOrderDate: item.date,
            lastOrderDate: item.date,
            orders: [item]
          });
        } else {
          existing.totalOrders += 1;
          if (item.type === 'submitted') existing.successfulOrders += 1;
          if (item.status?.toLowerCase().includes('fail')) existing.failedOrders += 1;
          existing.totalSpent += item.cod;
          if (item.name && item.name !== 'Khách hàng' && (!existing.name || existing.name === 'Khách hàng')) {
            existing.name = item.name;
          }
          if (item.address && !existing.primaryAddress) {
            existing.primaryAddress = item.address;
          }
          if (new Date(item.date) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = item.date;
            if (item.address) existing.primaryAddress = item.address;
          }
          if (new Date(item.date) < new Date(existing.firstOrderDate)) {
            existing.firstOrderDate = item.date;
          }
          existing.orders.push(item);
        }
      });

      const customerArray = Array.from(custMap.values()).map(c => {
        const aov = c.totalOrders > 0 ? c.totalSpent / c.totalOrders : 0;
        const successRate = c.totalOrders > 0 ? (c.successfulOrders / c.totalOrders) * 100 : 0;
        
        let calculatedTag = 'new';
        if (c.totalSpent >= 2000000 || c.totalOrders >= 5) {
          calculatedTag = 'vip';
        } else if (c.totalOrders >= 2) {
          calculatedTag = 'repeat';
        } else if (c.failedOrders > 0 || successRate < 50) {
          calculatedTag = 'risk';
        }

        return {
          ...c,
          aov,
          successRate,
          autoTag: calculatedTag
        };
      });

      // Sort by total spent descending
      customerArray.sort((a, b) => b.totalSpent - a.totalSpent);
      setCustomers(customerArray);

    } catch (err) {
      console.error('Lỗi tải CRM Khách Hàng:', err);
      setError(err.message || 'Không thể tải dữ liệu khách hàng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let debounceTimer = null;
    const triggerDebouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 350);
    };

    // 1. Lắng nghe thay đổi storage từ chrome.storage.onChanged
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local') {
        const hasRelevantKey = Object.keys(changes).some(k => 
          k.includes('submitted') || 
          k.includes('order') || 
          k.includes('customer') || 
          k === 'last_submitted_order_sync' || 
          k === 'last_cloud_order_sync' || 
          k === 'activeShopId'
        );
        if (hasRelevantKey) {
          triggerDebouncedLoad();
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // 2. Lắng nghe runtime message từ service worker hoặc panel
    const handleRuntimeMessage = (msg) => {
      if (msg && (
        msg.type === 'cloud_sync_update' || 
        msg.type === 'order_submitted' || 
        msg.type === 'submitted_orders_updated' || 
        msg.action === 'refresh_orders' || 
        msg.action === 'ordersUpdated'
      )) {
        triggerDebouncedLoad();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    // 3. Lắng nghe custom events nội bộ từ window (phát từ App.jsx realtime hoặc OrderStorage)
    window.addEventListener('customer-hub-updated', triggerDebouncedLoad);
    window.addEventListener('submitted-orders-updated', triggerDebouncedLoad);
    window.addEventListener('orders-updated', triggerDebouncedLoad);
    window.addEventListener('order-saved-db', triggerDebouncedLoad);

    const handleWindowStorage = (e) => {
      if (e && e.key && (e.key.includes('submitted') || e.key.includes('order') || e.key.includes('customer'))) {
        triggerDebouncedLoad();
      }
    };
    window.addEventListener('storage', handleWindowStorage);

    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') triggerDebouncedLoad(); };
    const interval = window.setInterval(refreshWhenVisible, 60000);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('customer-hub-updated', triggerDebouncedLoad);
      window.removeEventListener('submitted-orders-updated', triggerDebouncedLoad);
      window.removeEventListener('orders-updated', triggerDebouncedLoad);
      window.removeEventListener('order-saved-db', triggerDebouncedLoad);
      window.removeEventListener('storage', handleWindowStorage);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
    };
  }, [loadData]);

  // Synchronize search with global options:search and options:navigate events
  useEffect(() => {
    const handleSearchEvent = (e) => {
      if (e?.detail?.search !== undefined) {
        setSearch(e.detail.search);
      }
    };
    window.addEventListener('options:search', handleSearchEvent);
    window.addEventListener('options:navigate', handleSearchEvent);
    return () => {
      window.removeEventListener('options:search', handleSearchEvent);
      window.removeEventListener('options:navigate', handleSearchEvent);
    };
  }, []);

  // Handle Note Save
  const handleAddNote = async (phone) => {
    if (!newNoteText.trim()) return;
    const customer = customers.find(item => item.phone === phone);
    if (repositoryRef.current && customer?.id) {
      const previous = customerNotes;
      const optimisticNote = { id: `pending-${Date.now()}`, text: newNoteText.trim(), date: new Date().toISOString() };
      try {
        await saveCustomerNote(repositoryRef.current, customer.id, newNoteText.trim(), '', {
          apply: () => setCustomerNotes(current => ({ ...current, [phone]: [optimisticNote, ...(current[phone] || [])] })),
          rollback: () => setCustomerNotes(previous)
        });
        setNewNoteText('');
        loadData();
        return;
      } catch (noteError) {
        setError(noteError.message || 'Không thể lưu ghi chú.');
        return;
      }
    }
    const existing = customerNotes[phone] || [];
    const updated = [
      { text: newNoteText.trim(), date: new Date().toISOString() },
      ...existing
    ];
    const newNotesObj = { ...customerNotes, [phone]: updated };
    setCustomerNotes(newNotesObj);
    setNewNoteText('');
  };

  // Handle Manual Tag Override
  const handleSetTag = async (phone, tag) => {
    const customer = customers.find(item => item.phone === phone);
    if (repositoryRef.current && customer?.id) {
      const previous = customTags;
      try { await saveCustomerTag(repositoryRef.current, customer.id, tag, '#2563eb', { apply: () => setCustomTags(current => ({ ...current, [phone]: tag })), rollback: () => setCustomTags(previous) }); }
      catch (tagError) { setError(tagError.message || 'Không thể cập nhật nhãn.'); return; }
      return;
    }
    const newTags = { ...customTags, [phone]: tag };
    setCustomTags(newTags);
  };

  const handleBackfill = async () => {
    const repository = repositoryRef.current;
    if (!repository || !permission.canManage) return;
    setSyncProgress({ processed: 0, total: 0, success: 0, errors: 0 });
    setError('');
    try {
      const [orders, submitted] = await Promise.all([
        repository.request(`orders?shop_id=eq.${repository.shopId}&deleted_at=is.null&limit=10000&select=*`),
        repository.request(`submitted_orders?shop_id=eq.${repository.shopId}&deleted_at=is.null&limit=10000&select=*`)
      ]);
      const list = [
        ...(orders || []).map(item => ({ ...item, _sourceType: 'order' })),
        ...(submitted || []).map(item => ({ ...item, _sourceType: 'submitted_order' }))
      ];
      setSyncProgress(current => ({ ...current, total: list.length }));
      // Source type is preserved per row to keep idempotency across both tables.
      let processed = 0; let success = 0; const errors = [];
      const jobRows = await repository.createJob('backfill', list.length); const job = jobRows?.[0];
      for (const item of list) {
        try { await repository.syncOrder(item, item._sourceType); success += 1; }
        catch (syncError) { errors.push({ id: item.id, message: syncError.message }); }
        processed += 1;
        if (processed % 50 === 0 || processed === list.length) {
          setSyncProgress({ processed, total: list.length, success, errors: errors.length });
          if (job?.id) await repository.updateJob(job.id, { cursor_value: String(processed), processed_rows: processed, success_rows: success, error_rows: errors.length });
        }
      }
      if (job?.id) await repository.updateJob(job.id, { status: errors.length ? 'partial' : 'completed', completed_at: new Date().toISOString(), error_report: errors });
      await loadData();
    } catch (syncError) { setError(syncError.message || 'Không thể quét đơn lịch sử.'); }
    finally { setSyncProgress(null); }
  };

  const handleImportFile = async event => {
    const file = event.target.files?.[0]; if (!file || !repositoryRef.current || !permission.canManage) return;
    setError('');
    try {
      const parsed = await parseCustomerFile(file);
      setImportPreview({ ...parsed, file });
    } catch (importError) { setError(importError.message || 'Không thể nhập tệp.'); }
    finally { event.target.value = ''; }
  };

  const confirmImport = async () => {
    const preview = importPreview; if (!preview?.rows.length || !repositoryRef.current) return;
    setSyncProgress({ processed: 0, total: preview.rows.length, success: 0, errors: preview.errors.length });
    try {
      const result = await runCustomerSyncJob(repositoryRef.current, preview.rows, { onProgress: progress => setSyncProgress({ ...progress, errors: progress.errors + preview.errors.length }) });
      const allErrors = [...preview.errors, ...result.errors];
      if (allErrors.length) setError(`Đã nhập ${result.success} dòng; ${allErrors.length} dòng cần kiểm tra.`);
      setImportPreview(allErrors.length ? { ...preview, errors: allErrors, rows: [] } : null);
      await loadData();
    } catch (importError) { setError(importError.message || 'Không thể nhập tệp.'); }
    finally { setSyncProgress(null); }
  };

  const remapImportField = async (field, header) => {
    if (!importPreview?.file) return;
    try {
      const mapping = { ...(importPreview.mapping || {}), [field]: header };
      const parsed = await parseCustomerFile(importPreview.file, { mapping });
      setImportPreview({ ...parsed, mapping, file: importPreview.file });
    } catch (mappingError) { setError(mappingError.message); }
  };

  const downloadImportErrors = () => {
    const rows = importPreview?.errors || []; if (!rows.length) return;
    const content = `\uFEFFDòng,Lỗi\n${rows.map(item => `${item.row || item.id || ''},"${String(item.message || item.error || '').replace(/"/g, '""')}"`).join('\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'customer-import-errors.csv'; link.click(); URL.revokeObjectURL(url);
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Search
      if (search.trim()) {
        const q = search.trim();
        const cleanQ = removeVietnameseTones(q);
        const qDigits = normalizePhone(q);
        const nameNorm = removeVietnameseTones(c.name || '');
        const addrNorm = removeVietnameseTones(c.primaryAddress || '');
        const phoneNorm = normalizePhone(c.phone);

        const matchName = nameNorm.includes(cleanQ);
        const matchPhone = qDigits.length >= 3 && (phoneNorm.includes(qDigits) || phoneNorm.endsWith(qDigits));
        const matchAddr = addrNorm.includes(cleanQ);
        if (!matchName && !matchPhone && !matchAddr) return false;
      }

      // Segment filter
      const activeTag = customTags[c.phone] || c.autoTag;
      if (filterSegment === 'vip') return activeTag === 'vip';
      if (filterSegment === 'repeat') return c.totalOrders >= 2;
      if (filterSegment === 'risk') return activeTag === 'risk';
      if (filterSegment === 'new') return c.totalOrders === 1;

      return true;
    });
  }, [customers, search, filterSegment, customTags]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = customers.length;
    const vipCount = customers.filter(c => (customTags[c.phone] || c.autoTag) === 'vip').length;
    const repeatCount = customers.filter(c => c.totalOrders >= 2).length;
    const repeatRate = totalCount > 0 ? (repeatCount / totalCount) * 100 : 0;
    const totalLTV = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgLTV = totalCount > 0 ? totalLTV / totalCount : 0;

    return { totalCount, vipCount, repeatRate, avgLTV, totalLTV };
  }, [customers, customTags]);

  // Export CSV
  const handleExportCSV = async () => {
    if (filteredCustomers.length === 0 || !permission.canExport) return;
    const csvContent = exportCustomersCsv(filteredCustomers);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CRM_KhachHang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    repositoryRef.current?.audit('CUSTOMER_EXPORT', { count: filteredCustomers.length, filter: filterSegment, search: Boolean(search) }).catch(() => {});
  };

  const getTagBadge = (phone, autoTag) => {
    const tag = customTags[phone] || autoTag;
    switch (tag) {
      case 'vip':
        return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Star size={12} /> Khách VIP</span>;
      case 'repeat':
        return <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><UserCheck size={12} /> Khách Quen</span>;
      case 'risk':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ShieldAlert size={12} /> Nguy cơ Bom</span>;
      default:
        return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600 }}>Khách mới</span>;
    }
  };

  const checkNetworkRisk = async () => {
    const phone = normalizePhone(search);
    if (phone.length < 9) return alert('Nhập số điện thoại đầy đủ vào ô tìm kiếm trước khi kiểm tra mạng lưới.');
    try { setNetworkRisk(await NetworkRiskService.check(phone)); } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Orientation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-main)' }}>
            Sổ Bạ Khách Hàng (Customer Hub & 360 Profile)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
            Quản lý tập trung thông tin khách hàng, tổng chi tiêu LTV, tỷ lệ mua lại và nhận diện sớm rủi ro bom hàng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input ref={importInputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={handleImportFile} />
          {permission.canManage && (
            <>
              <button onClick={handleBackfill} disabled={loading || Boolean(syncProgress)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                Quét đơn lịch sử
              </button>
              <button onClick={() => importInputRef.current?.click()} disabled={loading || Boolean(syncProgress)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-main)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                Import CSV/XLSX
              </button>
            </>
          )}
          <button onClick={checkNetworkRisk} disabled={normalizePhone(search).length < 9} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--warning)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', fontWeight: 700, cursor: 'pointer' }}>Kiểm tra rủi ro liên Shop</button>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--card)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'dash-spin' : ''} />
            Làm mới
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || filteredCustomers.length === 0 || !permission.canExport}
            title={!permission.canExport ? 'Chỉ Chủ Shop được xuất dữ liệu khách hàng' : 'Xuất danh sách đang lọc'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: 'var(--primary)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Download size={14} />
            Xuất Excel/CSV
          </button>
        </div>
      </div>

      {networkRisk && <div role="status" style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${networkRisk.risk_level === 'high' ? '#ef4444' : networkRisk.risk_level === 'medium' ? '#f59e0b' : '#cbd5e1'}`, background: networkRisk.risk_level === 'high' ? '#fef2f2' : networkRisk.risk_level === 'medium' ? '#fffbeb' : '#f8fafc' }}><strong>Mạng lưới rủi ro: {String(networkRisk.risk_level || 'unknown').toUpperCase()}</strong><span style={{ marginLeft: 10, color: '#64748b' }}>{networkRisk.privacy_threshold_met ? `${networkRisk.reporting_shops} Shop · ${networkRisk.reports} báo cáo` : 'Chưa đủ ngưỡng riêng tư để kết luận'}</span></div>}

      {importPreview && (
        <div style={{ padding: '14px', border: '1px solid #bfdbfe', borderRadius: '10px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
            <div><strong>Xem trước dữ liệu import</strong><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Ánh xạ nhận diện: {Object.entries(importPreview.mapping || {}).filter(([, value]) => value).map(([key, value]) => `${key} → ${value}`).join(' · ') || 'Chưa nhận diện'}</div></div>
            <button onClick={() => setImportPreview(null)} aria-label="Đóng xem trước" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '8px', marginTop: '10px' }}>
            {[['phone','Số điện thoại'],['name','Tên khách'],['address','Địa chỉ'],['orderCode','Mã đơn'],['codAmount','COD']].map(([field,label]) => <label key={field} style={{ fontSize: '11px', fontWeight: 700 }}>{label}<select value={importPreview.mapping?.[field] || ''} onChange={event => remapImportField(field,event.target.value)} style={{ display: 'block', width: '100%', marginTop: '3px', padding: '6px' }}><option value="">Không ánh xạ</option>{(importPreview.headers || []).map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}
          </div>
          {importPreview.rows.length > 0 && <div style={{ overflowX: 'auto', marginTop: '10px' }}><table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}><thead><tr>{['Tên','SĐT','Địa chỉ','Mã đơn','COD'].map(label => <th key={label} style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid var(--border)' }}>{label}</th>)}</tr></thead><tbody>{importPreview.rows.slice(0, 5).map(row => <tr key={row.id}><td style={{ padding: '6px' }}>{row.name}</td><td>{row.phone}</td><td>{row.address}</td><td>{row.orderCode}</td><td>{num.format(row.codAmount)}</td></tr>)}</tbody></table></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '12px' }}>{importPreview.rows.length} dòng hợp lệ · {importPreview.errors.length} lỗi</span><div style={{ display: 'flex', gap: '8px' }}>{importPreview.errors.length > 0 && <button onClick={downloadImportErrors}>Tải báo cáo lỗi</button>}{importPreview.rows.length > 0 && <button onClick={confirmImport} style={{ background: 'var(--primary)', color: '#fff', border: 0, borderRadius: '7px', padding: '7px 12px', fontWeight: 700 }}>Xác nhận import</button>}</div></div>
        </div>
      )}

      {syncProgress && (
        <div style={{ padding: '12px 14px', border: '1px solid #bfdbfe', borderRadius: '10px', background: '#eff6ff', color: '#1e40af' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
            <span>Đang đồng bộ khách hàng</span><span>{syncProgress.processed}/{syncProgress.total}</span>
          </div>
          <div style={{ height: '6px', marginTop: '8px', borderRadius: '999px', overflow: 'hidden', background: '#dbeafe' }}><div style={{ width: `${syncProgress.total ? Math.round(syncProgress.processed * 100 / syncProgress.total) : 0}%`, height: '100%', background: '#2563eb' }} /></div>
          <div style={{ marginTop: '6px', fontSize: '11px' }}>Thành công: {syncProgress.success} · Cần kiểm tra: {syncProgress.errors}</div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '18px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>
            <span>TỔNG KHÁCH HÀNG</span>
            <Users size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
            {loading ? '...' : num.format(metrics.totalCount)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tổng số khách hàng từng lên đơn
          </div>
        </div>

        <div className="card" style={{ padding: '18px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>
            <span>KHÁCH HÀNG VIP</span>
            <Star size={16} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--warning)' }}>
            {loading ? '...' : num.format(metrics.vipCount)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Chi tiêu ≥ 2.000.000đ hoặc ≥ 5 đơn
          </div>
        </div>

        <div className="card" style={{ padding: '18px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>
            <span>TỶ LỆ QUAY LẠI</span>
            <UserCheck size={16} color="var(--success)" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px', color: 'var(--success)' }}>
            {loading ? '...' : `${metrics.repeatRate.toFixed(1)}%`}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Khách có từ 2 đơn hàng trở lên
          </div>
        </div>

        <div className="card" style={{ padding: '18px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>
            <span>GIÁ TRỊ VÒNG ĐỜI (LTV TB)</span>
            <Wallet size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
            {loading ? '...' : money.format(metrics.avgLTV)}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Trung bình chi tiêu / mỗi khách hàng
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Segment Switcher */}
      <div style={{
        background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={e => {
              const val = e.target.value;
              setSearch(val);
              if (typeof window !== 'undefined') window.__af_global_search = val;
            }}
            placeholder="Tìm theo Tên, Số điện thoại, Địa chỉ..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid var(--border)',
              fontSize: '13px', outline: 'none', background: '#f8fafc'
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                if (typeof window !== 'undefined') {
                  window.__af_global_search = '';
                  window.dispatchEvent(new CustomEvent('options:search', { detail: { search: '' } }));
                }
              }}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Segments */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `Tất cả (${customers.length})` },
            { key: 'vip', label: `⭐ VIP (${metrics.vipCount})` },
            { key: 'repeat', label: `🔄 Khách quen` },
            { key: 'risk', label: `⚠️ Nguy cơ bom` },
            { key: 'new', label: `Khách mới` }
          ].map(seg => (
            <button
              key={seg.key}
              onClick={() => setFilterSegment(seg.key)}
              style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: filterSegment === seg.key ? 700 : 500,
                border: filterSegment === seg.key ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: filterSegment === seg.key ? 'var(--brand-50)' : '#fff',
                color: filterSegment === seg.key ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              {seg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Customers Table */}
      <div style={{ background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="dash-spin" style={{ display: 'inline-block', marginBottom: '8px' }}>🔄</div>
            <div>Đang tải sổ bạ khách hàng...</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--danger)' }}>
            <AlertTriangle size={28} style={{ marginBottom: '8px' }} />
            <div style={{ fontWeight: 700 }}>{error}</div>
            <button onClick={loadData} style={{ marginTop: '12px', padding: '6px 14px', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && filteredCustomers.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={36} color="var(--border)" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Không tìm thấy khách hàng nào</div>
            <p style={{ fontSize: '13px', margin: '4px 0 14px 0' }}>{customers.length ? 'Thử thay đổi từ khóa hoặc phân đoạn.' : 'Quét đơn đã có để khởi tạo Sổ bạ mà không cần nhập tay.'}</p>
            {!customers.length && permission.canManage && <button onClick={handleBackfill} style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Quét toàn bộ đơn lịch sử</button>}
          </div>
        )}

        {!loading && !error && filteredCustomers.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 700, position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ padding: '12px 16px' }}>KHÁCH HÀNG</th>
                  <th style={{ padding: '12px 16px' }}>SỐ ĐIỆN THOẠI</th>
                  <th style={{ padding: '12px 16px' }}>ĐỊA CHỈ THƯỜNG GIAO</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>SỐ ĐƠN</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>TỔNG CHI TIÊU (LTV)</th>
                  <th style={{ padding: '12px 16px' }}>PHÂN LOẠI</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map(cust => (
                  <tr
                    key={cust.phone}
                    onClick={() => setSelectedCustomer(cust)}
                    style={{
                      borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{cust.name}</div>
                      {cust.orders.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Đơn gần nhất: {new Date(cust.lastOrderDate).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                      {cust.phone}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cust.primaryAddress || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                      <span style={{ background: 'var(--bg)', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        {cust.totalOrders}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                      {money.format(cust.totalSpent)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getTagBadge(cust.phone, cust.autoTag)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(cust);
                        }}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                          padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--primary)'
                        }}
                      >
                        Hồ sơ 360 →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!loading && !error && filteredCustomers.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filteredCustomers.length}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="khách hàng"
          />
        )}
      </div>

      {/* Customer 360 Detail Drawer / Modal */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
          zIndex: 9999, display: 'flex', justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%', maxWidth: '520px', background: '#fff', height: '100%',
            display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            animation: 'slideLeft 0.2s ease-out'
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.5px' }}>HỒ SƠ KHÁCH HÀNG 360</div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800 }}>{selectedCustomer.name}</h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', borderRadius: '6px', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Quick Contact Bar */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                  <Phone size={15} color="var(--primary)" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <MapPin size={15} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{selectedCustomer.primaryAddress || 'Chưa lưu địa chỉ'}</span>
                </div>
                {selectedCustomer.addresses?.length > 1 && (
                  <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'grid', gap: '5px' }}>
                    <strong style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ĐỊA CHỈ TỪNG GIAO</strong>
                    {selectedCustomer.addresses.map(address => <div key={address.id || address.address_fingerprint} style={{ fontSize: '12px' }}>• {address.raw_address} <span style={{ color: 'var(--text-muted)' }}>({address.use_count || 1} lần)</span></div>)}
                  </div>
                )}
              </div>

              {/* CRM Key Metrics 360 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TỔNG ĐƠN</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>{selectedCustomer.totalOrders}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TỔNG TIỀN (LTV)</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px', color: '#16a34a' }}>{money.format(selectedCustomer.totalSpent)}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ĐƠN GIÁ TB</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)' }}>{money.format(selectedCustomer.aov)}</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>TỶ LỆ GIAO / HÃNG ƯA THÍCH</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '4px', color: selectedCustomer.successRate < 70 ? '#dc2626' : '#16a34a' }}>{Number(selectedCustomer.successRate || 0).toFixed(0)}% · {selectedCustomer.favCarrier || '—'}</div>
                </div>
              </div>

              {/* Tag & Risk Assignment */}
              <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={14} /> PHÂN LOẠI & GẮN NHÃN CSKH:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'vip', label: '⭐ Khách VIP' },
                    { key: 'repeat', label: '🔄 Khách Quen' },
                    { key: 'risk', label: '⚠️ Nguy Cơ Bom' },
                    { key: 'new', label: 'Khách Mới' }
                  ].map(t => {
                    const currentTag = customTags[selectedCustomer.phone] || selectedCustomer.autoTag;
                    const isActive = currentTag === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => handleSetTag(selectedCustomer.phone, t.key)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: isActive ? 'var(--brand-50)' : '#f8fafc',
                          color: isActive ? 'var(--primary)' : 'var(--text-muted)'
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {permission.canManage && selectedCustomer.id && (
                  <button
                    onClick={async () => {
                      const next = !selectedCustomer.isBlacklisted;
                      const reason = next ? window.prompt('Lý do đưa khách vào danh sách cảnh báo:') : 'Gỡ cảnh báo';
                      if (next && !reason) return;
                      try { await repositoryRef.current?.setBlacklist(selectedCustomer.id, next, reason); setSelectedCustomer({ ...selectedCustomer, isBlacklisted: next, blacklistReason: next ? reason : '', riskLevel: next ? 'blacklist' : 'safe', autoTag: next ? 'risk' : selectedCustomer.autoTag }); await loadData(); }
                      catch (blacklistError) { setError(blacklistError.message || 'Không thể cập nhật cảnh báo.'); }
                    }}
                    style={{ marginTop: '10px', padding: '7px 10px', borderRadius: '6px', border: '1px solid #ef4444', background: selectedCustomer.isBlacklisted ? '#fff' : '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {selectedCustomer.isBlacklisted ? 'Gỡ khỏi danh sách cảnh báo' : 'Đưa vào danh sách cảnh báo'}
                  </button>
                )}
                {selectedCustomer.blacklistReason && <div style={{ marginTop: '8px', color: '#b91c1c', fontSize: '12px' }}>Lý do: {selectedCustomer.blacklistReason}</div>}
              </div>

              {/* Internal Staff Notes */}
              <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  📝 GHI CHÚ NỘI BỘ (CSKH & LƯU Ý GIAO HÀNG):
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="VD: Khách yêu cầu gọi trước 15p..."
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(selectedCustomer.phone); }}
                  />
                  <button
                    onClick={() => handleAddNote(selectedCustomer.phone)}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Lưu
                  </button>
                </div>
                {/* Note List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {(customerNotes[selectedCustomer.phone] || []).map((note, idx) => (
                    <div key={idx} style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--border)', borderTop: '2px solid var(--primary)' }}>
                      <div>{note.text}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(note.date).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                  {(!customerNotes[selectedCustomer.phone] || customerNotes[selectedCustomer.phone].length === 0) && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có ghi chú nào cho khách hàng này.</div>
                  )}
                </div>
              </div>

              {/* Order History */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📦 LỊCH SỬ ĐƠN HÀNG ({selectedCustomer.orders.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedCustomer.orders.map((ord, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                          {ord.code} {ord.trackingCode ? `• ${ord.trackingCode}` : ''}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          🏢 {ord.carrier} • 🕒 {new Date(ord.date).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#16a34a' }}>
                          {money.format(ord.cod)}
                        </div>
                        <span style={{
                          fontSize: '10.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                          background: ord.type === 'submitted' ? '#dcfce7' : '#f1f5f9',
                          color: ord.type === 'submitted' ? '#15803d' : '#475569'
                        }}>
                          {ord.type === 'submitted' ? 'Đã gửi' : 'Nháp'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
