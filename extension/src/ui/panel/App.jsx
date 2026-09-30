import React, { useState, useEffect, useRef } from 'react';
import DraggableCard from './components/DraggableCard';
import ParseMode from './components/ParseMode';
import ConfidenceReview from './components/ConfidenceReview';
import SkeletonReview from './components/SkeletonReview';
import LoginForm from './components/LoginForm';
import ParseReview from './components/ParseReview';
import { ERROR_CODES, toUserSafeError } from '../../application/error-codes.js';
import { processImageToOrder } from '../../application/ai/vision-pipeline.js';
import { createAsyncResultGate } from './async-result-gate.js';

let _aiFeatureFlagsCache = { shopId: null, data: null, expiresAt: 0 };

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [state, setState] = useState('IDLE'); // IDLE, LOADING, REVIEW, SUCCESS, ERROR, UPGRADE_REQUIRED
  const [parsedData, setParsedData] = useState(null);
  const [localData, setLocalData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [currentImage, setCurrentImage] = useState(null);
  const [progressStatus, setProgressStatus] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const [session, setSession] = useState(null);
  const [carrierAccount, setCarrierAccount] = useState('');
  const [updateStatus, setUpdateStatus] = useState(null);
  const [draftOrders, setDraftOrders] = useState([]);
  const [draftQueueOpen, setDraftQueueOpen] = useState(true);
  const asyncResultGate = useRef(createAsyncResultGate());

  const triggerToast = (msg, type = 'info') => {
    if (typeof globalThis.showVnpostToast === 'function') {
      globalThis.showVnpostToast(msg, type);
    } else {
      console.log(`[Toast] [${type.toUpperCase()}] ${msg}`);
    }
  };

  useEffect(() => {
    let timerId = null;
    let pollCount = 0;
    const scanCarrierAccount = () => {
      let acc = '';
      if (typeof globalThis.detectCarrierAccount === 'function') {
        acc = globalThis.detectCarrierAccount();
      } else if (typeof window !== 'undefined' && window.location.href.includes('vnpost.vn') && globalThis.VNPOST_SELECTORS?.getAccountName) {
        acc = globalThis.VNPOST_SELECTORS.getAccountName();
      } else if (typeof window !== 'undefined' && window.location.href.includes('jtexpress.vn') && globalThis.JT_SELECTORS?.getAccountName) {
        acc = globalThis.JT_SELECTORS.getAccountName();
      }
      if (acc) {
        setCarrierAccount(acc);
      }
      // Adaptive backoff: fast initial check, relax to 30s once detected or after 10 attempts
      pollCount++;
      const nextDelay = acc ? 30000 : (pollCount > 10 ? 10000 : 2000);
      timerId = setTimeout(scanCarrierAccount, nextDelay);
    };
    scanCarrierAccount();
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      try {
        if (window.AuthSession && typeof window.AuthSession.getSession === 'function') {
          window.AuthSession.getSession().then(sess => {
            setSession(sess);
            setIsAuth(!!sess);
          }).catch(() => {
            setSession(null);
            setIsAuth(false);
          });
        } else if (window.AuthService && typeof window.AuthService.isAuthenticated === 'function') {
          window.AuthService.isAuthenticated().then(auth => {
            setIsAuth(auth);
            if (!auth) setSession(null);
          }).catch(() => {
            setSession(null);
            setIsAuth(false);
          });
        }
      } catch (e) {
        console.warn("Auth check error:", e);
      }
    };
    
    checkAuth();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['app_update_status'], res => {
        if (res?.app_update_status) setUpdateStatus(res.app_update_status);
      });
    }

    const loadDrafts = async () => {
      try {
        if (typeof window !== 'undefined' && window.OrderStorage && typeof window.OrderStorage.getOrders === 'function') {
          const all = await window.OrderStorage.getOrders().catch(() => []);
          const drafts = (all || []).filter(o => o && !o.submittedAt && !o.trackingCode && !o.tracking_code);
          setDraftOrders(drafts);
        } else if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(['savedOrders'], (res) => {
            const all = res?.savedOrders || [];
            const drafts = (all || []).filter(o => o && !o.submittedAt && !o.trackingCode && !o.tracking_code);
            setDraftOrders(drafts);
          });
        }
      } catch (_) {}
    };

    loadDrafts();

    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'local' && changes['vnpost_session']) {
        const newSession = changes['vnpost_session'].newValue;
        setSession(newSession || null);
        setIsAuth(!!newSession);
        
        if (!newSession) {
          setState('IDLE');
          setParsedData(null);
          setRawText('');
        }
      }
      if (namespace === 'local' && changes['app_update_status']) {
        setUpdateStatus(changes['app_update_status'].newValue);
      }
      if (namespace === 'local' && (changes['savedOrders'] || changes['draft_queue_updated_at'])) {
        loadDrafts();
      }
    };

    const handleAuthEvent = (data) => {
      const auth = !!data?.isAuthenticated;
      setIsAuth(auth);
      setSession(data?.session || null);
      if (!auth) {
        setState('IDLE');
        setParsedData(null);
        setRawText('');
      }
    };

    const handleRuntimeMessage = (msg) => {
      if (msg && (msg.action === 'LOGOUT_BROADCAST' || msg.action === 'PERFORM_LOGOUT')) {
        setIsAuth(false);
        setSession(null);
        setState('IDLE');
        setParsedData(null);
        setRawText('');
      }
      if (msg && msg.type === 'app_update_changed' && msg.status) {
        setUpdateStatus(msg.status);
      }
      if (msg && (msg.action === 'draftOrdersUpdated' || msg.action === 'ordersUpdated' || msg.action === 'refreshDraftQueue')) {
        loadDrafts();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }
    if (typeof globalThis.AuthEvents !== 'undefined' && typeof globalThis.AuthEvents.on === 'function') {
      globalThis.AuthEvents.on('AUTH_STATE_CHANGED', handleAuthEvent);
    }

    const handleClearOrderEvent = () => {
      asyncResultGate.current.invalidate();
      setState('IDLE');
      setParsedData(null);
      setLocalData(null);
      setRawText('');
      setCurrentImage(null);
      setProgressStatus(null);
      if (typeof globalThis !== 'undefined') {
        globalThis.parsedDataStore = null;
        globalThis.__AF_INITIAL_PARSED_DATA__ = null;
      }
    };

    const handleOrderSaved = () => {
      handleClearOrderEvent();
      loadDrafts();
      triggerToast('💾 Đã lưu đơn hàng & làm mới panel!', 'success');
    };

    window.addEventListener('order-saved-db', handleOrderSaved);
    window.addEventListener('autofill:clear-order', handleClearOrderEvent);
    window.addEventListener('draft-queue-updated', loadDrafts);
    window.addEventListener('orders-updated', loadDrafts);
    return () => {
      window.removeEventListener('order-saved-db', handleOrderSaved);
      window.removeEventListener('autofill:clear-order', handleClearOrderEvent);
      window.removeEventListener('draft-queue-updated', loadDrafts);
      window.removeEventListener('orders-updated', loadDrafts);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
      if (typeof globalThis.AuthEvents !== 'undefined' && typeof globalThis.AuthEvents.off === 'function') {
        globalThis.AuthEvents.off('AUTH_STATE_CHANGED', handleAuthEvent);
      }
    };
  }, []);

  const handleParse = (text) => {
    if (!isAuth) {
      triggerToast('⚠️ Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập để tiếp tục!', 'error');
      setState('IDLE');
      return;
    }

    asyncResultGate.current.invalidate();
    setRawText(text);
    let localParsed = null;
    try {
      const parser = window.OrderProcessor || globalThis.OrderProcessor;
      if (parser && typeof parser.parse === 'function') {
        localParsed = parser.parse(text);
      }
    } catch (e) {
      console.warn("Local parse error:", e);
    }

    if (!localParsed) {
      localParsed = { name: "", phone: "", address: "không tìm thấy", orderCode: "", productItem: "", codAmount: 0, collectFee: false, extraPhones: [], extraNote: "" };
    }

    setCurrentImage(null);
    setLocalData(localParsed);
    setParsedData(localParsed);
    setState('PARSE_REVIEW');
  };

  const handleParseImage = async (imageBase64) => {
    if (!isAuth) {
      triggerToast('⚠️ Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập để tiếp tục!', 'error');
      setState('IDLE');
      return;
    }

    const requestToken = asyncResultGate.current.begin();
    setCurrentImage(imageBase64);
    setState('LOADING');
    setProgressStatus({ step: 'OCR_SCANNING', message: '🔍 Đang quét nhận diện chữ bằng Google Vision OCR...' });

    let threshold = 0.80;
    try {
      const stored = await new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['ocr_confidence_threshold'], resolve);
        } else {
          resolve({});
        }
      });
      if (stored && stored.ocr_confidence_threshold !== undefined) {
        threshold = Number(stored.ocr_confidence_threshold) / 100;
      }
    } catch (_) {}

    try {
      const result = await processImageToOrder(imageBase64, {
        session,
        threshold,
        onProgress: (status) => {
          if (asyncResultGate.current.isCurrent(requestToken)) setProgressStatus(status);
        }
      });

      if (!asyncResultGate.current.isCurrent(requestToken)) return;

      if (!result || !result.success) {
        throw new Error(result?.error || 'Không thể trích xuất đơn hàng từ ảnh');
      }

      setRawText(result.rawText || '');
      setLocalData(result.orderData);
      setParsedData({
        ...result.orderData,
        imageThumbnail: imageBase64,
        ocrConfidence: result.confidence,
        visionBranch: result.branch
      });

      if (result.warning) {
        triggerToast(`⚠️ ${result.warning}`, 'warning');
      } else {
        const branchNotice = result.branch === 'GOOD'
          ? `Google Vision OCR nét (${result.confidence}%)`
          : `Gemini Vision Multimodal (${result.confidence}%)`;
        triggerToast(`📸 ${branchNotice}`, 'success');
      }

      setState('PARSE_REVIEW');
    } catch (err) {
      if (!asyncResultGate.current.isCurrent(requestToken)) return;
      console.error('[React Panel] Lỗi bóc tách ảnh:', err);
      const safeErr = toUserSafeError(err);
      triggerToast(safeErr.message || 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.', 'warning');
      setState('IDLE');
    } finally {
      if (asyncResultGate.current.isCurrent(requestToken)) setProgressStatus(null);
    }
  };

  const isOrderLocallyComplete = (data) => {
    if (!data) return false;
    const name = (data.name || '').trim();
    const phone = (data.phone || '').replace(/[\s.-]/g, '');
    const addr = (data.address || '').trim();
    const hasValidName = name.length >= 2 && !/^(anh|chị|em|bạn|khách|cô|chú)$/i.test(name);
    const hasValidPhone = /^(0|\+84)\d{9,10}$/.test(phone);
    const hasValidAddress = addr.length >= 10 && addr !== 'không tìm thấy';
    const hasCod = data.codAmount !== undefined && data.codAmount !== null && !isNaN(Number(data.codAmount));
    return hasValidName && hasValidPhone && hasValidAddress && hasCod;
  };

  const handleConfirmParseReview = async (editedData) => {
    if (!isAuth || (!session?.access_token && !session?.shop_access_key)) {
      triggerToast('⚠️ Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại!', 'error');
      setIsAuth(false);
      setState('IDLE');
      return;
    }

    const requestToken = asyncResultGate.current.begin();
    setParsedData(editedData);

    // LOCAL-FIRST AI-LAST: Nếu đơn hàng đã đầy đủ và rõ ràng, thử chuẩn hoá địa chỉ cục bộ
    if (isOrderLocallyComplete(editedData) && window.AddressEngine && typeof window.AddressEngine.process === 'function') {
      try {
        const engResult = await window.AddressEngine.process(editedData.address, editedData.phone || '');
        if (!asyncResultGate.current.isCurrent(requestToken)) return;
        if (engResult && engResult.province && (engResult.ward || engResult.district) && (engResult.confidence || 0) >= 80) {
          const finalAddress = engResult.fullAddress || editedData.address;
          setParsedData({
            ...editedData,
            address: finalAddress,
            warning: engResult.warning || '',
            confidence: engResult.confidence || 95,
            confidenceThreshold: 90,
            rawAddress: editedData.address || '',
            normalizedAddress: finalAddress,
            province: engResult.province || '',
            ward: engResult.ward || '',
            addressSource: engResult.source || 'local_fastpath'
          });
          triggerToast('⚡ Chuẩn hoá tức thì bằng Engine cục bộ (tiết kiệm quota AI)', 'success');
          setState('REVIEW');
          return;
        }
      } catch (e) {
        console.warn('[React Panel] Local-first check fallback to AI:', e);
      }
    }

    setState('LOADING');
    chrome.runtime.sendMessage({ 
          action: 'runGroq', 
          text: rawText, 
          token: session?.access_token || session?.shop_access_key,
          shopKey: session?.shop_access_key,
          shopId: session?.active_shop_id,
          deviceId: session?.device_id,
          staffName: session?.staff_name || session?.user?.full_name || 'Nhân viên kho'
        }, async (response) => {
          if (!asyncResultGate.current.isCurrent(requestToken)) return;
          if (chrome.runtime.lastError || !response || !response.ok) {
            const errMsg = chrome.runtime.lastError?.message || response?.error || '';
            const safeError = toUserSafeError(response || errMsg);
            console.error("AI Error:", errMsg);
            
            if (errMsg.includes('context invalidated')) {
              triggerToast('⚠️ Extension đã được cập nhật. Vui lòng nhấn F5 để tải lại trang web.', 'error');
              setState('IDLE');
              return;
            }

            if (safeError.code === ERROR_CODES.AI_QUOTA_EXCEEDED || errMsg === 'QUOTA_EXCEEDED' || errMsg.includes('hết hạn mức AI') || errMsg.includes('QUOTA')) {
              triggerToast(safeError.message, 'error');
              setState('IDLE');
              return;
            }

            if (safeError.code === ERROR_CODES.AI_AUTH_REQUIRED || errMsg.includes('Phiên đăng nhập') || errMsg.includes('session')) {
              triggerToast(safeError.message, 'error');
              setIsAuth(false);
              setState('IDLE');
              return;
            }

            // Fallback to local reviewed data if AI fails
            triggerToast(safeError.message, 'warning');
            
            let finalAddress = editedData.address;
            let warning = '';
            let confidence = 95;
            let confidenceThreshold = 90;
            let autoCorrect = true;
            let addressMetadata = {
              rawAddress: editedData.address || '',
              normalizedAddress: editedData.address || '',
              province: '',
              ward: '',
              addressSource: 'local_parser'
            };
            
            try {
              const settings = await new Promise(resolve => {
                chrome.storage.local.get(['ai_confidence_threshold', 'ai_auto_correct'], r => {
                  resolve({
                    confidenceThreshold: r.ai_confidence_threshold !== undefined ? Number(r.ai_confidence_threshold) : 90,
                    autoCorrect: r.ai_auto_correct !== undefined ? r.ai_auto_correct : true
                  });
                });
              });
              confidenceThreshold = settings.confidenceThreshold;
              autoCorrect = settings.autoCorrect;
            } catch(e){}

            if (autoCorrect && window.AddressEngine && typeof window.AddressEngine.process === 'function' && finalAddress && finalAddress !== 'không tìm thấy') {
              try {
                const engResult = await window.AddressEngine.process(finalAddress, editedData.phone || '');
                if (engResult) {
                  finalAddress = engResult.fullAddress || finalAddress;
                  warning = engResult.warning || '';
                  confidence = engResult.confidence || 95;
                  addressMetadata = {
                    rawAddress: editedData.address || '',
                    normalizedAddress: finalAddress,
                    province: engResult.province || '',
                    ward: engResult.ward || '',
                    addressSource: engResult.source || 'local_pipeline'
                  };
                }
              } catch (e) {
                console.warn('[React Panel] Lỗi chạy AddressEngine:', e);
                warning = toUserSafeError({ code: ERROR_CODES.ADDRESS_ENGINE_FAILED }).message;
              }
            }

            if (!asyncResultGate.current.isCurrent(requestToken)) return;

            setParsedData({
              ...editedData,
              address: finalAddress,
              warning,
              confidence,
              confidenceThreshold,
              ...addressMetadata
            });
            setState('REVIEW');
            return;
          }
          
          const data = response.result || {};
          const rawAddress = data.correctAddress || data.address || response.correctAddress || '';
          
          let finalAddress = rawAddress;
          let warning = '';
          let confidence = 95;
          let addressMetadata = {
            rawAddress: rawAddress || editedData.address || '',
            normalizedAddress: rawAddress || editedData.address || '',
            province: '',
            ward: '',
            addressSource: rawAddress ? 'ai' : 'local_parser'
          };

          // Đọc cấu hình AI thực tế: ưu tiên Cloud (shop_feature_flags có cache 5m), fallback Chrome Storage
          let confidenceThreshold = 90;
          let autoCorrect = true;
          try {
            if (window.AuthService && window.AuthService.fetchShopFeatureFlags && typeof SupabaseCloud !== 'undefined') {
              const sess = await window.AuthSession.getSession();
              if (sess && sess.active_shop_id && sess.access_token && !sess.access_token.startsWith('local_dev_token_')) {
                const now = Date.now();
                if (_aiFeatureFlagsCache.shopId === sess.active_shop_id && _aiFeatureFlagsCache.expiresAt > now && _aiFeatureFlagsCache.data) {
                  confidenceThreshold = _aiFeatureFlagsCache.data.confidenceThreshold;
                  autoCorrect = _aiFeatureFlagsCache.data.autoCorrect;
                } else {
                  const cloud = await SupabaseCloud.loadConfig();
                  const res = await fetch(`${cloud.url}/rest/v1/shop_feature_flags?shop_id=eq.${sess.active_shop_id}&select=ai_confidence_threshold,ai_auto_correct`, {
                    headers: {
                      'apikey': cloud.anonKey,
                      'Authorization': `Bearer ${sess.access_token}`
                    }
                  });
                  if (res.ok) {
                    const flags = await res.json();
                    if (flags && flags.length > 0) {
                      if (flags[0].ai_confidence_threshold !== null && flags[0].ai_confidence_threshold !== undefined) confidenceThreshold = Number(flags[0].ai_confidence_threshold);
                      if (flags[0].ai_auto_correct !== null && flags[0].ai_auto_correct !== undefined) autoCorrect = !!flags[0].ai_auto_correct;
                      _aiFeatureFlagsCache = {
                        shopId: sess.active_shop_id,
                        data: { confidenceThreshold, autoCorrect },
                        expiresAt: now + 5 * 60 * 1000
                      };
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[React Panel] Không đọc được AI config từ Cloud:', e);
          }
          const settings = await new Promise(resolve => {
            chrome.storage.local.get(['ai_confidence_threshold', 'ai_auto_correct'], r => {
              resolve({
                confidenceThreshold: confidenceThreshold !== 90 ? confidenceThreshold
                  : (r.ai_confidence_threshold !== undefined ? Number(r.ai_confidence_threshold) : 90),
                autoCorrect: autoCorrect !== true ? autoCorrect
                  : (r.ai_auto_correct !== undefined ? r.ai_auto_correct : true)
              });
            });
          });
          if (!asyncResultGate.current.isCurrent(requestToken)) return;

          // MERGE STRATEGY: Preserve user corrections
          const mergedData = { ...editedData };

          if (editedData.name === localData.name) {
            mergedData.name = data.name || editedData.name;
          }
          if (editedData.phone === localData.phone) {
            mergedData.phone = data.phone || editedData.phone;
          }
          if (editedData.orderCode === localData.orderCode) {
            mergedData.orderCode = data.orderCode || editedData.orderCode;
          }
          if (editedData.extraNote === localData.extraNote) {
            mergedData.extraNote = data.extraNote || editedData.extraNote;
          }
          if (Number(editedData.codAmount) === Number(localData.codAmount)) {
            mergedData.codAmount = data.codAmount !== undefined ? data.codAmount : editedData.codAmount;
          }
          if (editedData.collectFee === localData.collectFee) {
            mergedData.collectFee = data.collectFee !== undefined ? !!data.collectFee : editedData.collectFee;
          }
          if (editedData.productItem === localData.productItem) {
            mergedData.productItem = data.productItem || editedData.productItem;
          }

          let addressToProcess = rawAddress;
          if (editedData.address !== localData.address) {
            addressToProcess = editedData.address;
          } else {
            addressToProcess = rawAddress || editedData.address;
          }

          if (settings.autoCorrect && window.AddressEngine && typeof window.AddressEngine.process === 'function') {
            try {
              const engResult = await window.AddressEngine.process(addressToProcess, mergedData.phone || '');
              if (engResult) {
                finalAddress = engResult.fullAddress || addressToProcess;
                warning = engResult.warning || '';
                confidence = engResult.confidence || 95;
                addressMetadata = {
                  rawAddress: addressToProcess || '',
                  normalizedAddress: finalAddress,
                  province: engResult.province || '',
                  ward: engResult.ward || '',
                  addressSource: engResult.source || 'local_pipeline'
                };
              }
            } catch (e) {
              console.warn('[React Panel] Lỗi chạy AddressEngine:', e);
            }
          } else {
            finalAddress = addressToProcess;
          }

          if (!asyncResultGate.current.isCurrent(requestToken)) return;

          setParsedData({
            ...mergedData,
            address: finalAddress,
            warning: warning,
            confidence: confidence,
            confidenceThreshold: settings.confidenceThreshold,
            ...addressMetadata
          });
          setState('REVIEW');
        });
      } else {
        if (!asyncResultGate.current.isCurrent(requestToken)) return;
        // AI unavailable: degrade gracefully using local parsed data with explicit source attribution.
        triggerToast(toUserSafeError({ code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE }).message, 'warning');
        setParsedData({
          ...editedData,
          confidence: 50,
          confidenceThreshold: 90,
          rawAddress: editedData.address || '',
          normalizedAddress: editedData.address || '',
          province: '',
          ward: '',
          addressSource: 'local_parser'
        });
        setState('REVIEW');
      }
    } catch (err) {
      if (!asyncResultGate.current.isCurrent(requestToken)) return;
      triggerToast('⚠️ Lỗi: Extension đã được cập nhật. Vui lòng nhấn F5 để tải lại trang web.', 'error');
      setState('IDLE');
    }
  };

  const handleConfirm = async (editedData) => {
    asyncResultGate.current.invalidate();
    const finalData = editedData || parsedData;
    if (editedData) setParsedData(finalData);

    // Đọc các thiết lập mặc định (sản phẩm mặc định, trọng lượng) từ Chrome storage / LocalStorage
    const defaults = await new Promise(resolve => {
      chrome.storage.local.get([
        'order_default_settings',
        'default_goods_name',
        'default_weight_vnpost',
        'default_weight_jt',
        'default_package_weight',
        'activeShop'
      ], async r => {
        const ord = r?.order_default_settings || {};
        let defaultGoodsName = ord.defaultItemName || r?.default_goods_name;
        if (!defaultGoodsName) {
          try {
            defaultGoodsName = localStorage.getItem('default_goods_name') || JSON.parse(localStorage.getItem('order_default_settings') || '{}')?.defaultItemName;
          } catch (_) {}
        }
        let defaultWeightVnpost = ord.defaultWeight !== undefined ? Number(ord.defaultWeight) : (r?.default_weight_vnpost !== undefined ? Number(r.default_weight_vnpost) : undefined);
        if (defaultWeightVnpost === undefined) {
          try {
            defaultWeightVnpost = Number(localStorage.getItem('default_weight_vnpost')) || JSON.parse(localStorage.getItem('order_default_settings') || '{}')?.defaultWeight;
          } catch (_) {}
        }
        let defaultWeightJt = ord.defaultWeightKg !== undefined ? Number(ord.defaultWeightKg) : (r?.default_weight_jt !== undefined ? Number(r.default_weight_jt) : undefined);
        if (defaultWeightJt === undefined) {
          try {
            defaultWeightJt = Number(localStorage.getItem('default_weight_jt')) || JSON.parse(localStorage.getItem('order_default_settings') || '{}')?.defaultWeightKg;
          } catch (_) {}
        }

        // Ưu tiên khối lượng từ Cài đặt Cửa hàng (Shop Profile - default_package_weight)
        let defPkgWeight = r?.default_package_weight || (typeof r?.activeShop === 'object' ? r.activeShop?.default_package_weight : null);
        if (!defPkgWeight) {
          try {
            defPkgWeight = localStorage.getItem('default_package_weight');
          } catch (_) {}
        }
        if (!defPkgWeight && typeof OrderStorage !== 'undefined' && typeof OrderStorage.getActiveShop === 'function') {
          try {
            const shop = await OrderStorage.getActiveShop().catch(() => null);
            if (shop?.default_package_weight) defPkgWeight = shop.default_package_weight;
          } catch (_) {}
        }

        if ((!defaultWeightVnpost || Number(defaultWeightVnpost) <= 0) && defPkgWeight && Number(defPkgWeight) > 0) {
          const numPkg = Number(defPkgWeight);
          defaultWeightVnpost = numPkg >= 10 ? numPkg : numPkg * 1000;
        }
        if ((!defaultWeightJt || Number(defaultWeightJt) <= 0) && defPkgWeight && Number(defPkgWeight) > 0) {
          const numPkg = Number(defPkgWeight);
          defaultWeightJt = numPkg >= 10 ? (numPkg / 1000) : numPkg;
        }

        resolve({
          defaultGoodsName: defaultGoodsName || 'Hàng hóa',
          defaultWeightVnpost: Number.isFinite(defaultWeightVnpost) && defaultWeightVnpost > 0 ? defaultWeightVnpost : 200,
          defaultWeightJt: Number.isFinite(defaultWeightJt) && defaultWeightJt > 0 ? defaultWeightJt : 0.2
        });
      });
    });

    const isJtPlatform = typeof window !== 'undefined' && window.location.href.includes('jtexpress.vn');
    const currentWeight = isJtPlatform ? defaults.defaultWeightJt : defaults.defaultWeightVnpost;
    const currentWeightGrams = isJtPlatform ? Math.round(defaults.defaultWeightJt * 1000) : defaults.defaultWeightVnpost;

    // Gán dữ liệu vào global store để các adapter carrier đọc
    globalThis.parsedDataStore = {
      name: finalData.name || '',
      phone: finalData.phone || '',
      address: finalData.address || '',
      orderCode: finalData.orderCode || '',
      productItem: finalData.productItem || '',
      codAmount: finalData.codAmount || 0,
      extraNote: finalData.extraNote || '',
      carrierAccount: carrierAccount || finalData.carrierAccount || '',
      defaultGoodsName: defaults.defaultGoodsName,
      defaultWeightVnpost: defaults.defaultWeightVnpost,
      defaultWeightJt: defaults.defaultWeightJt,
      weight: currentWeight,
      weightGrams: currentWeightGrams,
      id: finalData.id
    };

    if (typeof globalThis.afTriggerFillForm === 'function') {
      const platform = typeof window !== 'undefined' && window.location.href.includes('vnpost') ? 'vnpost' : 'jt';
      globalThis.afTriggerFillForm(platform);
    } else {
      if (window.VNPostAdapter && typeof window.VNPostAdapter.fill === 'function') {
        window.VNPostAdapter.fill(finalData.name, finalData.phone, finalData.address, finalData.orderCode || '', finalData.codAmount || 0, false);
      } else if (window.JtAdapter && typeof window.JtAdapter.fill === 'function') {
        window.JtAdapter.fill(finalData.name, finalData.phone, finalData.address, finalData.orderCode || '', finalData.codAmount || 0, false);
      } else if (window.VNPostAutoFill && typeof window.VNPostAutoFill.fillForm === 'function') {
        window.VNPostAutoFill.fillForm(finalData);
      }
      if (typeof globalThis.showVnpostToast === 'function') {
        globalThis.showVnpostToast('✅ Đã điền thông tin đơn hàng vào biểu mẫu thành công!', 'success');
      }
    }
  };

  if (!isOpen) {
    return (
      <button className="af-panel-toggle" onClick={() => setIsOpen(true)}>
        ⚡ AF
      </button>
    );
  }

  return (
    <DraggableCard 
      title="Auto Fill Order" 
      onClose={() => setIsOpen(false)} 
      isAuth={isAuth} 
      session={session}
      carrierAccount={carrierAccount}
      draftCount={draftOrders.length}
      onToggleDraftQueue={() => setDraftQueueOpen(prev => !prev)}
    >
      {updateStatus?.hasUpdate && (
        <div style={{
          background: updateStatus.isBlocked ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${updateStatus.isBlocked ? '#f87171' : '#bfdbfe'}`,
          borderRadius: 8,
          padding: '8px 12px',
          margin: '4px 12px 8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8
        }}>
          <div style={{ color: updateStatus.isBlocked ? '#991b1b' : '#1e40af', fontWeight: 700, fontSize: 11.5 }}>
            {updateStatus.isBlocked ? `⚠️ Bắt buộc nâng cấp v${updateStatus.latestVersion}` : `🎉 Đã có bản mới v${updateStatus.latestVersion}`}
          </div>
          {updateStatus.downloadUrl && (
            <a
              href={updateStatus.downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                background: updateStatus.isBlocked ? '#dc2626' : '#2563eb',
                color: '#ffffff',
                padding: '3px 9px',
                borderRadius: 5,
                fontWeight: 700,
                fontSize: 11,
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              Tải về
            </a>
          )}
        </div>
      )}

      {isAuth && state === 'IDLE' && draftOrders.length > 0 && draftQueueOpen && (
        <div style={{
          margin: '4px 12px 10px 12px',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#1e40af'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ fontSize: '14px' }}>📥</span>
            <span>Hàng đợi: <strong>{draftOrders.length}</strong> đơn nháp sẵn sàng</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const d = draftOrders[0];
              if (d) {
                const text = d.rawText || [d.name, d.phone, d.address, d.orderCode, d.codAmount ? `Cod ${d.codAmount}đ` : ''].filter(Boolean).join('\n');
                handleParse(text);
              }
            }}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            ⚡ Nạp Đơn 1
          </button>
        </div>
      )}

      {isAuth && state === 'IDLE' && (
        <ParseMode 
          onParse={handleParse} 
          onParseImage={handleParseImage}
          isLoading={false}
          progressStatus={null}
        />
      )}

      {state === 'PARSE_REVIEW' && (
        <ParseReview
          data={parsedData}
          rawText={rawText}
          imageThumbnail={currentImage || parsedData?.imageThumbnail}
          onConfirm={handleConfirmParseReview}
          onCancel={() => setState('IDLE')}
        />
      )}

      {state === 'LOADING' && (
        <SkeletonReview rawText={rawText} />
      )}

      {state === 'REVIEW' && (
        <ConfidenceReview 
          data={parsedData} 
          rawText={rawText}
          imageThumbnail={currentImage || parsedData?.imageThumbnail}
          onParse={handleParse}
          onConfirm={handleConfirm} 
          onCancel={() => setState('IDLE')} 
          onSave={() => {
            asyncResultGate.current.invalidate();
            if (parsedData) {
              globalThis.parsedDataStore = { ...globalThis.parsedDataStore, ...parsedData };
            }
            if (typeof globalThis.afHandleSaveOrder === 'function') {
              globalThis.afHandleSaveOrder();
            }
          }}
        />
      )}

      {state === 'SUCCESS' && (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: '#16a34a', fontWeight: 600, background: '#f0fdf4', borderRadius: '6px' }}>
          ✅ Đã điền đơn thành công vào form!
        </div>
      )}

      {state === 'ERROR' && (
        <div style={{ textAlign: 'center', padding: '14px', color: '#be123c', background: '#fff1f2', borderRadius: '6px', fontSize: '12px' }}>
          ⚠️ Lỗi: {parsedData?.errorMsg}
          <div style={{ marginTop: '10px' }}>
            {parsedData?.errorMsg?.includes('Phiên đăng nhập') ? (
              <button className="af-btn-primary" style={{ background: '#be123c', fontSize: '12px', padding: '6px 12px' }} onClick={() => {
                if (window.AuthService && typeof window.AuthService.logout === 'function') {
                  window.AuthService.logout().then(() => setIsAuth(false));
                }
                setState('IDLE');
              }}>
                Đăng nhập lại
              </button>
            ) : (
              <button className="af-btn-primary" style={{ background: '#be123c', fontSize: '12px', padding: '6px 12px' }} onClick={() => setState('IDLE')}>
                Thử lại
              </button>
            )}
          </div>
        </div>
      )}

      {state === 'UPGRADE_REQUIRED' && (
        <div style={{ textAlign: 'center', padding: '14px', color: '#b45309', background: '#fffbeb', borderRadius: '6px', fontSize: '12px' }}>
          💎 Đã hết hạn mức AI tháng này. Vui lòng nâng cấp gói cước trong trang Options.
          <div style={{ marginTop: '10px' }}>
            <button className="af-btn-primary" style={{ background: '#f59e0b', fontSize: '12px', padding: '6px 12px' }} onClick={() => setState('IDLE')}>
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {!isAuth && state === 'IDLE' && (
        <LoginForm 
          onLoginSuccess={() => {
            setIsAuth(true);
            setState('IDLE');
          }} 
        />
      )}
    </DraggableCard>
  );
}
