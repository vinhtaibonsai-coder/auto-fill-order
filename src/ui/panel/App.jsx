import React, { useState, useEffect } from 'react';
import DraggableCard from './components/DraggableCard';
import ParseMode from './components/ParseMode';
import ConfidenceReview from './components/ConfidenceReview';
import SkeletonReview from './components/SkeletonReview';

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [state, setState] = useState('IDLE'); // IDLE, LOADING, REVIEW, SUCCESS, ERROR, UPGRADE_REQUIRED
  const [parsedData, setParsedData] = useState(null);
  const [rawText, setRawText] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [session, setSession] = useState(null);

  const triggerToast = (msg, type = 'info') => {
    if (typeof globalThis.showVnpostToast === 'function') {
      globalThis.showVnpostToast(msg, type);
    } else {
      console.log(`[Toast] [${type.toUpperCase()}] ${msg}`);
    }
  };

  useEffect(() => {
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

    const handleOrderSaved = () => {
      setRawText('');
      setParsedData(null);
      triggerToast('💾 Đã ghi nhận và lưu đơn hàng vào Database thành công!', 'success');
      setState('IDLE');
    };

    window.addEventListener('order-saved-db', handleOrderSaved);
    return () => {
      window.removeEventListener('order-saved-db', handleOrderSaved);
    };
  }, []);

  const handleParse = (text) => {
    setRawText(text);
    setState('LOADING');
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.id && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage({ action: 'runGroq', text: text }, async (response) => {
          if (chrome.runtime.lastError || !response || !response.ok) {
            const errMsg = chrome.runtime.lastError?.message || response?.error || '';
            console.error("AI Error:", errMsg);
            
            if (errMsg.includes('context invalidated')) {
              triggerToast('⚠️ Extension đã được cập nhật. Vui lòng nhấn F5 để tải lại trang web.', 'error');
              setState('IDLE');
              return;
            }

            if (errMsg === 'QUOTA_EXCEEDED' || errMsg.includes('hết hạn mức AI') || errMsg.includes('QUOTA')) {
              triggerToast('💎 Đã hết hạn mức AI tháng này. Vui lòng nâng cấp gói cước!', 'error');
              setState('IDLE');
              return;
            }

            if (errMsg.includes('Phiên đăng nhập') || errMsg.includes('session')) {
              triggerToast('🔒 Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
              setIsAuth(false);
              setState('IDLE');
              return;
            }

            triggerToast('❌ Lỗi AI: ' + (errMsg || 'Lỗi mạng hoặc Server không phản hồi.'), 'error');
            setState('IDLE');
            return;
          }
          
          const data = response.result || {};
          const rawAddress = data.correctAddress || data.address || response.correctAddress || '';
          
          let finalAddress = rawAddress;
          let warning = '';
          let suggestedAddress = '';
          let confidence = 95;

          // Đọc cấu hình AI thực tế của người dùng từ Chrome Storage
          const settings = await new Promise(resolve => {
            chrome.storage.local.get(['ai_confidence_threshold', 'ai_auto_correct'], r => {
              resolve({
                confidenceThreshold: r.ai_confidence_threshold !== undefined ? Number(r.ai_confidence_threshold) : 90,
                autoCorrect: r.ai_auto_correct !== undefined ? r.ai_auto_correct : true
              });
            });
          });

          if (settings.autoCorrect && window.AddressEngine && typeof window.AddressEngine.process === 'function') {
            try {
              const engResult = await window.AddressEngine.process(rawAddress, data.phone || '');
              if (engResult) {
                finalAddress = engResult.fullAddress || rawAddress;
                warning = engResult.warning || '';
                confidence = engResult.confidence || 95;

                // Tạo gợi ý địa chỉ 2 cấp thực tế: Đường/Số nhà + Phường/Xã + Tỉnh/Thành phố (BỎ Quận/Huyện)
                const parts2 = [];
                if (engResult.street) {
                  parts2.push(engResult.street);
                } else {
                  // Fallback: Tìm phần đường từ địa chỉ thô
                  const rawParts = rawAddress.split(',').map(p => p.trim());
                  const streetPart = rawParts.find(p => /\d/.test(p) && !/^(phường|xã|quận|huyện|tỉnh|thành phố|p\.|q\.)/i.test(p));
                  if (streetPart) parts2.push(streetPart);
                }
                if (engResult.ward) parts2.push(engResult.ward);
                if (engResult.province) parts2.push(engResult.province);
                suggestedAddress = parts2.length > 0 ? parts2.join(', ') : finalAddress;
              }
            } catch (e) {
              console.warn('[React Panel] Lỗi chạy AddressEngine:', e);
            }
          }

          // Fallback gợi ý địa chỉ 2 cấp nếu chưa được tính toán
          if (!suggestedAddress && rawAddress) {
            const rawParts = rawAddress.split(',').map(p => p.trim());
            const filteredParts = rawParts.filter(p => !/^(quận|huyện|q\.|h\.)/i.test(p));
            suggestedAddress = filteredParts.length > 0 ? filteredParts.join(', ') : rawAddress;
          }

          setParsedData({
            name: data.name || '',
            phone: data.phone || '',
            address: finalAddress,
            orderCode: data.orderCode || '',
            codAmount: data.codAmount || '',
            extraNote: data.extraNote || '',
            warning: warning,
            suggestedAddress: suggestedAddress,
            confidence: confidence,
            confidenceThreshold: settings.confidenceThreshold
          });
          setState('REVIEW');
        });
      } else {
        setTimeout(() => {
          setParsedData({ 
            name: 'Nguyễn Văn An', 
            phone: '0901234567', 
            address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            orderCode: 'DH123456',
            codAmount: 150000,
            extraNote: 'Ghi chú mẫu'
          }); 
          setState('REVIEW');
        }, 1000);
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
      defaultGoodsName: defaults.defaultGoodsName,
      defaultWeightVnpost: defaults.defaultWeightVnpost,
      defaultWeightJt: defaults.defaultWeightJt
    };

    if (window.VNPostAdapter && typeof window.VNPostAdapter.fill === 'function') {
      window.VNPostAdapter.fill(finalData.name, finalData.phone, finalData.address, finalData.orderCode || '', finalData.codAmount || 0, false);
    } else if (window.JtAdapter && typeof window.JtAdapter.fill === 'function') {
      window.JtAdapter.fill(finalData.name, finalData.phone, finalData.address, finalData.orderCode || '', finalData.codAmount || 0, false);
    } else if (window.VNPostAutoFill && typeof window.VNPostAutoFill.fillForm === 'function') {
      // Fallback for old version
      window.VNPostAutoFill.fillForm(finalData);
    } else {
      console.warn("Không tìm thấy bộ autofill VNPost/J&T trên trang này");
    }

    // Hiển thị thông báo Toast thay vì đóng/xóa bảng điều khiển ngay lập tức
    if (typeof globalThis.showVnpostToast === 'function') {
      globalThis.showVnpostToast('✅ Đã điền thông tin đơn hàng vào biểu mẫu thành công!', 'success');
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
    <DraggableCard title="Auto Fill Order" onClose={() => setIsOpen(false)} isAuth={isAuth} session={session}>
      {isAuth && state === 'IDLE' && <ParseMode onParse={handleParse} />}

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
        <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 600, marginBottom: '12px', fontSize: '13px' }}>Đăng nhập để dùng AI</div>
          <input id="af-login-email" type="text" placeholder="Email hoặc Tên đăng nhập" style={{ width: '100%', marginBottom: '8px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <input id="af-login-password" type="password" placeholder="Mật khẩu" style={{ width: '100%', marginBottom: '12px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          <button className="af-btn-primary" style={{ width: '100%' }} onClick={async (e) => {
            const btn = e.target;
            const email = document.getElementById('af-login-email').value;
            const pass = document.getElementById('af-login-password').value;
            if (!email || !pass) return alert("Vui lòng nhập đủ thông tin");
            
            const originalText = btn.innerText;
            btn.innerText = "Đang đăng nhập...";
            btn.disabled = true;
            
            try {
              if (window.AuthService) {
                const res = await window.AuthService.loginWithUsernameOrEmail(email, pass);
                if (res) {
                  setIsAuth(true);
                  setState('IDLE');
                }
              }
            } catch (err) {
              alert("Lỗi đăng nhập: " + err.message);
            } finally {
              btn.innerText = originalText;
              btn.disabled = false;
            }
          }}>Đăng nhập</button>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px' }}>
            <a href="#" onClick={(e) => {
              e.preventDefault();
              if (chrome.runtime && chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
            }} style={{ color: 'var(--primary)' }}>Đăng ký / Quên mật khẩu?</a>
          </div>
        </div>
      )}
    </DraggableCard>
  );
}
