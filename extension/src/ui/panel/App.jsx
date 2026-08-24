import React, { useState, useEffect } from 'react';
import DraggableCard from './components/DraggableCard';
import ParseMode from './components/ParseMode';
import ConfidenceReview from './components/ConfidenceReview';
import SkeletonReview from './components/SkeletonReview';
import LoginForm from './components/LoginForm';
import ParseReview from './components/ParseReview';
import { ERROR_CODES, toUserSafeError } from '../../application/error-codes.js';

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [state, setState] = useState('IDLE'); // IDLE, LOADING, REVIEW, SUCCESS, ERROR, UPGRADE_REQUIRED
  const [parsedData, setParsedData] = useState(null);
  const [localData, setLocalData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [session, setSession] = useState(null);
  const [carrierAccount, setCarrierAccount] = useState('');

  const triggerToast = (msg, type = 'info') => {
    if (typeof globalThis.showVnpostToast === 'function') {
      globalThis.showVnpostToast(msg, type);
    } else {
      console.log(`[Toast] [${type.toUpperCase()}] ${msg}`);
    }
  };

  useEffect(() => {
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
    };
    scanCarrierAccount();
    const interval = setInterval(scanCarrierAccount, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      try {
        if (window.AuthSession && typeof window.AuthSession.getSession === 'function') {
          window.AuthSession.getSession().then(sess => {
            setSession(sess);
            setIsAuth(!!sess);
          }).catch(() => setIsAuth(false));
        } else if (window.AuthService && typeof window.AuthService.isAuthenticated === 'function') {
          window.AuthService.isAuthenticated().then(setIsAuth).catch(() => setIsAuth(false));
        }
      } catch (e) {
        console.warn("Auth check error:", e);
      }
    };
    
    checkAuth();

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
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    const handleOrderSaved = () => {
      // Giữ nguyên rawText và parsedData trên panel để người dùng xem và đối chiếu trên form hãng
      triggerToast('💾 Đã lưu thông tin đơn hàng!', 'success');
    };

    window.addEventListener('order-saved-db', handleOrderSaved);
    return () => {
      window.removeEventListener('order-saved-db', handleOrderSaved);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  const handleParse = (text) => {
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

    setLocalData(localParsed);
    setParsedData(localParsed);
    setState('PARSE_REVIEW');
  };

  const handleConfirmParseReview = (editedData) => {
    setParsedData(editedData);
    setState('LOADING');
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.id && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage({ action: 'runGroq', text: rawText, token: session?.access_token }, async (response) => {
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

          // Đọc cấu hình AI thực tế: ưu tiên Cloud (shop_feature_flags), fallback Chrome Storage
          let confidenceThreshold = 90;
          let autoCorrect = true;
          try {
            if (window.AuthService && window.AuthService.fetchShopFeatureFlags && typeof SupabaseCloud !== 'undefined') {
              const cloud = await SupabaseCloud.loadConfig();
              const sess = await window.AuthSession.getSession();
              if (sess && sess.active_shop_id && sess.access_token && !sess.access_token.startsWith('local_dev_token_')) {
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
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          setTimeout(() => {
            const mockAi = { 
              name: 'Nguyễn Văn An', 
              phone: '0901234567', 
              address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
              orderCode: 'DH123456',
              codAmount: 150000,
              extraNote: 'Ghi chú mẫu',
              productItem: '5kg đỗ quyên'
            };
            
            const mergedData = { ...editedData };
            if (editedData.name === localData.name) mergedData.name = mockAi.name;
            if (editedData.phone === localData.phone) mergedData.phone = mockAi.phone;
            if (editedData.orderCode === localData.orderCode) mergedData.orderCode = mockAi.orderCode;
            if (editedData.extraNote === localData.extraNote) mergedData.extraNote = mockAi.extraNote;
            if (Number(editedData.codAmount) === Number(localData.codAmount)) mergedData.codAmount = mockAi.codAmount;
            if (editedData.productItem === localData.productItem) mergedData.productItem = mockAi.productItem;
            
            let finalAddress = editedData.address !== localData.address ? editedData.address : mockAi.address;

            setParsedData({
              ...mergedData,
              address: finalAddress,
              warning: '',
              confidence: 95,
              confidenceThreshold: 90
            }); 
            setState('REVIEW');
          }, 1000);
        } else {
          // Legacy marker: Không kết nối được dịch vụ AI. Sử dụng dữ liệu trích xuất cục bộ.
          // In production, if extension messaging fails, degrade gracefully using local parsed data
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
      }
    } catch (err) {
      triggerToast('⚠️ Lỗi: Extension đã được cập nhật. Vui lòng nhấn F5 để tải lại trang web.', 'error');
      setState('IDLE');
    }
  };

  const handleConfirm = async (editedData) => {
    const finalData = editedData || parsedData;
    if (editedData) setParsedData(finalData);

    // Đọc các thiết lập mặc định (sản phẩm mặc định, trọng lượng) từ Chrome storage
    const defaults = await new Promise(resolve => {
      chrome.storage.local.get([
        'default_goods_name',
        'default_weight_vnpost',
        'default_weight_jt'
      ], r => {
        resolve({
          defaultGoodsName: r.default_goods_name || 'Hàng hóa',
          defaultWeightVnpost: r.default_weight_vnpost !== undefined ? Number(r.default_weight_vnpost) : 200,
          defaultWeightJt: r.default_weight_jt !== undefined ? Number(r.default_weight_jt) : 0.2
        });
      });
    });

    // Gán dữ liệu vào global store để các adapter carrier đọc
    globalThis.parsedDataStore = {
      name: finalData.name || '',
      phone: finalData.phone || '',
      address: finalData.address || '',
      orderCode: finalData.orderCode || '',
      codAmount: finalData.codAmount || 0,
      extraNote: finalData.extraNote || '',
      carrierAccount: carrierAccount || finalData.carrierAccount || '',
      defaultGoodsName: defaults.defaultGoodsName,
      defaultWeightVnpost: defaults.defaultWeightVnpost,
      defaultWeightJt: defaults.defaultWeightJt,
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
    >
      {isAuth && state === 'IDLE' && <ParseMode onParse={handleParse} />}

      {state === 'PARSE_REVIEW' && (
        <ParseReview
          data={parsedData}
          rawText={rawText}
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
          onParse={handleParse}
          onConfirm={handleConfirm} 
          onCancel={() => setState('IDLE')} 
          onSave={() => {
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
