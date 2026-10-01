import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, CheckSquare, Square, Eye, RotateCw, AlertTriangle, 
  CheckCircle2, XCircle, Search, Filter, Layers, FileText, ArrowRight,
  Copy, Check, ChevronLeft, ChevronRight, RefreshCw, X, Calendar, Truck, Tag,
  Palette, Sliders, Settings, Sparkles, Package, MapPin, Phone, Hash, Star
} from 'lucide-react';
import { renderBulkHtmlDocument, getPrintCss } from '../../../../application/printing/label-renderer.js';
import { OrderStorage } from '../../../../application/storage.esm.js';

function valueOf(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function removeVietnameseTones(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export function parseMarginToValues(str) {
  if (!str && str !== 0) return { mode: 'uniform', mm: 20, vMm: 10, hMm: 20 };
  const s = String(str).trim().toLowerCase();
  if (s.includes(' ')) {
    const parts = s.split(/\s+/).filter(Boolean).map(p => {
      if (p.endsWith('cm')) return parseFloat(p) * 10;
      return parseFloat(p) || 0;
    });
    const v = parts[0] !== undefined ? parts[0] : 10;
    const h = parts[1] !== undefined ? parts[1] : (parts[0] !== undefined ? parts[0] : 20);
    return {
      mode: 'split',
      mm: v,
      vMm: v,
      hMm: h
    };
  }
  let mm = 20;
  if (s === '0' || s === '0cm' || s === '0mm') mm = 0;
  else if (s === '2cm' || s === '20mm') mm = 20;
  else if (s === '1.5cm' || s === '15mm') mm = 15;
  else if (s === '1cm' || s === '10mm') mm = 10;
  else if (s === '0.5cm' || s === '5mm') mm = 5;
  else if (s.endsWith('cm')) mm = parseFloat(s) * 10;
  else if (s.endsWith('mm')) mm = parseFloat(s);
  else {
    const n = parseFloat(s);
    if (!isNaN(n)) mm = n;
  }
  return { mode: 'uniform', mm: isNaN(mm) ? 20 : mm, vMm: 10, hMm: 20 };
}

export function extractCodAmount(order) {
  if (!order) return 0;
  const raw = order.codAmount !== undefined ? order.codAmount
    : (order.cod_amount !== undefined ? order.cod_amount
    : (order.cod !== undefined ? order.cod
    : (order.tien_thu_ho !== undefined ? order.tien_thu_ho
    : (order.totalAmount !== undefined ? order.totalAmount : 0))));
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/\D/g, '');
    return Number(cleaned) || 0;
  }
  return Number(raw) || 0;
}

export function extractOrderCode(order) {
  if (!order) return '—';
  const code = order.orderCode || order.order_code || order.code || '';
  if (code && code !== '-' && code !== '—') return String(code).trim();
  const savedId = String(order.savedOrderId || order.saved_order_id || '').trim();
  if (savedId && !savedId.startsWith('sub_') && savedId !== '-' && savedId !== '—') {
    return savedId;
  }
  return '—';
}

export function extractTrackingCode(order) {
  if (!order) return '';
  const trk = order.trackingCode || order.tracking_code || order.tracking_number || '';
  if (trk && trk !== '-' && trk !== '—' && trk !== 'chờ cập nhật mã') return String(trk).trim();
  return '';
}

export function detectCarrier(order) {
  const p = String(
    valueOf(order, 'platform', 'carrier', 'carrier_id', 'carrierName') || ''
  ).toLowerCase();
  if (p.includes('jt') || p.includes('j&t')) {
    return { key: 'jt', name: 'J&T Express', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  }
  if (p.includes('viettel')) {
    return { key: 'viettelpost', name: 'Viettel Post', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
  }
  if (p.includes('ghtk')) {
    return { key: 'ghtk', name: 'GHTK', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  }
  return { key: 'vnpost', name: 'VNPost', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
}

export function getCarrierAccount(order) {
  const acc = valueOf(order, 'carrierAccount', 'carrier_account', 'senderAccount', 'sender_account', 'vnpostAccount', 'vnpost_account');
  if (acc && acc !== '-' && acc !== '—' && acc !== 'Mặc định') return acc;
  const rawName = valueOf(order, 'name', 'customer_name', 'customerName');
  const match = String(rawName).match(/\((?:acc|tài khoản|tk)?\s*([^\)]+)\)/i);
  if (match && match[1]) return match[1].trim();
  return '';
}

export function isRecipientPayingFee(order) {
  const payerValue = valueOf(order, 'shipping_fee_payer', 'collect_fee', 'collectFee', 'shippingFeePayer');
  if (payerValue === true || payerValue === 'true' || payerValue === 1 || payerValue === '1') return true;
  const payer = String(payerValue || '').toUpperCase();
  if (payer === 'RECIPIENT' || payer === 'BUYER' || payer === 'KHÁCH' || payer === 'NGƯỜI NHẬN') return true;
  return false;
}

export function wirePrintTabControls(win, initialPaperSize, initialMargin, onConfigChange, initialFontScale = 2.0) {
  if (!win) return;

  const setup = () => {
    try {
      const doc = win.document;
      if (!doc) return;

      // 1. Set clean document title
      if (!doc.title || doc.title === 'about:blank') {
        doc.title = 'In tem vận đơn VNPost chuẩn PDF';
      }

      // 2. Wire Print button
      const btnPrint = doc.getElementById('btn-print');
      if (btnPrint) {
        btnPrint.onclick = (e) => {
          e?.preventDefault?.();
          try {
            win.focus();
            win.print();
          } catch (err) {
            console.error('Print trigger error:', err);
          }
        };
      }

      // 3. Wire Close button
      const btnClose = doc.getElementById('btn-close');
      if (btnClose) {
        btnClose.onclick = (e) => {
          e?.preventDefault?.();
          try {
            win.close();
          } catch (_) {}
        };
      }

      // 4. Keyboard shortcut Ctrl+P / Cmd+P
      win.onkeydown = (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
          e.preventDefault();
          try {
            win.focus();
            win.print();
          } catch (_) {}
        }
      };

      // Helper to update dynamic print CSS and badge
      const updateStyles = (newSize, newMargin, newFontScale) => {
        try {
          const curScale = newFontScale !== undefined ? newFontScale : (parseFloat(doc.getElementById('tb-font-scale')?.value) || initialFontScale || 2.0);
          const newCss = getPrintCss(newSize, 'portrait', newMargin, curScale);
          let styleTag = doc.getElementById('print-style-sheet');
          if (!styleTag) {
            styleTag = doc.createElement('style');
            styleTag.id = 'print-style-sheet';
            doc.head.appendChild(styleTag);
          }
          styleTag.textContent = newCss;

          const badge = doc.getElementById('tb-dim-badge');
          if (badge) {
            const dimMap = {
              A4: '210 x 297 mm',
              A5: '148 x 210 mm',
              A6: '105 x 148 mm',
              K100: '100 x 150 mm',
              '100X150': '100 x 150 mm'
            };
            badge.textContent = dimMap[String(newSize).toUpperCase()] || '105 x 148 mm';
          }
        } catch (err) {
          console.warn('Error updating print styles:', err);
        }
      };

      // 5. Wire Paper Size selector
      const selPaper = doc.getElementById('tb-paper-size');
      if (selPaper) {
        selPaper.value = initialPaperSize;
        selPaper.onchange = (e) => {
          const selectedSize = e.target.value;
          const curMargin = doc.getElementById('tb-margin')?.value || initialMargin;
          const curScale = parseFloat(doc.getElementById('tb-font-scale')?.value) || initialFontScale || 2.0;
          updateStyles(selectedSize, curMargin, curScale);
          if (onConfigChange) onConfigChange(selectedSize, curMargin, false, curScale);
        };
      }

      // 6. Wire Margin selector
      const selMargin = doc.getElementById('tb-margin');
      if (selMargin) {
        selMargin.value = initialMargin;
        selMargin.onchange = (e) => {
          const selectedMargin = e.target.value;
          const curSize = doc.getElementById('tb-paper-size')?.value || initialPaperSize;
          const curScale = parseFloat(doc.getElementById('tb-font-scale')?.value) || initialFontScale || 2.0;
          updateStyles(curSize, selectedMargin, curScale);
          if (onConfigChange) onConfigChange(curSize, selectedMargin, false, curScale);
        };
      }

      // 7. Wire Font Scale selector
      const selScale = doc.getElementById('tb-font-scale');
      if (selScale) {
        selScale.value = String(initialFontScale || 2.0);
        selScale.onchange = (e) => {
          const selectedScale = parseFloat(e.target.value) || 2.0;
          const curSize = doc.getElementById('tb-paper-size')?.value || initialPaperSize;
          const curMargin = doc.getElementById('tb-margin')?.value || initialMargin;
          updateStyles(curSize, curMargin, selectedScale);
          if (onConfigChange) onConfigChange(curSize, curMargin, false, selectedScale);
        };
      }

      // 8. Wire "Đặt làm mặc định" button
      const btnDefault = doc.getElementById('tb-btn-set-default');
      if (btnDefault) {
        btnDefault.onclick = (e) => {
          e?.preventDefault?.();
          const chosenSize = doc.getElementById('tb-paper-size')?.value || initialPaperSize;
          const chosenMargin = doc.getElementById('tb-margin')?.value || initialMargin;
          const chosenScale = parseFloat(doc.getElementById('tb-font-scale')?.value) || initialFontScale || 2.0;

          try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              chrome.storage.local.set({
                default_paper_size: chosenSize,
                print_paper_size: chosenSize,
                default_print_margin: chosenMargin,
                print_margin: chosenMargin,
                default_font_scale: chosenScale,
                print_font_scale: chosenScale
              });
            }
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('default_paper_size', chosenSize);
              localStorage.setItem('print_paper_size', chosenSize);
              localStorage.setItem('default_print_margin', chosenMargin);
              localStorage.setItem('print_margin', chosenMargin);
              localStorage.setItem('default_font_scale', String(chosenScale));
              localStorage.setItem('print_font_scale', String(chosenScale));
            }
          } catch (_) {}

          if (onConfigChange) onConfigChange(chosenSize, chosenMargin, true, chosenScale);

          const origText = btnDefault.innerHTML;
          btnDefault.innerHTML = '✓ Đã lưu mặc định!';
          btnDefault.style.background = '#16a34a';
          btnDefault.style.borderColor = '#15803d';
          btnDefault.style.color = '#ffffff';
          setTimeout(() => {
            try {
              btnDefault.innerHTML = origText;
              btnDefault.style.background = '#334155';
              btnDefault.style.borderColor = '#64748b';
              btnDefault.style.color = '#f1f5f9';
            } catch (_) {}
          }, 2500);
        };
      }

      // 8. Auto-trigger print dialog after layout settles
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (_) {}
      }, 450);
    } catch (err) {
      console.warn('Error setting up print tab:', err);
    }
  };

  if (win.document && (win.document.readyState === 'complete' || win.document.readyState === 'interactive')) {
    setup();
  } else {
    setup();
    try {
      win.addEventListener('DOMContentLoaded', setup);
      win.addEventListener('load', setup);
    } catch (_) {}
  }
}

export default function PrintCenter() {
  const [orders, setOrders] = useState([]);
  // User invariant: "ĐỪNG TÍCH CHỌN TRƯỚC" -> Default to empty array []
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => (typeof window !== 'undefined' && window.__af_global_search) || '');
  const [datePreset, setDatePreset] = useState('all'); // all, today, yesterday, 7days, thisMonth, lastMonth, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all'); // all, vnpost, jt, viettelpost, ghtk
  const [feeFilter, setFeeFilter] = useState('all'); // all, recipient, sender
  const [trackingFilter, setTrackingFilter] = useState('all'); // all, has_tracking, no_tracking
  const [deliveryFilter, setDeliveryFilter] = useState('all'); // all, submitted, pending_pickup, processing, delivering, out_for_delivery, delivered, delivery_failed, returned, cancelled, reconciled
  const [statusFilter, setStatusFilter] = useState('UNPRINTED'); // ALL, UNPRINTED, PRINTED
  const [paperSize, setPaperSize] = useState('A6');
  const [defaultPaperSize, setDefaultPaperSize] = useState('A6');
  const [fontScale, setFontScale] = useState(2.0); // Default 2.0 = Chữ to gấp đôi theo yêu cầu người dùng
  const [defaultFontScale, setDefaultFontScale] = useState(2.0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewOrders, setPreviewOrders] = useState([]);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintReason, setReprintReason] = useState('');
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [itemStatuses, setItemStatuses] = useState({});
  const [copiedCode, setCopiedCode] = useState(null);

  // Template Customizer State ("CHO CHỈNH SỬA TRANG IN MẪU")
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateConfig, setTemplateConfig] = useState({
    service_title: '',
    instruction_note: 'Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay',
    custom_slogan: '',
    show_barcode: true,
    show_qr: true,
    show_signature_box: true,
    show_slogan: true,
    show_sender: true,
    show_order_meta: true
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [defaultCarrierAccount, setDefaultCarrierAccount] = useState('');

  // Sender info and print margin configuration ("CĂNG LỀ & KHỔ GIẤY MẶC ĐỊNH RÕ RÀNG")
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('BÌNH NINH, P. Điện Bàn Đông, TP. Đà Nẵng');
  const [carrierAccounts, setCarrierAccounts] = useState({});
  const [lastVnpostSenderInfo, setLastVnpostSenderInfo] = useState(null);
  const [syncingVnpost, setSyncingVnpost] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [printMargin, setPrintMargin] = useState('20mm'); // Default 2cm (cách lề 2cm theo chuẩn VNPost)
  const [defaultPrintMargin, setDefaultPrintMargin] = useState('20mm');
  const [marginMode, setMarginMode] = useState('uniform'); // 'uniform' | 'split'
  const [marginMm, setMarginMm] = useState(20);
  const [marginVerticalMm, setMarginVerticalMm] = useState(10);
  const [marginHorizontalMm, setMarginHorizontalMm] = useState(20);
  const [defaultSavedToast, setDefaultSavedToast] = useState(null); // { message: string, type: 'paper' | 'margin' }

  useEffect(() => {
    loadOrders();
    loadSenderAndPrintConfig();
  }, []);

  function showDefaultToast(message, type = 'info') {
    setDefaultSavedToast({ message, type });
    setTimeout(() => {
      setDefaultSavedToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  }

  function handleSetDefaultPaperSize(size) {
    if (!size) return;
    setDefaultPaperSize(size);
    setPaperSize(size);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          default_paper_size: size,
          print_paper_size: size
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('default_paper_size', size);
        localStorage.setItem('print_paper_size', size);
      }
    } catch (_) {}
    showDefaultToast(`Đã lưu "${size}" làm khổ giấy in mặc định!`, 'paper');
  }

  function handleSetDefaultMargin(marginVal) {
    if (!marginVal && marginVal !== 0) return;
    const norm = String(marginVal).trim();
    setDefaultPrintMargin(norm);
    setPrintMargin(norm);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          default_print_margin: norm,
          print_margin: norm
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('default_print_margin', norm);
        localStorage.setItem('print_margin', norm);
      }
    } catch (_) {}
    showDefaultToast(`Đã lưu mức căn lề "${norm}" làm mặc định!`, 'margin');
  }

  function handleSetDefaultFontScale(scaleVal) {
    const sc = parseFloat(scaleVal) || 2.0;
    setDefaultFontScale(sc);
    setFontScale(sc);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          default_font_scale: sc,
          print_font_scale: sc
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('default_font_scale', String(sc));
        localStorage.setItem('print_font_scale', String(sc));
      }
    } catch (_) {}
    showDefaultToast(`Đã lưu cỡ chữ ${Math.round(sc * 100)}% làm mặc định!`, 'font');
  }

  function applyCustomMarginMm(val) {
    const num = Math.max(0, Math.min(50, Math.round(Number(val) || 0)));
    setMarginMm(num);
    const mStr = `${num}mm`;
    setPrintMargin(mStr);
    handleUpdateSenderConfig({ printMargin: mStr });
  }

  function applySplitMarginValues(v, h) {
    const vNum = Math.max(0, Math.min(50, Math.round(Number(v) || 0)));
    const hNum = Math.max(0, Math.min(50, Math.round(Number(h) || 0)));
    setMarginVerticalMm(vNum);
    setMarginHorizontalMm(hNum);
    const mStr = `${vNum}mm ${hNum}mm`;
    setPrintMargin(mStr);
    handleUpdateSenderConfig({ printMargin: mStr });
  }

  async function loadSenderAndPrintConfig() {
    try {
      let activeShopObj = null;
      const storage = typeof OrderStorage !== 'undefined' ? OrderStorage : (globalThis.OrderStorage || null);
      if (storage && typeof storage.getActiveShop === 'function') {
        activeShopObj = await storage.getActiveShop().catch(() => null);
      }

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get([
          'vnpost_session',
          'active_shop_name',
          'activeShop',
          'carrier_account',
          'carrier_accounts',
          'last_vnpost_sender_info',
          'senderAccount',
          'sender_name',
          'senderName',
          'sender_phone',
          'senderPhone',
          'sender_address',
          'senderAddress',
          'print_margin',
          'default_print_margin',
          'print_paper_size',
          'default_paper_size',
          'print_font_scale',
          'default_font_scale',
          'order_default_settings',
          'print_template_config'
        ], (r) => {
          if (r?.carrier_accounts) {
            setCarrierAccounts(r.carrier_accounts);
          }
          if (r?.last_vnpost_sender_info) {
            setLastVnpostSenderInfo(r.last_vnpost_sender_info);
          }

          const acc = r?.sender_name ||
                      r?.senderName ||
                      r?.last_vnpost_sender_info?.name ||
                      r?.carrier_account ||
                      r?.active_shop_name ||
                      r?.vnpost_session?.active_shop_name ||
                      r?.vnpost_session?.userName ||
                      r?.senderAccount ||
                      activeShopObj?.sender_name ||
                      activeShopObj?.senderName ||
                      activeShopObj?.name ||
                      '';
          if (acc) {
            setSenderName(acc);
            setDefaultCarrierAccount(acc);
          }

          const phone = r?.sender_phone ||
                        r?.senderPhone ||
                        r?.last_vnpost_sender_info?.phone ||
                        r?.carrier_accounts?.[acc]?.phone ||
                        r?.vnpost_session?.userPhone ||
                        r?.vnpost_session?.phone ||
                        r?.vnpost_session?.sender_phone ||
                        r?.order_default_settings?.senderPhone ||
                        activeShopObj?.sender_phone ||
                        activeShopObj?.senderPhone ||
                        activeShopObj?.phone ||
                        '';
          if (phone) {
            setSenderPhone(phone);
          }

          const addr = r?.sender_address ||
                       r?.senderAddress ||
                       r?.last_vnpost_sender_info?.address ||
                       r?.carrier_accounts?.[acc]?.address ||
                       activeShopObj?.sender_address ||
                       activeShopObj?.senderAddress ||
                       '';
          if (addr) {
            setSenderAddress(addr);
          }

          // Paper size loading with explicit default
          let loadedDefaultPaper = r?.default_paper_size;
          if (!loadedDefaultPaper && typeof localStorage !== 'undefined') {
            try { loadedDefaultPaper = localStorage.getItem('default_paper_size'); } catch (_) {}
          }
          if (!loadedDefaultPaper) loadedDefaultPaper = r?.print_paper_size || 'A6';
          setDefaultPaperSize(loadedDefaultPaper);

          let currentPaper = r?.print_paper_size;
          if (!currentPaper && typeof localStorage !== 'undefined') {
            try { currentPaper = localStorage.getItem('print_paper_size'); } catch (_) {}
          }
          setPaperSize(currentPaper || loadedDefaultPaper);

          // Margin loading with explicit default
          let loadedDefaultMargin = r?.default_print_margin;
          if (!loadedDefaultMargin && typeof localStorage !== 'undefined') {
            try { loadedDefaultMargin = localStorage.getItem('default_print_margin'); } catch (_) {}
          }
          if (!loadedDefaultMargin) loadedDefaultMargin = r?.print_margin || '20mm';
          setDefaultPrintMargin(loadedDefaultMargin);

          let currentMargin = r?.print_margin;
          if (!currentMargin && typeof localStorage !== 'undefined') {
            try { currentMargin = localStorage.getItem('print_margin'); } catch (_) {}
          }
          if (!currentMargin) currentMargin = loadedDefaultMargin;
          setPrintMargin(currentMargin);

          const parsed = parseMarginToValues(currentMargin);
          setMarginMode(parsed.mode);
          setMarginMm(parsed.mm);
          setMarginVerticalMm(parsed.vMm);
          setMarginHorizontalMm(parsed.hMm);

          // Font scale loading with explicit default (2.0 = doubled font)
          let loadedDefaultScale = r?.default_font_scale;
          if (!loadedDefaultScale && typeof localStorage !== 'undefined') {
            try { loadedDefaultScale = localStorage.getItem('default_font_scale'); } catch (_) {}
          }
          const finalDefaultScale = parseFloat(loadedDefaultScale) || 2.0;
          setDefaultFontScale(finalDefaultScale);

          let currentScale = r?.print_font_scale;
          if (!currentScale && typeof localStorage !== 'undefined') {
            try { currentScale = localStorage.getItem('print_font_scale'); } catch (_) {}
          }
          setFontScale(parseFloat(currentScale) || finalDefaultScale);

          if (r?.print_template_config) {
            setTemplateConfig(prev => ({ ...prev, ...r.print_template_config }));
          } else {
            try {
              const localTpl = localStorage.getItem('print_template_config');
              if (localTpl) {
                setTemplateConfig(prev => ({ ...prev, ...JSON.parse(localTpl) }));
              }
            } catch (_) {}
          }
        });
      } else if (typeof localStorage !== 'undefined') {
        const localPaper = localStorage.getItem('default_paper_size') || 'A6';
        setDefaultPaperSize(localPaper);
        setPaperSize(localStorage.getItem('print_paper_size') || localPaper);
        const localMargin = localStorage.getItem('default_print_margin') || '20mm';
        setDefaultPrintMargin(localMargin);
        setPrintMargin(localStorage.getItem('print_margin') || localMargin);
        const parsed = parseMarginToValues(localMargin);
        setMarginMode(parsed.mode);
        setMarginMm(parsed.mm);
        setMarginVerticalMm(parsed.vMm);
        setMarginHorizontalMm(parsed.hMm);
        const localScale = parseFloat(localStorage.getItem('default_font_scale')) || 2.0;
        setDefaultFontScale(localScale);
        setFontScale(parseFloat(localStorage.getItem('print_font_scale')) || localScale);
      }
    } catch (_) {}
  }

  function handleUpdateSenderConfig(patch) {
    const nextName = patch.senderName !== undefined ? patch.senderName : senderName;
    const nextPhone = patch.senderPhone !== undefined ? patch.senderPhone : senderPhone;
    const nextAddress = patch.senderAddress !== undefined ? patch.senderAddress : senderAddress;

    if (patch.senderName !== undefined) {
      setSenderName(patch.senderName);
      setDefaultCarrierAccount(patch.senderName);
    }
    if (patch.senderPhone !== undefined) setSenderPhone(patch.senderPhone);
    if (patch.senderAddress !== undefined) setSenderAddress(patch.senderAddress);
    if (patch.printMargin !== undefined) {
      setPrintMargin(patch.printMargin);
      const parsed = parseMarginToValues(patch.printMargin);
      setMarginMode(parsed.mode);
      setMarginMm(parsed.mm);
      setMarginVerticalMm(parsed.vMm);
      setMarginHorizontalMm(parsed.hMm);
    }
    if (patch.paperSize !== undefined) setPaperSize(patch.paperSize);
    if (patch.fontScale !== undefined) {
      const sc = parseFloat(patch.fontScale) || 2.0;
      setFontScale(sc);
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const toSave = {
          sender_name: nextName,
          senderName: nextName,
          sender_phone: nextPhone,
          senderPhone: nextPhone,
          sender_address: nextAddress,
          senderAddress: nextAddress,
          print_margin: patch.printMargin !== undefined ? patch.printMargin : printMargin,
          print_paper_size: patch.paperSize !== undefined ? patch.paperSize : paperSize,
          print_font_scale: patch.fontScale !== undefined ? patch.fontScale : fontScale
        };
        if (nextName && nextName.trim()) {
          toSave.carrier_account = nextName.trim();
        }
        chrome.storage.local.set(toSave);
      }
      if (typeof localStorage !== 'undefined') {
        if (patch.printMargin !== undefined) localStorage.setItem('print_margin', patch.printMargin);
        if (patch.paperSize !== undefined) localStorage.setItem('print_paper_size', patch.paperSize);
        if (patch.fontScale !== undefined) localStorage.setItem('print_font_scale', String(patch.fontScale));
      }
    } catch (_) {}
  }

  async function handleSyncFromVnpost() {
    setSyncingVnpost(true);
    setSyncMessage('');
    try {
      let fetchedInfo = null;

      // 1. Cố gắng gửi message tới tab VNPost đang mở để cào dữ liệu mới nhất
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        try {
          const tabs = await new Promise(resolve => {
            chrome.tabs.query({ url: '*://*.vnpost.vn/*' }, resolve);
          });
          if (tabs && tabs.length > 0) {
            for (const tab of tabs) {
              try {
                const response = await new Promise(resolve => {
                  chrome.tabs.sendMessage(tab.id, { action: 'GET_VNPOST_SENDER_INFO' }, res => {
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(res);
                  });
                });
                if (response && response.success && response.info && response.info.name) {
                  fetchedInfo = response.info;
                  break;
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // 2. Nếu tab không phản hồi (hoặc chưa mở), đọc từ storage đã lưu gần nhất
      if (!fetchedInfo && typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await new Promise(resolve => {
          chrome.storage.local.get(['last_vnpost_sender_info', 'carrier_accounts', 'carrier_account'], resolve);
        });
        if (stored?.last_vnpost_sender_info?.name) {
          fetchedInfo = stored.last_vnpost_sender_info;
        } else if (stored?.carrier_account && stored?.carrier_accounts?.[stored.carrier_account]) {
          fetchedInfo = stored.carrier_accounts[stored.carrier_account];
        } else if (stored?.carrier_accounts && Object.keys(stored.carrier_accounts).length > 0) {
          const firstKey = Object.keys(stored.carrier_accounts)[0];
          fetchedInfo = stored.carrier_accounts[firstKey];
        }
      }

      if (fetchedInfo && fetchedInfo.name) {
        const patch = {
          senderName: fetchedInfo.name,
          senderPhone: fetchedInfo.phone || '',
          senderAddress: fetchedInfo.address || ''
        };
        handleUpdateSenderConfig(patch);
        setLastVnpostSenderInfo(fetchedInfo);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(['carrier_accounts'], (accRes) => {
            const accounts = accRes?.carrier_accounts || {};
            accounts[fetchedInfo.name] = {
              name: fetchedInfo.name,
              phone: fetchedInfo.phone || '',
              address: fetchedInfo.address || '',
              carrier: 'vnpost',
              updatedAt: Date.now()
            };
            chrome.storage.local.set({
              carrier_accounts: accounts,
              carrier_account: fetchedInfo.name,
              last_vnpost_sender_info: accounts[fetchedInfo.name]
            });
            setCarrierAccounts(accounts);
          });
        }
        setSyncMessage(`✅ Đã lấy thành công tài khoản: ${fetchedInfo.name}${fetchedInfo.phone ? ' - SĐT: ' + fetchedInfo.phone : ''}`);
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        setSyncMessage('⚠️ Chưa tìm thấy thông tin VNPost. Hãy mở trang tạo đơn my.vnpost.vn rồi bấm lại!');
        setTimeout(() => setSyncMessage(''), 5500);
      }
    } catch (e) {
      setSyncMessage('❌ Lỗi khi đồng bộ: ' + (e.message || 'Không xác định'));
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setSyncingVnpost(false);
    }
  }

  function handleSelectSavedAccount(accObj) {
    if (!accObj || !accObj.name) return;
    handleUpdateSenderConfig({
      senderName: accObj.name,
      senderPhone: accObj.phone || '',
      senderAddress: accObj.address || ''
    });
    setSyncMessage(`👉 Đã áp dụng tài khoản người gửi: ${accObj.name}`);
    setTimeout(() => setSyncMessage(''), 3500);
  }

  function handleUpdateTemplateConfig(patch) {
    const updated = { ...templateConfig, ...patch };
    setTemplateConfig(updated);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ print_template_config: updated });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('print_template_config', JSON.stringify(updated));
      }
    } catch (_) {}
  }

  async function loadOrders() {
    setLoading(true);
    try {
      let list = [];
      const storage = typeof OrderStorage !== 'undefined' ? OrderStorage : (globalThis.OrderStorage || null);
      if (storage && typeof storage.getSubmittedOrders === 'function') {
        list = await storage.getSubmittedOrders().catch(() => []);
      }

      // Filter out ghost/virtual corrupted records (must have real customer identifier and order identifier)
      const validOrders = (list || []).filter(o => {
        if (!o) return false;
        const name = String(valueOf(o, 'customerName', 'name', 'recipientName', 'customer_name') || '').trim();
        const phone = String(valueOf(o, 'phone', 'customerPhone', 'recipientPhone') || '').trim();
        const code = String(valueOf(o, 'orderCode', 'order_code', 'trackingCode', 'tracking_code', 'id') || '').trim();
        return (name || phone) && code;
      });

      setOrders(validOrders);

      // User request: "ĐỪNG TÍCH CHỌN TRƯỚC" -> Keep selection unselected on load
      setSelectedIds([]);
    } catch (err) {
      console.warn('[PrintCenter] Load orders failed:', err);
    } finally {
      setLoading(false);
    }
  }

  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (datePreset === 'today') {
      return { start: todayStart, end: todayEnd };
    }
    if (datePreset === 'yesterday') {
      const yestStart = new Date(todayStart);
      yestStart.setDate(yestStart.getDate() - 1);
      const yestEnd = new Date(todayEnd);
      yestEnd.setDate(yestEnd.getDate() - 1);
      return { start: yestStart, end: yestEnd };
    }
    if (datePreset === '7days') {
      const past7 = new Date(todayStart);
      past7.setDate(past7.getDate() - 6);
      return { start: past7, end: todayEnd };
    }
    if (datePreset === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: monthStart, end: todayEnd };
    }
    if (datePreset === 'lastMonth') {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: lastMonthStart, end: lastMonthEnd };
    }
    if (datePreset === 'custom' && (customStart || customEnd)) {
      const s = customStart ? new Date(customStart + 'T00:00:00') : new Date(0);
      const e = customEnd ? new Date(customEnd + 'T23:59:59') : new Date(8640000000000000);
      return { start: s, end: e };
    }
    return null;
  }, [datePreset, customStart, customEnd]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim();
    const cleanQ = removeVietnameseTones(q);
    const qDigits = normalizePhone(q);

    return orders.filter(o => {
      // 1. Filter by print status
      const isPrinted = (o.print_count && o.print_count > 0) || Boolean(o.last_printed_at);
      if (statusFilter === 'UNPRINTED' && isPrinted) return false;
      if (statusFilter === 'PRINTED' && !isPrinted) return false;

      // 2. Filter by date range
      if (dateRange) {
        const orderTime = new Date(valueOf(o, 'submittedAt', 'submitted_at', 'createdAt', 'created_at', 'submittedDate', 'submitted_date') || 0);
        if (!Number.isNaN(orderTime.getTime())) {
          if (orderTime < dateRange.start || orderTime > dateRange.end) return false;
        }
      }

      // 3. Filter by carrier
      if (carrierFilter !== 'all') {
        const carrierInfo = detectCarrier(o);
        if (carrierFilter !== carrierInfo.key) return false;
      }

      // 4. Filter by fee payer
      if (feeFilter !== 'all') {
        const isRecipient = isRecipientPayingFee(o);
        if (feeFilter === 'recipient' && !isRecipient) return false;
        if (feeFilter === 'sender' && isRecipient) return false;
      }

      // 5. Filter by tracking
      if (trackingFilter !== 'all') {
        const tracking = extractTrackingCode(o);
        const hasTracking = Boolean(tracking);
        if (trackingFilter === 'has_tracking' && !hasTracking) return false;
        if (trackingFilter === 'no_tracking' && hasTracking) return false;
      }

      // 6. Filter by delivery status
      if (deliveryFilter !== 'all') {
        const ost = String(valueOf(o, 'status') || 'submitted').toLowerCase();
        if (deliveryFilter === 'delivered' && ost !== 'delivered' && ost !== '90') return false;
        if (deliveryFilter === 'delivery_failed' && ost !== 'delivery_failed') return false;
        if (deliveryFilter === 'delivering' && ost !== 'delivering' && ost !== '70') return false;
        if (deliveryFilter === 'out_for_delivery' && ost !== 'out_for_delivery' && ost !== '80') return false;
        if (deliveryFilter === 'returned' && ost !== 'returned' && ost !== '100') return false;
        if (deliveryFilter === 'processing' && ost !== 'processing' && ost !== 'accepted' && ost !== '50') return false;
        if (deliveryFilter === 'pending_pickup' && ost !== 'pending_pickup' && ost !== 'pending' && ost !== '1') return false;
        if (deliveryFilter === 'submitted' && ost !== 'submitted' && ost !== 'created' && ost !== '0' && ost !== '') return false;
        if (deliveryFilter === 'cancelled' && ost !== 'cancelled' && ost !== 'canceled') return false;
        if (deliveryFilter === 'reconciled' && ost !== 'reconciled') return false;
      }

      // 7. Multi-field search
      if (q) {
        const rawName = String(valueOf(o, 'customerName', 'name', 'recipientName', 'customer_name') || '');
        const nameNorm = removeVietnameseTones(rawName);
        const rawPhone = normalizePhone(valueOf(o, 'phone', 'customerPhone', 'recipientPhone'));
        const rawOrderCode = String(valueOf(o, 'orderCode', 'order_code', 'code') || '').toLowerCase();
        const rawTracking = String(valueOf(o, 'trackingCode', 'tracking_code', 'tracking_number') || '').toLowerCase();
        const rawAcc = removeVietnameseTones(getCarrierAccount(o));
        const rawAddress = removeVietnameseTones(valueOf(o, 'address', 'customerAddress', 'deliveryAddress') || '');

        const matchName = nameNorm.includes(cleanQ);
        const matchPhone = qDigits ? (rawPhone.includes(qDigits) || rawPhone.endsWith(qDigits)) : false;
        const matchOrderCode = rawOrderCode.includes(q.toLowerCase());
        const matchTracking = rawTracking.includes(q.toLowerCase());
        const matchAccount = rawAcc.includes(cleanQ);
        const matchAddress = rawAddress.includes(cleanQ);

        if (!matchName && !matchPhone && !matchOrderCode && !matchTracking && !matchAccount && !matchAddress) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, dateRange, carrierFilter, feeFilter, trackingFilter, deliveryFilter, searchQuery]);

  const unprintedCount = useMemo(() => orders.filter(o => !o.print_count || o.print_count === 0).length, [orders]);
  const printedCount = useMemo(() => orders.filter(o => o.print_count && o.print_count > 0).length, [orders]);

  const selectedOrders = useMemo(() => {
    return orders.filter(o => selectedIds.includes(o.order_code || o.orderCode || o.id));
  }, [orders, selectedIds]);

  const selectedTotalCod = useMemo(() => {
    return selectedOrders.reduce((sum, o) => {
      return sum + extractCodAmount(o);
    }, 0);
  }, [selectedOrders]);

  const hasAlreadyPrintedSelected = useMemo(() => {
    return selectedOrders.some(o => (o.print_count && o.print_count > 0) || Boolean(o.last_printed_at));
  }, [selectedOrders]);

  // Paginated slice
  const paginatedOrders = useMemo(() => {
    if (pageSize === 'ALL') return filteredOrders;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredOrders.slice(start, start + size);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'ALL' || !filteredOrders.length) return 1;
    return Math.ceil(filteredOrders.length / Number(pageSize));
  }, [filteredOrders, pageSize]);

  function handleSelectAll() {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.order_code || o.orderCode || o.id));
    }
  }

  function handleToggleOrder(id) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  function handleCopy(text) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function handleOpenPreview(targetOrders = null) {
    const list = targetOrders || selectedOrders;
    if (!list || list.length === 0) return;
    setPreviewOrders(list);
    setPreviewOpen(true);
  }

  function handleStartPrint(ordersToPrint = null) {
    const list = ordersToPrint || selectedOrders;
    if (!list || list.length === 0) return;

    const hasPrinted = list.some(o => (o.print_count && o.print_count > 0) || Boolean(o.last_printed_at));
    if (hasPrinted) {
      setReprintReason('');
      setReprintModalOpen(true);
    } else {
      executeBrowserPrint('', list);
    }
  }

  async function executeBrowserPrint(reason = '', ordersToPrint = null) {
    setReprintModalOpen(false);
    const targets = ordersToPrint || (previewOpen ? previewOrders : selectedOrders);
    if (!targets || targets.length === 0) return;

    // 1. Generate multi-page printable HTML document
    const html = renderBulkHtmlDocument(
      targets,
      { ...templateConfig, paper_size: paperSize, margin: printMargin, font_scale: fontScale },
      {
        carrierAccount: senderName,
        senderName,
        senderPhone,
        senderAddress,
        defaultCarrierAccount: senderName,
        carrierAccounts,
        lastVnpostSenderInfo,
        font_scale: fontScale
      }
    );

    // 2. Open print window and inject HTML document synchronously
    let printTab = null;
    try {
      printTab = window.open('', '_blank');
      if (printTab) {
        printTab.document.open();
        printTab.document.write(html);
        printTab.document.close();
      }
    } catch (e) {
      console.warn('Direct open blank failed, trying Blob URL fallback:', e);
    }

    if (!printTab) {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        printTab = window.open(blobUrl, '_blank');
      } catch (_) {}
    }

    if (!printTab) {
      alert('Trình duyệt chặn mở popup in. Vui lòng cấp quyền cho phép mở tab in trong cài đặt (Pop-ups and redirects -> Allow).');
      return;
    }

    // 3. Attach full interactive event listeners & trigger native print
    wirePrintTabControls(printTab, paperSize, printMargin, (newSize, newMargin, isDefault, newScale) => {
      setPaperSize(newSize);
      setPrintMargin(newMargin);
      if (newScale !== undefined) {
        setFontScale(newScale);
      }
      if (isDefault) {
        setDefaultPaperSize(newSize);
        setDefaultPrintMargin(newMargin);
        if (newScale !== undefined) setDefaultFontScale(newScale);
        showDefaultToast(`Đã lưu khổ giấy (${newSize}), lề (${newMargin}), cỡ chữ (${Math.round((newScale || fontScale) * 100)}%) làm mặc định!`, 'save');
      }
    }, fontScale);

    // 3. Mark state as PRINT_REQUESTED
    const initStatuses = {};
    targets.forEach(o => {
      const key = o.order_code || o.orderCode || o.id;
      initStatuses[key] = 'PRINTED';
    });
    setItemStatuses(initStatuses);

    // 4. Invoke create_print_job_idempotent RPC (Database Persistence & Idempotency)
    const storage = typeof OrderStorage !== 'undefined' ? OrderStorage : (globalThis.OrderStorage || null);
    let shopId = null;
    if (storage && typeof storage.getActiveShop === 'function') {
      try {
        const s = await storage.getActiveShop();
        shopId = s ? (s.id || s) : null;
      } catch (_) {}
    }

    const idempotencyKey = `print_job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    let serverJobId = null;
    const clientCloud = typeof SupabaseCloud !== 'undefined' ? SupabaseCloud : (globalThis.SupabaseCloud || null);

    if (shopId && clientCloud && typeof clientCloud.rpc === 'function') {
      try {
        const itemsPayload = targets.map(o => ({
          order_id: String(o.order_code || o.orderCode || o.id),
          tracking_code: String(o.trackingCode || o.tracking_code || o.order_code || o.orderCode || o.id)
        }));

        const rpcRes = await clientCloud.rpc('create_print_job_idempotent', {
          p_shop_id: shopId,
          p_template_id: null,
          p_idempotency_key: idempotencyKey,
          p_copies: 1,
          p_printer_profile: paperSize === 'A5' ? 'A5_STANDARD' : 'A6_STANDARD',
          p_items: itemsPayload
        });

        if (rpcRes && rpcRes.job_id) {
          serverJobId = rpcRes.job_id;
        }
      } catch (err) {
        console.warn('[PrintCenter] create_print_job_idempotent RPC warning:', err);
      }
    }

    setCurrentJob({
      id: serverJobId || ('job_' + Date.now()),
      server_job_id: serverJobId,
      shop_id: shopId,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
      reprint_reason: reason,
      orders: targets
    });

    setConfirmationOpen(true);
  }

  async function handleConfirmResults() {
    if (!currentJob) return;

    try {
      // 1. Confirm print job items in Database if server job exists
      const clientCloud = typeof SupabaseCloud !== 'undefined' ? SupabaseCloud : (globalThis.SupabaseCloud || null);
      if (currentJob.server_job_id && currentJob.shop_id && clientCloud && typeof clientCloud.rpc === 'function') {
        try {
          const itemResults = currentJob.orders.map(ord => {
            const key = ord.order_code || ord.orderCode || ord.id;
            const st = itemStatuses[key] || 'PRINTED';
            return {
              order_id: String(key),
              tracking_code: String(ord.trackingCode || ord.tracking_code || key),
              status: st,
              reprint_reason: currentJob.reprint_reason || null,
              error: null
            };
          });

          await clientCloud.rpc('confirm_print_job_items', {
            p_shop_id: currentJob.shop_id,
            p_job_id: currentJob.server_job_id,
            p_item_results: itemResults
          });
        } catch (rpcErr) {
          console.warn('[PrintCenter] confirm_print_job_items RPC warning:', rpcErr);
        }
      }

      // 2. Update local storage orders
      const storage = typeof OrderStorage !== 'undefined' ? OrderStorage : (globalThis.OrderStorage || null);
      if (storage && typeof storage.saveSubmittedOrders === 'function') {
        const updatedOrders = orders.map(ord => {
          const key = ord.order_code || ord.orderCode || ord.id;
          const status = itemStatuses[key];
          if (status === 'PRINTED' || status === 'REPRINTED') {
            return {
              ...ord,
              print_count: (ord.print_count || 0) + 1,
              last_printed_at: new Date().toISOString()
            };
          }
          return ord;
        });

        await storage.saveSubmittedOrders(updatedOrders);
        setOrders(updatedOrders);
      }

      setConfirmationOpen(false);
      setCurrentJob(null);
    } catch (err) {
      console.error('[PrintCenter] Confirm failed:', err);
    }
  }

  // LIVE PAPER SIMULATOR GEOMETRY (aspect ratio + real-time margin padding + live font scale)
  const SIM_PAPER_DIMS = {
    A6: { width: 105, height: 148 },
    A5: { width: 148, height: 210 },
    A4: { width: 210, height: 297 },
    K100: { width: 100, height: 150 }
  };
  const simDim = SIM_PAPER_DIMS[paperSize] || SIM_PAPER_DIMS.A6;
  const simVmm = marginMode === 'split' ? marginVerticalMm : marginMm;
  const simHmm = marginMode === 'split' ? marginHorizontalMm : marginMm;
  const simPadV = Math.min(42, (simVmm / simDim.width) * 100);
  const simPadH = Math.min(42, (simHmm / simDim.width) * 100);
  const simFont = (base) => `${(base * fontScale).toFixed(1)}px`;
  const simBarcodeBars = [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1];

  return (
    <div className="print-center-container" style={{ padding: '20px 32px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: '0 auto', fontFamily: 'Inter, -apple-system, sans-serif', color: 'var(--text-main, #0f172a)' }}>
      {/* FLOATING DEFAULT SAVED TOAST */}
      {defaultSavedToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 999999,
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '13px',
          fontWeight: 700,
          border: '1px solid #334155',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} color="#22c55e" />
          <span>{defaultSavedToast.message}</span>
          <button
            type="button"
            onClick={() => setDefaultSavedToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* SCOPED COMPONENT STYLES */}
      <style>{`
        .pc-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          outline: none;
        }
        .pc-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pc-btn-primary {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
        }
        .pc-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .pc-btn-secondary {
          background: #ffffff;
          color: #334155;
          border-color: #cbd5e1;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .pc-btn-secondary:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #94a3b8;
        }
        .pc-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .pc-tab-btn {
          padding: 7px 14px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: transparent;
          color: #64748b;
          transition: all 0.15s;
        }
        .pc-tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .pc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
        }
        .pc-table th {
          background: #f8fafc;
          padding: 12px 14px;
          font-weight: 700;
          color: #475569;
          font-size: 11.5px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .pc-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .pc-table tr:hover td {
          background: #f8fafc;
        }
        .pc-table tr.selected td {
          background: #eff6ff;
        }
        .pc-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
        }
      `}</style>

      {/* TOP HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Printer size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.3px' }}>
              Trung tâm in nhãn vận đơn hàng loạt
            </h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Chuẩn hóa mẫu in nhiệt A6/A5 đa hãng (VNPost, J&amp;T Express, Viettel Post, GHTK), hỗ trợ chống in trùng và kiểm soát lịch sử
            </p>
          </div>
        </div>

        {/* TOP CONFIG & ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Paper / Margin / Font pickers live in the Visual Print Studio card below */}

          <button
            onClick={() => setTemplateModalOpen(true)}
            className="pc-btn pc-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Tùy chỉnh tiêu đề dịch vụ, chỉ dẫn giao hàng, câu slogan và các thành phần tem in"
          >
            <Palette size={15} style={{ color: '#7c3aed' }} />
            <span>🎨 Chỉnh sửa trang in mẫu</span>
          </button>

          <button
            onClick={() => handleOpenPreview(selectedOrders)}
            disabled={selectedOrders.length === 0}
            className="pc-btn pc-btn-secondary"
            title="Xem trước mẫu in thực tế của các đơn đã chọn"
          >
            <Eye size={15} />
            <span>Xem trước ({selectedOrders.length})</span>
          </button>

          <button
            onClick={() => handleStartPrint(selectedOrders)}
            disabled={selectedOrders.length === 0}
            className="pc-btn pc-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Mở tab in chuẩn PDF VNPost (Xem trước, Lưu PDF hoặc In nhiệt)"
          >
            <Printer size={15} />
            <span>In {selectedOrders.length} nhãn PDF</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div className="pc-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
            Tổng đơn hàng
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            {orders.length} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>đơn</span>
          </div>
        </div>

        <div className="pc-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', marginBottom: '6px' }}>
            Chưa in nhãn
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706' }}>
            {unprintedCount} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>đơn</span>
          </div>
        </div>

        <div className="pc-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: '6px' }}>
            Đang chọn in
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
            {selectedOrders.length} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>đơn</span>
          </div>
        </div>

        <div className="pc-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '6px' }}>
            Tổng tiền COD đã chọn
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669' }}>
            {selectedTotalCod.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: 600 }}>đ</span>
          </div>
        </div>
      </div>

      {/* SENDER INFO CONFIGURATION BAR */}
      <div className="pc-card" style={{ padding: '14px 18px', marginBottom: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1e293b' }}>
              👤 Thông tin người gửi (Đồng bộ tài khoản bưu cục)
            </span>
            <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              Chuẩn PDF MyVNPost
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSyncFromVnpost}
              disabled={syncingVnpost}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: syncingVnpost ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.3)',
                transition: 'all 0.2s'
              }}
              title="Lấy thông tin Tên, SĐT, Địa chỉ người gửi từ tài khoản VNPost đang mở và lưu vào hệ thống"
            >
              <RefreshCw size={13} className={syncingVnpost ? 'animate-spin' : ''} />
              <span>{syncingVnpost ? 'Đang lấy từ VNPost...' : '📥 Lấy từ trang VNPost'}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              👤 TÊN NGƯỜI GỬI (TÀI KHOẢN VNPOST)
            </div>
            <input
              type="text"
              value={senderName}
              onChange={e => handleUpdateSenderConfig({ senderName: e.target.value })}
              placeholder="VD: NGUYỄN THANH NHỰT"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
              title="Tên người gửi (Ưu tiên tên tài khoản VNPost)"
            />
          </div>

          <div style={{ flex: '1 1 150px', minWidth: '140px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              📞 SĐT NGƯỜI GỬI (CHÍNH XÁC)
            </div>
            <input
              type="text"
              value={senderPhone}
              onChange={e => handleUpdateSenderConfig({ senderPhone: e.target.value })}
              placeholder="Nhập SĐT người gửi..."
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#2563eb',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
              title="Số điện thoại người gửi (Lấy đúng SĐT tài khoản người gửi, không dùng số mặc định)"
            />
          </div>

          <div style={{ flex: '2 1 280px', minWidth: '220px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              🏠 ĐỊA CHỈ NGƯỜI GỬI
            </div>
            <input
              type="text"
              value={senderAddress}
              onChange={e => handleUpdateSenderConfig({ senderAddress: e.target.value })}
              placeholder="Địa chỉ gửi hàng..."
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12.5px',
                color: '#334155',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {syncMessage && (
          <div style={{
            marginTop: '10px',
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            background: syncMessage.startsWith('✅') || syncMessage.startsWith('👉') ? '#ecfdf5' : '#fffbeb',
            color: syncMessage.startsWith('✅') || syncMessage.startsWith('👉') ? '#065f46' : '#92400e',
            border: `1px solid ${syncMessage.startsWith('✅') || syncMessage.startsWith('👉') ? '#a7f3d0' : '#fde68a'}`
          }}>
            {syncMessage}
          </div>
        )}

        {Object.keys(carrierAccounts).length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Tài khoản VNPost đã lưu:
            </span>
            {Object.entries(carrierAccounts).map(([accName, accData]) => {
              const isSelected = senderName.trim().toLowerCase() === accName.trim().toLowerCase();
              return (
                <button
                  key={accName}
                  type="button"
                  onClick={() => handleSelectSavedAccount(accData)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: isSelected ? '#0284c7' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#0f172a',
                    border: `1.5px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '11.5px',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 1px 3px rgba(2,132,199,0.3)' : 'none',
                    transition: 'all 0.15s'
                  }}
                  title={`Chọn tài khoản ${accName} (${accData.phone || 'Chưa có SĐT'})`}
                >
                  <span>👤 {accName}</span>
                  {accData.phone && (
                    <span style={{ opacity: isSelected ? 0.9 : 0.7, fontSize: '10.5px' }}>
                      ({accData.phone})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* VISUAL PRINT STUDIO CARD ("CẤU HÌNH KHỔ GIẤY & CĂN LỀ IN MẶC ĐỊNH") */}
      <div className="pc-card" style={{ padding: '16px 20px', marginBottom: '16px', background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)', border: '2px solid #93c5fd', boxShadow: '0 2px 10px rgba(37, 99, 235, 0.10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
              <Sliders size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                📐 Visual Print Studio — Cấu hình khổ giấy &amp; Căn lề in mặc định
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Chọn khổ giấy, cỡ chữ và căn lề ở cột trái — xem ngay kết quả in ở mô phỏng trực tiếp bên phải trước khi in.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid #bfdbfe' }}>
              Khổ mặc định: <strong style={{ color: '#1d4ed8' }}>{defaultPaperSize}</strong>
            </span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid #fde68a' }}>
              Lề mặc định: <strong style={{ color: '#b45309' }}>{defaultPrintMargin}</strong>
            </span>
            <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '4px 10px', borderRadius: '6px', fontWeight: 700, border: '1px solid #ddd6fe' }}>
              Chữ mặc định: <strong style={{ color: '#6d28d9' }}>{Math.round(defaultFontScale * 100)}%</strong>
            </span>
          </div>
        </div>

        {/* 2-COLUMN VISUAL PRINT STUDIO: LEFT = CONTROLS, RIGHT = LIVE SIMULATOR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1.05fr) minmax(320px, 0.95fr)', gap: '20px', alignItems: 'start' }}>
          
          {/* COLUMN 1 (ROW 1): KHỔ GIẤY + CỠ CHỮ */}
          <div style={{ gridColumn: 1, gridRow: 1, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📄</span>
                <span>1. CHỌN KHỔ GIẤY &amp; CỠ CHỮ MẶC ĐỊNH</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Đang dùng: <strong style={{ color: '#0f172a' }}>{paperSize}</strong>
              </span>
            </div>

            {/* 4 PAPER SIZE CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {[
                {
                  id: 'A6',
                  title: 'A6 (105 x 148 mm)',
                  badge: 'Chuẩn VNPost',
                  desc: 'Tem nhiệt bưu điện VNPost, Viettel Post, J&T Express'
                },
                {
                  id: 'K100',
                  title: '100 x 150 mm (K100)',
                  badge: 'Tem cuộn TMĐT',
                  desc: 'Khổ cuộn in nhiệt phổ biến Shopee, TikTok, Lazada'
                },
                {
                  id: 'A5',
                  title: 'A5 (148 x 210 mm)',
                  badge: 'Nửa trang A4',
                  desc: 'In văn phòng máy in laser, in kim, giấy chia đôi'
                },
                {
                  id: 'A4',
                  title: 'A4 (210 x 297 mm)',
                  badge: 'Khổ A4 lớn',
                  desc: 'In văn phòng tiêu chuẩn kèm phiếu xuất kho'
                }
              ].map(item => {
                const isSelected = paperSize === item.id;
                const isDefault = defaultPaperSize === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setPaperSize(item.id);
                      handleUpdateSenderConfig({ paperSize: item.id });
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '88px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '10px', background: isSelected ? '#bfdbfe' : '#f1f5f9', color: isSelected ? '#1e40af' : '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          {item.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35, marginBottom: '8px' }}>
                        {item.desc}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                      {isDefault ? (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle2 size={13} color="#16a34a" />
                          <span>Đang là mặc định</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefaultPaperSize(item.id);
                          }}
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#2563eb',
                            cursor: 'pointer'
                          }}
                          title={`Đặt ${item.id} làm khổ giấy mặc định`}
                        >
                          ⭐ Đặt làm mặc định
                        </button>
                      )}

                      {isSelected && !isDefault && (
                        <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>
                          Đang chọn
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '11.5px', color: '#475569', background: '#eff6ff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💡</span>
              <span>
                Khổ giấy in mặc định: <strong style={{ color: '#1d4ed8' }}>{defaultPaperSize}</strong>. Khổ giấy này sẽ được tự động áp dụng khi in đơn hàng loạt.
              </span>
            </div>

            {/* FONT SCALE SEGMENTED PICKER (mặc định 200%) */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔤</span>
                  <span>Cỡ chữ in:</span>
                </div>
                {Math.abs(Number(fontScale) - Number(defaultFontScale)) < 0.05 ? (
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} color="#16a34a" />
                    <span>Đang là mặc định ({Math.round(defaultFontScale * 100)}%)</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefaultFontScale(fontScale)}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#2563eb',
                      cursor: 'pointer'
                    }}
                    title="Lưu cỡ chữ này làm mặc định cho tất cả lần in sau"
                  >
                    ⭐ Đặt làm mặc định
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { v: 2, label: '200%', sub: 'Gấp đôi' },
                  { v: 1.5, label: '150%', sub: 'Lớn' },
                  { v: 1, label: '100%', sub: 'Chuẩn' },
                  { v: 2.5, label: '250%', sub: 'Cực lớn' }
                ].map(opt => {
                  const isActive = Math.abs(Number(fontScale) - opt.v) < 0.05;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => {
                        setFontScale(opt.v);
                        handleUpdateSenderConfig({ fontScale: opt.v });
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: isActive ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                        background: isActive ? '#f5f3ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Đặt cỡ chữ ${opt.label} (${opt.sub})`}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 800, color: isActive ? '#6d28d9' : '#0f172a' }}>{opt.label}</div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: isActive ? '#7c3aed' : '#64748b' }}>{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMN 1 (ROW 2): ĐIỀU CHỈNH CĂNG LỀ IN (CANH LỀ CHI TIẾT & MẶC ĐỊNH) */}
          <div style={{ gridColumn: 1, gridRow: 2, background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📏</span>
                <span>2. ĐIỀU CHỈNH CĂNG LỀ IN (CANH LỀ CHÍNH XÁC)</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                Mức lề: {printMargin}
              </div>
            </div>

            {/* QUICK PRESET BUTTONS */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                MỨC CĂNG LỀ NHANH THÔNG DỤNG:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { label: '2cm (20mm) - Chuẩn VNPost', val: '20mm', desc: 'Cách lề 2cm theo yêu cầu bưu cục' },
                  { label: '1.5cm (15mm)', val: '15mm', desc: 'Thoáng đẹp văn phòng' },
                  { label: '1cm (10mm)', val: '10mm', desc: 'Tiêu chuẩn tiết kiệm' },
                  { label: '5mm', val: '5mm', desc: 'Lề hẹp' },
                  { label: '0mm (Sát lề)', val: '0mm', desc: 'Sát viền in nhiệt' }
                ].map(p => {
                  const isActive = printMargin === p.val || (p.val === '20mm' && printMargin === '2cm') || (p.val === '10mm' && printMargin === '1cm') || (p.val === '5mm' && printMargin === '0.5cm') || (p.val === '0mm' && printMargin === '0cm');

                  return (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => {
                        setPrintMargin(p.val);
                        const parsed = parseMarginToValues(p.val);
                        setMarginMode('uniform');
                        setMarginMm(parsed.mm);
                        handleUpdateSenderConfig({ printMargin: p.val });
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: isActive ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        background: isActive ? '#eff6ff' : '#ffffff',
                        color: isActive ? '#1d4ed8' : '#334155'
                      }}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MARGIN MODE TABS: UNIFORM VS SPLIT */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setMarginMode('uniform');
                  applyCustomMarginMm(marginMm);
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: marginMode === 'uniform' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: marginMode === 'uniform' ? '#2563eb' : '#ffffff',
                  color: marginMode === 'uniform' ? '#ffffff' : '#475569'
                }}
              >
                ⬛ Căn đều 4 cạnh ({marginMm}mm)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMarginMode('split');
                  applySplitMarginValues(marginVerticalMm, marginHorizontalMm);
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: marginMode === 'split' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: marginMode === 'split' ? '#2563eb' : '#ffffff',
                  color: marginMode === 'split' ? '#ffffff' : '#475569'
                }}
              >
                ⬚ Căn riêng (Dọc: {marginVerticalMm}mm / Ngang: {marginHorizontalMm}mm)
              </button>
            </div>

            {/* SLIDER & STEP CONTROLS */}
            {marginMode === 'uniform' ? (
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                    Khoảng cách lề (Cả 4 cạnh):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={marginMm}
                      onChange={e => applyCustomMarginMm(e.target.value)}
                      style={{
                        width: '56px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid #94a3b8',
                        fontSize: '13px',
                        fontWeight: 800,
                        textAlign: 'center',
                        color: '#0f172a'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>mm</span>
                  </div>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={marginMm}
                  onChange={e => applyCustomMarginMm(e.target.value)}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#2563eb' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px', marginBottom: '8px' }}>
                  <span>0mm (Sát mép)</span>
                  <span>10mm (1cm)</span>
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>20mm (2cm chuẩn)</span>
                  <span>35mm</span>
                </div>

                {/* Quick Step Buttons */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: '-5mm', step: -5 },
                    { label: '-1mm', step: -1 },
                    { label: '+1mm', step: 1 },
                    { label: '+5mm', step: 5 }
                  ].map(b => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => applyCustomMarginMm(marginMm + b.step)}
                      style={{
                        flex: 1,
                        padding: '4px 0',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* SPLIT MARGIN CONTROLS */
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                      Lề Trên &amp; Dưới (Dọc):
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb' }}>{marginVerticalMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    step="1"
                    value={marginVerticalMm}
                    onChange={e => applySplitMarginValues(e.target.value, marginHorizontalMm)}
                    style={{ width: '100%', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                      Lề Trái &amp; Phải (Ngang):
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb' }}>{marginHorizontalMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    step="1"
                    value={marginHorizontalMm}
                    onChange={e => applySplitMarginValues(marginVerticalMm, e.target.value)}
                    style={{ width: '100%', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                </div>
              </div>
            )}

            {/* DEFAULT MARGIN STATUS & SETTER BUTTON */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
              <div style={{ fontSize: '11.5px', color: '#475569' }}>
                Lề mặc định: <strong style={{ color: '#b45309' }}>{defaultPrintMargin}</strong>
              </div>

              {printMargin === defaultPrintMargin ? (
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} color="#16a34a" />
                  <span>Mức lề này đang là mặc định</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetDefaultMargin(printMargin)}
                  className="pc-btn"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '11.5px',
                    padding: '5px 12px',
                    fontWeight: 700,
                    borderRadius: '6px'
                  }}
                  title="Lưu mức lề hiện tại làm mặc định cho tất cả lần in sau"
                >
                  ⭐ Đặt mức lề "{printMargin}" làm mặc định
                </button>
              )}
            </div>
          </div>

          {/* COLUMN 3: MÔ PHỎNG TRỰC QUAN TRANG IN THỰC TẾ (LIVE PAPER SIMULATOR) */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={15} color="#2563eb" />
                <span>3. MÔ PHỎNG TRỰC QUAN NHÃN IN</span>
              </div>
              <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                {paperSize === 'A6' ? '105 x 148 mm' : paperSize === 'K100' ? '100 x 150 mm' : paperSize === 'A5' ? '148 x 210 mm' : '210 x 297 mm'}
              </span>
            </div>

            {/* LIVE PAPER CANVAS */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e2e8f0',
              padding: '16px 8px',
              borderRadius: '8px',
              minHeight: '340px',
              position: 'relative'
            }}>
              {(() => {
                const isK100 = paperSize === 'K100';
                const isA5 = paperSize === 'A5';
                const isA4 = paperSize === 'A4';
                const sheetWidth = isA4 ? 240 : isA5 ? 220 : isK100 ? 210 : 215;
                const sheetHeight = isA4 ? 336 : isA5 ? 310 : isK100 ? 315 : 305;
                
                const vMarginPx = marginMode === 'split' ? Math.round(marginVerticalMm * 1.2) : Math.round(marginMm * 1.2);
                const hMarginPx = marginMode === 'split' ? Math.round(marginHorizontalMm * 1.2) : Math.round(marginMm * 1.2);
                const clampedV = Math.min(38, Math.max(0, vMarginPx));
                const clampedH = Math.min(38, Math.max(0, hMarginPx));
                const fontMultiplier = fontScale ? fontScale / 2.0 : 1.0;

                return (
                  <div style={{
                    width: `${sheetWidth}px`,
                    height: `${sheetHeight}px`,
                    background: '#ffffff',
                    borderRadius: '4px',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.16)',
                    border: '1px solid #cbd5e1',
                    position: 'relative',
                    boxSizing: 'border-box',
                    padding: `${clampedV}px ${clampedH}px`,
                    transition: 'padding 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* VISUAL MARGIN GUIDELINE OVERLAY */}
                    <div style={{
                      position: 'absolute',
                      top: `${clampedV}px`,
                      left: `${clampedH}px`,
                      right: `${clampedH}px`,
                      bottom: `${clampedV}px`,
                      border: '1px dashed #93c5fd',
                      pointerEvents: 'none',
                      borderRadius: '2px',
                      zIndex: 1
                    }}>
                      <span style={{
                        position: 'absolute',
                        top: '-15px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '9px',
                        fontWeight: 700,
                        color: '#3b82f6',
                        background: '#eff6ff',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        lineHeight: 1
                      }}>
                        Lề: {printMargin}
                      </span>
                    </div>

                    {/* MOCK LABEL CONTENT */}
                    <div style={{
                      flex: 1,
                      border: '1.5px solid #0f172a',
                      borderRadius: '3px',
                      padding: '5px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      overflow: 'hidden',
                      position: 'relative',
                      zIndex: 2
                    }}>
                      {/* HEADER WITH LOGO & BARCODE */}
                      <div style={{ borderBottom: '1px solid #0f172a', paddingBottom: '3px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: `${Math.round(10.5 * fontMultiplier)}px`, fontWeight: 900, color: '#d97706' }}>
                            VNPOST BƯU ĐIỆN
                          </span>
                          <span style={{ fontSize: `${Math.round(8.5 * fontMultiplier)}px`, fontWeight: 800, background: '#0f172a', color: '#fff', padding: '1px 4px', borderRadius: '2px' }}>
                            {paperSize}
                          </span>
                        </div>
                        {/* MOCK BARCODE */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '3px 0 1px 0' }}>
                          <div style={{ display: 'flex', gap: '2px', height: '18px', alignItems: 'center' }}>
                            {[2,3,1,3,1,4,2,3,1,3,2,1,3,2,3,1,3,2,1,4,3,1,2].map((w, idx) => (
                              <div key={idx} style={{ width: `${w}px`, height: '100%', background: '#000000' }} />
                            ))}
                          </div>
                          <span style={{ fontSize: '7.5px', fontWeight: 800, letterSpacing: '0.8px', color: '#0f172a' }}>
                            EM123456789VN
                          </span>
                        </div>
                      </div>

                      {/* SENDER & RECIPIENT */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '4px', borderBottom: '1px solid #0f172a', padding: '3px 0' }}>
                        <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '3px' }}>
                          <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b' }}>NGƯỜI GỬI:</div>
                          <div style={{ fontSize: `${Math.round(9 * fontMultiplier)}px`, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {senderName || 'NGUYỄN THANH NHỰT'}
                          </div>
                          <div style={{ fontSize: `${Math.round(8 * fontMultiplier)}px`, color: '#334155' }}>
                            {senderPhone || '0901 234 567'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b' }}>NGƯỜI NHẬN:</div>
                          <div style={{ fontSize: `${Math.round(9.5 * fontMultiplier)}px`, fontWeight: 900, color: '#0f172a' }}>
                            Chị Bé Vy Mi
                          </div>
                          <div style={{ fontSize: `${Math.round(8.5 * fontMultiplier)}px`, fontWeight: 800, color: '#2563eb' }}>
                            0833 324 908
                          </div>
                          <div style={{ fontSize: `${Math.round(7.5 * fontMultiplier)}px`, color: '#334155', lineHeight: 1.15 }}>
                            51 Lê Thành Phương, P. 2, Tuy Hòa, Phú Yên
                          </div>
                        </div>
                      </div>

                      {/* COD & FOOTER */}
                      <div style={{ paddingTop: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b' }}>TIỀN THU HỘ (COD):</div>
                          <div style={{ fontSize: `${Math.round(12 * fontMultiplier)}px`, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                            1.400.000 đ
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b' }}>MÃ ĐƠN:</div>
                          <div style={{ fontSize: `${Math.round(9.5 * fontMultiplier)}px`, fontWeight: 800, color: '#0f172a' }}>
                            pt280
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SIMULATOR QUICK FOOTER BADGE */}
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
              <span>📐 Khổ <strong>{paperSize}</strong></span>
              <span>📏 Viền <strong>{printMargin}</strong></span>
              <span>🔤 Chữ <strong>{Math.round(fontScale * 100)}%</strong></span>
            </div>
          </div>

          {/* COLUMN 2: INTERACTIVE LIVE PAPER SIMULATOR */}
          <div style={{ gridColumn: 2, gridRow: '1 / span 2', position: 'sticky', top: '12px', background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)', padding: '14px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🖼️</span>
                <span>3. MÔ PHỎNG IN TRỰC TIẾP (LIVE)</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#bfdbfe', background: 'rgba(37, 99, 235, 0.30)', border: '1px solid rgba(147, 197, 253, 0.35)', padding: '3px 9px', borderRadius: '999px' }}>
                {paperSize} · {simDim.width}×{simDim.height}mm
              </span>
            </div>

            {/* PAPER PREVIEW STAGE */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '360px', padding: '14px 10px', borderRadius: '8px', background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 8px, rgba(255,255,255,0.07) 8px 16px)' }}>
              <div style={{
                height: '330px',
                maxWidth: '100%',
                aspectRatio: `${simDim.width} / ${simDim.height}`,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                boxSizing: 'border-box',
                padding: `${simPadV}% ${simPadH}%`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontSize: simFont(6.5), color: '#475569', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  NGƯỜI GỬI: {senderName || 'Cửa hàng của bạn'}
                </div>
                <div style={{ fontSize: simFont(6), color: '#64748b', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {senderPhone || '0900 000 000'} — {senderAddress}
                </div>

                <div style={{ fontSize: simFont(8), fontWeight: 800, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  NGUYỄN VĂN A
                </div>
                <div style={{ fontSize: simFont(7), color: '#1f2937', lineHeight: 1.35, overflow: 'hidden' }}>
                  123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh
                </div>

                {/* BARCODE LINES */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: `${(18 * fontScale).toFixed(1)}px`, marginTop: '2px', overflow: 'hidden' }}>
                  {simBarcodeBars.map((b, i) => (
                    <div key={i} style={{ width: `${b}px`, height: '100%', background: i % 2 === 0 ? '#0f172a' : '#ffffff' }} />
                  ))}
                </div>
                <div style={{ fontSize: simFont(6.5), fontWeight: 700, letterSpacing: simFont(1), color: '#0f172a', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  VT998877665VN
                </div>

                <div style={{ marginTop: 'auto', border: `${Math.max(1, Math.round(fontScale))}px solid #0f172a`, borderRadius: '3px', padding: '3px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <span style={{ fontSize: simFont(6), fontWeight: 700, color: '#334155' }}>COD</span>
                  <span style={{ fontSize: simFont(8), fontWeight: 900, color: '#dc2626', whiteSpace: 'nowrap' }}>350.000đ</span>
                </div>
                <div style={{ fontSize: simFont(5.5), color: '#94a3b8', textAlign: 'center' }}>
                  Tem mẫu · Cỡ chữ {Math.round(fontScale * 100)}%
                </div>
              </div>
            </div>

            {/* SIMULATOR READOUT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div style={{ background: 'rgba(148, 163, 184, 0.12)', border: '1px solid #334155', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Căn lề
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc' }}>
                  {marginMode === 'split' ? `${simVmm}mm × ${simHmm}mm` : `${simVmm}mm đều`}
                </div>
              </div>
              <div style={{ background: 'rgba(148, 163, 184, 0.12)', border: '1px solid #334155', borderRadius: '6px', padding: '6px 8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>
                  Cỡ chữ
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc' }}>
                  {Math.round(fontScale * 100)}%
                </div>
              </div>
            </div>

            <div style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: 1.45 }}>
              Thanh lề mô phỏng đúng tỷ lệ khổ {paperSize} ({simDim.width}×{simDim.height}mm) — đổi khổ giấy, cỡ chữ hoặc lề ở cột trái để thấy ngay thay đổi trước khi in.
            </div>
          </div>

        </div>
      </div>

      {/* FILTER CONTROLS BAR (Matches Exact Layout & SubmittedOrders) */}
      <div className="pc-card" style={{ padding: '16px', marginBottom: '16px', width: '100%', boxSizing: 'border-box' }}>
        {/* ROW 1: SEARCH & DATE PRESETS */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: '1 1 300px', position: 'relative', minWidth: '240px' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm theo Tên khách, SĐT (đầy đủ hoặc 4 số cuối), Mã đơn, Vận đơn, Tài khoản bưu điện..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* DATE PRESETS TABS */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '3px', borderRadius: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: '7days', label: '7 ngày qua' },
              { id: 'thisMonth', label: 'Tháng này' },
              { id: 'lastMonth', label: 'Tháng trước' },
              { id: 'custom', label: 'Tùy chỉnh 🗓️' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setDatePreset(tab.id);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: datePreset === tab.id ? 700 : 500,
                  background: datePreset === tab.id ? '#ffffff' : 'transparent',
                  color: datePreset === tab.id ? '#2563eb' : '#64748b',
                  boxShadow: datePreset === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 2: CUSTOM DATE RANGE & SECONDARY FILTERS */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #f1f5f9', width: '100%', boxSizing: 'border-box' }}>
          {datePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Calendar size={15} color="#64748b" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setCurrentPage(1); }}
                style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              />
              <span>đến</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setCurrentPage(1); }}
                style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          )}

          {/* Lọc Hãng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Hãng:</span>
            <select
              value={carrierFilter}
              onChange={(e) => { setCarrierFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#ffffff', color: '#0f172a' }}
            >
              <option value="all">Tất cả hãng</option>
              <option value="vnpost">VNPost (Bưu điện)</option>
              <option value="jt">J&amp;T Express</option>
              <option value="viettelpost">Viettel Post</option>
              <option value="ghtk">GHTK</option>
            </select>
          </div>

          {/* Lọc Cước phí */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Cước phí:</span>
            <select
              value={feeFilter}
              onChange={(e) => { setFeeFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#ffffff', color: '#0f172a' }}
            >
              <option value="all">Tất cả hình thức</option>
              <option value="recipient">Khách (Người nhận) trả</option>
              <option value="sender">Shop (Người gửi) trả</option>
            </select>
          </div>

          {/* Lọc Vận đơn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Vận đơn:</span>
            <select
              value={trackingFilter}
              onChange={(e) => { setTrackingFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#ffffff', color: '#0f172a' }}
            >
              <option value="all">Tất cả</option>
              <option value="has_tracking">Đã có mã vận đơn</option>
              <option value="no_tracking">Chưa có mã vận đơn</option>
            </select>
          </div>

          {/* Lọc Giao hàng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Giao hàng:</span>
            <select
              value={deliveryFilter}
              onChange={(e) => { setDeliveryFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#ffffff', color: '#0f172a' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="submitted">Tạo đơn</option>
              <option value="pending_pickup">Chờ lấy hàng</option>
              <option value="processing">Nhận hàng</option>
              <option value="delivering">Đang vận chuyển</option>
              <option value="out_for_delivery">Đang phát hàng</option>
              <option value="delivered">Phát hàng thành công</option>
              <option value="delivery_failed">Phát không thành công</option>
              <option value="returned">Chuyển hoàn</option>
              <option value="cancelled">Đã hủy</option>
              <option value="reconciled">Đối soát</option>
            </select>
          </div>

          {/* Lọc Trạng thái in */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginLeft: 'auto' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>In ấn:</span>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => { setStatusFilter('UNPRINTED'); setCurrentPage(1); }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: statusFilter === 'UNPRINTED' ? 700 : 500,
                  background: statusFilter === 'UNPRINTED' ? '#ffffff' : 'transparent',
                  color: statusFilter === 'UNPRINTED' ? '#d97706' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                Chưa in ({unprintedCount})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('PRINTED'); setCurrentPage(1); }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: statusFilter === 'PRINTED' ? 700 : 500,
                  background: statusFilter === 'PRINTED' ? '#ffffff' : 'transparent',
                  color: statusFilter === 'PRINTED' ? '#2563eb' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                Đã in ({printedCount})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: statusFilter === 'ALL' ? 700 : 500,
                  background: statusFilter === 'ALL' ? '#ffffff' : 'transparent',
                  color: statusFilter === 'ALL' ? '#0f172a' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                Tất cả ({orders.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ORDERS TABLE CARD */}
      <div className="pc-card" style={{ overflow: 'hidden', marginBottom: '16px', width: '100%', boxSizing: 'border-box' }}>
        {/* QUICK SELECTION & BULK ACTIONS BAR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>
              Đang chọn: <strong style={{ color: selectedIds.length > 0 ? '#2563eb' : '#64748b' }}>{selectedIds.length}</strong> / <strong>{filteredOrders.length}</strong> đơn
            </span>
            {selectedTotalCod > 0 && (
              <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                Tổng COD: {selectedTotalCod.toLocaleString('vi-VN')} đ
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const unprintedOrders = filteredOrders.filter(o => !o.print_count || o.print_count === 0);
                const unprintedIds = unprintedOrders.map(o => o.order_code || o.orderCode || o.id);
                setSelectedIds(unprintedIds);
              }}
              className="pc-btn pc-btn-secondary"
              style={{ padding: '5px 10px', fontSize: '12px' }}
              title="Chọn tất cả các đơn chưa in trong danh sách lọc"
            >
              <CheckSquare size={13} style={{ color: '#d97706' }} />
              <span>Chọn tất cả chưa in ({unprintedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const pageIds = paginatedOrders.map(o => o.order_code || o.orderCode || o.id);
                setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
              }}
              className="pc-btn pc-btn-secondary"
              style={{ padding: '5px 10px', fontSize: '12px' }}
              title="Chọn toàn bộ đơn hiển thị trong trang hiện tại"
            >
              <span>Chọn trang này ({paginatedOrders.length})</span>
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="pc-btn pc-btn-secondary"
                style={{ padding: '5px 10px', fontSize: '12px', color: '#ef4444' }}
                title="Bỏ chọn tất cả các đơn"
              >
                <X size={13} />
                <span>Bỏ chọn ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="pc-table">
            <thead>
              <tr>
                <th style={{ width: '44px', textAlign: 'center' }}>
                  <button
                    onClick={handleSelectAll}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}
                    title={selectedIds.length === filteredOrders.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  >
                    {selectedIds.length === filteredOrders.length && filteredOrders.length > 0 ? (
                      <CheckSquare size={17} style={{ color: '#2563eb' }} />
                    ) : (
                      <Square size={17} />
                    )}
                  </button>
                </th>
                <th style={{ minWidth: '150px' }}>MÃ ĐƠN / VẬN ĐƠN</th>
                <th style={{ minWidth: '130px' }}>HÃNG &amp; CƯỚC</th>
                <th style={{ minWidth: '140px' }}>NGƯỜI NHẬN</th>
                <th style={{ minWidth: '220px' }}>ĐỊA CHỈ GIAO HÀNG</th>
                <th style={{ minWidth: '200px' }}>HÀNG HÓA &amp; TRỌNG LƯỢNG</th>
                <th style={{ minWidth: '110px' }}>TIỀN THU (COD)</th>
                <th style={{ minWidth: '130px' }}>TRẠNG THÁI IN &amp; LỊCH SỬ</th>
                <th style={{ textAlign: 'right', paddingRight: '18px', minWidth: '100px' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#2563eb' }} />
                    Đang nạp danh sách đơn hàng...
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Không tìm thấy đơn hàng nào
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      {searchQuery ? 'Thử thay đổi từ khóa tìm kiếm.' : 'Chưa có đơn hàng nào trong bộ lọc này.'}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map(ord => {
                  const id = ord.order_code || ord.orderCode || ord.id;
                  const isSelected = selectedIds.includes(id);
                  const isPrinted = (ord.print_count && ord.print_count > 0) || Boolean(ord.last_printed_at);
                  const tracking = extractTrackingCode(ord);
                  const orderCode = extractOrderCode(ord);
                  const customerName = ord.customerName || ord.name || ord.recipientName || 'Khách hàng';
                  const phone = ord.phone || ord.customerPhone || ord.recipientPhone || '';
                  const cod = extractCodAmount(ord);
                  const carrier = detectCarrier(ord);
                  const carrierAccount = getCarrierAccount(ord) || defaultCarrierAccount;
                  const isRecipientFee = isRecipientPayingFee(ord);
                  const rawProduct = String(ord.productItem || ord.productNote || ord.product || ord.goodsName || 'Hàng hoá tổng hợp').trim();
                  const weight = ord.weight || ord.actual_weight || 2000;
                  const note = ord.note || ord.orderNote || '';
                  const createdDate = ord.created_at || ord.createdDate || ord.date;

                  return (
                    <tr key={id} className={isSelected ? 'selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleOrder(id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {isSelected ? (
                            <CheckSquare size={17} style={{ color: '#2563eb' }} />
                          ) : (
                            <Square size={17} style={{ color: '#94a3b8' }} />
                          )}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{orderCode}</span>
                          {orderCode && orderCode !== '—' && (
                            <button
                              onClick={() => handleCopy(orderCode)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '1px', color: '#94a3b8' }}
                              title="Sao chép mã đơn"
                            >
                              {copiedCode === orderCode ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                        {tracking ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <span style={{ fontFamily: 'Courier New, monospace', fontSize: '11.5px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 5px', borderRadius: '3px' }}>
                              {tracking}
                            </span>
                            <button
                              onClick={() => handleCopy(tracking)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '1px', color: '#94a3b8' }}
                              title="Sao chép mã vận đơn"
                            >
                              {copiedCode === tracking ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>Chưa có vận đơn</div>
                        )}
                        {createdDate && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            📅 {new Date(createdDate).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: carrier.bg,
                            color: carrier.color,
                            border: `1px solid ${carrier.border}`
                          }}>
                            {carrier.name}
                          </span>
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: '4px',
                            background: isRecipientFee ? '#fef3c7' : '#f1f5f9',
                            color: isRecipientFee ? '#b45309' : '#475569'
                          }}>
                            {isRecipientFee ? 'Khách trả' : 'Shop trả'}
                          </span>
                        </div>
                        {carrierAccount && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                            TK: <strong>{carrierAccount}</strong>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{customerName}</div>
                        {phone && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', fontFamily: 'Courier New, monospace' }}>
                              {phone}
                            </span>
                            <button
                              onClick={() => handleCopy(phone)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '1px', color: '#94a3b8' }}
                              title="Sao chép SĐT"
                            >
                              {copiedCode === phone ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ maxWidth: '300px', lineHeight: 1.4 }}>
                        <div style={{ color: '#334155', wordBreak: 'break-word', fontSize: '12.5px' }}>
                          {ord.address || '—'}
                        </div>
                      </td>
                      <td style={{ maxWidth: '260px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <span style={{ flexShrink: 0 }}>📦</span>
                          <span style={{ wordBreak: 'break-word' }}>{rawProduct}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                          <span>SL: <strong>{ord.quantity || ord.qty || 1}</strong></span>
                          <span>•</span>
                          <span>KL: <strong>{weight}g</strong></span>
                        </div>
                        {note && (
                          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px', wordBreak: 'break-word', fontStyle: 'italic' }}>
                            📝 {note}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                          {Number(cod).toLocaleString('vi-VN')} đ
                        </div>
                      </td>
                      <td>
                        {isPrinted ? (
                          <div>
                            <span className="pc-badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                              <AlertTriangle size={11} />
                              <span>Đã in {ord.print_count || 1} lần</span>
                            </span>
                            {ord.last_printed_at && (
                              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
                                Lần cuối: {new Date(ord.last_printed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="pc-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                            Chưa in
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '14px' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenPreview([ord])}
                            className="pc-btn pc-btn-secondary"
                            style={{ padding: '5px 9px', fontSize: '12px' }}
                            title="Xem trước nhãn đơn này"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleStartPrint([ord])}
                            className="pc-btn pc-btn-primary"
                            style={{ padding: '5px 11px', fontSize: '12px' }}
                            title="In ngay nhãn này"
                          >
                            <Printer size={13} />
                            <span>In</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {filteredOrders.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Hiển thị <strong style={{ color: '#0f172a' }}>{paginatedOrders.length}</strong> / <strong>{filteredOrders.length}</strong> đơn hàng (Đã chọn: <strong style={{ color: '#2563eb' }}>{selectedOrders.length}</strong>)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#64748b' }}>
                <span>Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', padding: '3px 8px', fontSize: '12px' }}
                >
                  <option value={25}>25 đơn/trang</option>
                  <option value={50}>50 đơn/trang</option>
                  <option value={100}>100 đơn/trang</option>
                  <option value={200}>200 đơn/trang</option>
                  <option value="ALL">Tất cả ({filteredOrders.length})</option>
                </select>
              </div>

              {pageSize !== 'ALL' && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="pc-btn pc-btn-secondary"
                    style={{ padding: '4px 8px' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', padding: '0 6px' }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="pc-btn pc-btn-secondary"
                    style={{ padding: '4px 8px' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW MODAL */}
      {previewOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '920px',
            maxWidth: '96vw',
            height: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <Eye size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    Xem trước mẫu nhãn vận đơn ({previewOrders.length} nhãn — Khổ {paperSize})
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Bố cục tem nhiệt chuẩn đa hãng (VNPost, J&amp;T Express, Viettel Post, GHTK): Mã vạch Code128, mã QR, luồng phân hướng BCP, chi tiết thu hộ COD
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => executeBrowserPrint('', previewOrders)}
                  className="pc-btn pc-btn-primary"
                  style={{ padding: '6px 14px' }}
                >
                  <Printer size={14} />
                  <span>In ngay ({previewOrders.length} nhãn)</span>
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="pc-btn pc-btn-secondary"
                  style={{ padding: '6px 12px' }}
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Modal Body iframe */}
            <div style={{ flex: 1, background: '#cbd5e1', padding: '16px', overflow: 'hidden' }}>
              <iframe
                title="VNPost Label Live Preview"
                srcDoc={renderBulkHtmlDocument(
                  previewOrders,
                  { ...templateConfig, paper_size: paperSize, margin: printMargin, font_scale: fontScale },
                  {
                    carrierAccount: senderName,
                    senderName,
                    senderPhone,
                    senderAddress,
                    defaultCarrierAccount: senderName,
                    carrierAccounts,
                    lastVnpostSenderInfo,
                    font_scale: fontScale
                  }
                )}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', background: '#e2e8f0' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE CUSTOMIZER MODAL ("CHO CHỈNH SỬA TRANG IN MẪU") */}
      {templateModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(3px)',
          zIndex: 10002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            width: '1180px',
            maxWidth: '98vw',
            height: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <Palette size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    🎨 Chỉnh sửa trang in mẫu vận đơn (Trực quan &amp; Thời gian thực)
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Tùy biến tiêu đề dịch vụ, chỉ dẫn giao hàng, câu khẩu hiệu và các thành phần tem nhiệt A6/A5. Thay đổi được cập nhật ngay lập tức.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateTemplateConfig({
                      service_title: '',
                      instruction_note: 'Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay',
                      custom_slogan: '',
                      show_barcode: true,
                      show_qr: true,
                      show_signature_box: true,
                      show_slogan: true,
                      show_sender: true,
                      show_order_meta: true
                    });
                  }}
                  className="pc-btn pc-btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  title="Đặt lại các trường và công tắc về mặc định chuẩn"
                >
                  <RotateCw size={13} />
                  <span>Khôi phục mặc định</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="pc-btn pc-btn-primary"
                  style={{ fontSize: '12px', padding: '6px 16px' }}
                >
                  Hoàn tất &amp; Đóng
                </button>
              </div>
            </div>

            {/* Content: 2-column split */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
              {/* Left Column: Form Settings */}
              <div style={{ width: '470px', flexShrink: 0, borderRight: '1px solid #e2e8f0', padding: '18px 20px', overflowY: 'auto', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 0. Cấu hình Khổ giấy & Căn lề trực tiếp trong trang in mẫu */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📐</span>
                      <span>KHỔ GIẤY &amp; CĂNG LỀ IN MẪU</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Cập nhật ngay vào xem trước 👉
                    </span>
                  </div>

                  {/* Paper size in template */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Khổ giấy tem:</span>
                      {paperSize === defaultPaperSize ? (
                        <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 800 }}>⭐ Đang là mặc định ({defaultPaperSize})</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultPaperSize(paperSize)}
                          style={{ fontSize: '10.5px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 6px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          ⭐ Đặt {paperSize} làm mặc định
                        </button>
                      )}
                    </div>
                    <select
                      value={paperSize}
                      onChange={e => {
                        const s = e.target.value;
                        setPaperSize(s);
                        handleUpdateSenderConfig({ paperSize: s });
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: '#0f172a',
                        background: '#ffffff'
                      }}
                    >
                      <option value="A6">A6 (105 x 148 mm - Bưu điện VNPost / J&amp;T)</option>
                      <option value="A5">A5 (148 x 210 mm - Nửa tờ A4)</option>
                      <option value="A4">A4 (210 x 297 mm - Khổ lớn văn phòng)</option>
                      <option value="K100">100 x 150 mm (K100 - Tem nhiệt cuộn TMĐT)</option>
                    </select>
                  </div>

                  {/* Margin in template */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Căn lề trang in ({printMargin}):</span>
                      {printMargin === defaultPrintMargin ? (
                        <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 800 }}>⭐ Đang là mặc định</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultMargin(printMargin)}
                          style={{ fontSize: '10.5px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 6px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          ⭐ Đặt lề này làm mặc định
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {[
                        { label: '2cm Chuẩn', val: '20mm' },
                        { label: '1.5cm', val: '15mm' },
                        { label: '1cm', val: '10mm' },
                        { label: '5mm', val: '5mm' },
                        { label: '0mm Sát mép', val: '0mm' }
                      ].map(p => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => {
                            setPrintMargin(p.val);
                            const parsed = parseMarginToValues(p.val);
                            setMarginMm(parsed.mm);
                            handleUpdateSenderConfig({ printMargin: p.val });
                          }}
                          style={{
                            fontSize: '10.5px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: (printMargin === p.val || (p.val === '20mm' && printMargin === '2cm')) ? '1px solid #2563eb' : '1px solid #cbd5e1',
                            background: (printMargin === p.val || (p.val === '20mm' && printMargin === '2cm')) ? '#eff6ff' : '#ffffff',
                            color: (printMargin === p.val || (p.val === '20mm' && printMargin === '2cm')) ? '#1d4ed8' : '#475569',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="35"
                      step="1"
                      value={marginMm}
                      onChange={e => applyCustomMarginMm(e.target.value)}
                      style={{ width: '100%', cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                  </div>

                  {/* Font scale in template */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Cỡ chữ in:</span>
                      {Math.abs(Number(fontScale) - Number(defaultFontScale)) < 0.05 ? (
                        <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 800 }}>⭐ Đang là mặc định ({Math.round(defaultFontScale * 100)}%)</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultFontScale(fontScale)}
                          style={{ fontSize: '10.5px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 6px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          ⭐ Đặt {Math.round(fontScale * 100)}% làm mặc định
                        </button>
                      )}
                    </div>
                    <select
                      value={fontScale}
                      onChange={e => {
                        const sc = parseFloat(e.target.value) || 2.0;
                        setFontScale(sc);
                        handleUpdateSenderConfig({ fontScale: sc });
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: '#0f172a',
                        background: '#ffffff'
                      }}
                    >
                      <option value="2">Gấp đôi (200% - Rõ to mặc định)</option>
                      <option value="1.5">Lớn (150%)</option>
                      <option value="1">Chuẩn (100%)</option>
                      <option value="2.5">Cực lớn (250%)</option>
                    </select>
                  </div>
                </div>

                {/* 1. Tiêu đề dịch vụ */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🏷️</span>
                    <span>TIÊU ĐỀ DỊCH VỤ VẬN CHUYỂN</span>
                  </div>
                  <input
                    type="text"
                    value={templateConfig.service_title || ''}
                    onChange={e => handleUpdateTemplateConfig({ service_title: e.target.value })}
                    placeholder="Mặc định: Tự động theo hãng (VD: TC TMĐT ĐỒNG GIÁ...)"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#0f172a',
                      fontWeight: 600
                    }}
                  />
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {[
                      { label: 'Tự động hãng', val: '' },
                      { label: 'Đồng giá TMĐT', val: 'TC TMĐT ĐỒNG GIÁ - HÀNG THÔNG THƯỜNG' },
                      { label: 'Chuyển phát tiêu chuẩn', val: 'CHUYỂN PHÁT TIÊU CHUẨN' },
                      { label: 'Chuyển phát nhanh', val: 'CHUYỂN PHÁT NHANH HỎA TỐC' }
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => handleUpdateTemplateConfig({ service_title: btn.val })}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: (templateConfig.service_title || '') === btn.val ? '#eff6ff' : '#f1f5f9',
                          color: (templateConfig.service_title || '') === btn.val ? '#2563eb' : '#475569',
                          border: `1px solid ${(templateConfig.service_title || '') === btn.val ? '#bfdbfe' : '#e2e8f0'}`,
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Chỉ dẫn giao hàng */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📝</span>
                    <span>CHỈ DẪN GIAO HÀNG (MẶC ĐỊNH CHO ĐƠN)</span>
                  </div>
                  <textarea
                    rows={3}
                    value={templateConfig.instruction_note || ''}
                    onChange={e => handleUpdateTemplateConfig({ instruction_note: e.target.value })}
                    placeholder="Nhập chỉ dẫn giao hàng (áp dụng khi đơn hàng không có ghi chú riêng)..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#0f172a',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {[
                      'Cho xem hàng, không cho thử',
                      'Không cho xem hàng',
                      'Cho thử hàng',
                      'Hàng dễ vỡ, xin nhẹ tay'
                    ].map(txt => (
                      <button
                        key={txt}
                        type="button"
                        onClick={() => handleUpdateTemplateConfig({ instruction_note: txt })}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {txt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Khẩu hiệu / Slogan chân trang */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📣</span>
                    <span>KHẨU HIỆU / CÂU CẢM ƠN CHÂN TRANG</span>
                  </div>
                  <input
                    type="text"
                    value={templateConfig.custom_slogan || ''}
                    onChange={e => handleUpdateTemplateConfig({ custom_slogan: e.target.value })}
                    placeholder="Mặc định: Theo hãng (VD: Vietnam Post hotline 1900 545481...)"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#0f172a'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {[
                      { label: 'Theo hãng', val: '' },
                      { label: 'Cảm ơn khách hàng', val: 'VĨNH TÀI BONSAI - CẢM ƠN QUÝ KHÁCH ĐÃ MUA HÀNG VÀ ỦNG HỘ SHOP!' },
                      { label: 'Quay video khi mở', val: 'QUÝ KHÁCH VUI LÒNG QUAY VIDEO CLIP KHI MỞ HÀNG ĐỂ ĐƯỢC HỖ TRỢ ĐỔI TRẢ NHANH CHÓNG' }
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => handleUpdateTemplateConfig({ custom_slogan: btn.val })}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: (templateConfig.custom_slogan || '') === btn.val ? '#eff6ff' : '#f1f5f9',
                          color: (templateConfig.custom_slogan || '') === btn.val ? '#2563eb' : '#475569',
                          border: `1px solid ${(templateConfig.custom_slogan || '') === btn.val ? '#bfdbfe' : '#e2e8f0'}`,
                          borderRadius: '5px',
                          cursor: 'pointer'
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Bật / Tắt các thành phần trên tem */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👁️</span>
                    <span>CÁC THÀNH PHẦN HIỂN THỊ TRÊN TEM</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { key: 'show_barcode', label: 'Mã vạch vận đơn (Code 128)', desc: 'Mã vạch quét nhanh tại bưu điện' },
                      { key: 'show_qr', label: 'Mã QR Code phân hướng (25x25)', desc: 'Mã vuông quét tại trung tâm khai thác' },
                      { key: 'show_signature_box', label: 'Khung chữ ký người nhận', desc: 'Ô ký xác nhận nhận hàng và ghi ngày tháng' },
                      { key: 'show_order_meta', label: 'Cột Số ĐH / Lô / Thứ tự', desc: 'Góc phải trên cùng thể hiện Số đơn và mã TK' },
                      { key: 'show_sender', label: 'Thông tin người gửi (Shop)', desc: 'Tên, SĐT và địa chỉ của shop người gửi' },
                      { key: 'show_slogan', label: 'Khẩu hiệu chân trang', desc: 'Dòng chữ nhỏ dưới đáy trang in' }
                    ].map(item => (
                      <label
                        key={item.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: templateConfig[item.key] !== false ? '#f8fafc' : '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={templateConfig[item.key] !== false}
                          onChange={e => handleUpdateTemplateConfig({ [item.key]: e.target.checked })}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Real-time Live Preview */}
              <div style={{ flex: 1, background: '#cbd5e1', padding: '16px', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', color: '#334155', fontSize: '12px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#2563eb" />
                    <span>Xem trước mẫu in thời gian thực (Cập nhật tức thì)</span>
                  </div>
                  <div>
                    Khổ in: <strong>{paperSize}</strong> • Canh lề: <strong>{printMargin}</strong> • Cỡ chữ: <strong>{Math.round(fontScale * 100)}%</strong>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: '#fff' }}>
                  <iframe
                    title="Live Template Preview"
                    srcDoc={renderBulkHtmlDocument(
                      [
                        (orders.length > 0 ? orders[0] : {
                          order_code: 'DH-VNP-SAMPLE',
                          tracking_code: 'CP889977665VN',
                          carrierAccount: senderName || 'NGUYỄN THANH NHỰT',
                          customerName: 'Nguyễn Văn An',
                          phone: '0912345678',
                          address: '28 Ngõ 65, Phường Phúc Xá, Ba Đình, TP. Hà Nội',
                          productItem: 'Cây Sanh Nam Điền Dáng Trực (Kèm chậu)',
                          weight: 2000,
                          codAmount: 350000,
                          platform: 'vnpost',
                          note: templateConfig.instruction_note || 'Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay'
                        })
                      ],
                      { ...templateConfig, paper_size: paperSize, margin: printMargin, font_scale: fontScale },
                      {
                        carrierAccount: senderName,
                        senderName,
                        senderPhone,
                        senderAddress,
                        defaultCarrierAccount: senderName,
                        carrierAccounts,
                        lastVnpostSenderInfo,
                        font_scale: fontScale
                      }
                    )}
                    style={{ width: '100%', height: '100%', border: 'none', background: '#e2e8f0' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPRINT REASON MODAL */}
      {reprintModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            maxWidth: '460px',
            width: '100%',
            padding: '22px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b45309', marginBottom: '10px' }}>
              <AlertTriangle size={22} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Cảnh báo: Danh sách có đơn đã in nhãn
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Trong danh sách chọn có đơn hàng đã được in nhãn vận đơn trước đó. Để kiểm soát chặt chẽ và chống gian lận/in trùng lặp, vui lòng nhập lý do in lại:
            </p>

            <textarea
              rows={3}
              value={reprintReason}
              onChange={e => setReprintReason(e.target.value)}
              placeholder="Ví dụ: Rách giấy in nhiệt, kẹt máy in, đổi thông tin người nhận..."
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                marginBottom: '10px'
              }}
            />

            {/* Quick Reason Suggestions */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['Rách giấy in', 'Kẹt máy in', 'In mờ/hết mực', 'Sửa thông tin đơn'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setReprintReason(reason)}
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 8px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setReprintModalOpen(false)}
                className="pc-btn pc-btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => executeBrowserPrint(reprintReason)}
                disabled={!reprintReason.trim()}
                className="pc-btn"
                style={{ background: '#d97706', color: '#fff' }}
              >
                Xác nhận in lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION STRATEGY MODAL */}
      {confirmationOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            maxWidth: '520px',
            width: '100%',
            padding: '22px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2563eb', marginBottom: '10px' }}>
              <Printer size={22} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Xác nhận kết quả in từ máy in
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Hộp thoại in vừa được mở. Vui lòng xác nhận những đơn hàng đã được máy in nhãn xuất ra thành công:
            </p>

            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
              {(currentJob?.orders || []).map(ord => {
                const key = ord.order_code || ord.orderCode || ord.id;
                const status = itemStatuses[key] || 'PRINTED';

                return (
                  <div key={key} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>{ord.order_code || ord.orderCode}</strong>
                      <span style={{ color: '#64748b', marginLeft: '6px' }}>({ord.customerName || ord.name || 'Khách'})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setItemStatuses({ ...itemStatuses, [key]: 'PRINTED' })}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: status === 'PRINTED' ? '1px solid #86efac' : '1px solid #cbd5e1',
                          background: status === 'PRINTED' ? '#dcfce7' : '#ffffff',
                          color: status === 'PRINTED' ? '#15803d' : '#64748b'
                        }}
                      >
                        In thành công
                      </button>
                      <button
                        onClick={() => setItemStatuses({ ...itemStatuses, [key]: 'FAILED' })}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: status === 'FAILED' ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                          background: status === 'FAILED' ? '#fee2e2' : '#ffffff',
                          color: status === 'FAILED' ? '#b91c1c' : '#64748b'
                        }}
                      >
                        In lỗi
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setConfirmationOpen(false)}
                className="pc-btn pc-btn-secondary"
              >
                Đóng / Bỏ qua
              </button>
              <button
                onClick={handleConfirmResults}
                className="pc-btn pc-btn-primary"
              >
                Lưu kết quả in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
