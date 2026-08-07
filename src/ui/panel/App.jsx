import React, { useState, useEffect } from 'react';
import DraggableCard from './components/DraggableCard';
import ParseMode from './components/ParseMode';
import ConfidenceReview from './components/ConfidenceReview';

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [state, setState] = useState('IDLE'); // IDLE, LOADING, REVIEW, SUCCESS, ERROR, UPGRADE_REQUIRED
  const [parsedData, setParsedData] = useState(null);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    if (window.AuthService && typeof window.AuthService.isAuthenticated === 'function') {
      window.AuthService.isAuthenticated().then(setIsAuth);
    }
  }, []);

  const handleParse = (text) => {
    setState('LOADING');
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'runGroq', text: text }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          const errMsg = chrome.runtime.lastError?.message || response?.error || '';
          console.error("AI Error:", errMsg);
          
          if (errMsg === 'QUOTA_EXCEEDED' || errMsg.includes('hết hạn mức AI') || errMsg.includes('QUOTA')) {
            setParsedData({ errorMsg: errMsg });
            setState('UPGRADE_REQUIRED');
            return;
          }

          setParsedData({ errorMsg: errMsg || 'Lỗi mạng hoặc Server AI không phản hồi.' });
          setState('ERROR');
          return;
        }
        
        const data = response.result || {};
        setParsedData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.correctAddress || data.address || '',
          ward: data.ward || '',
          province: data.province || ''
        });
        setState('REVIEW');
      });
    } else {
      setTimeout(() => {
        setParsedData({ 
          name: 'Nguyễn Văn An', 
          phone: '0901234567', 
          address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
          ward: 'Phường Bến Nghé',
          province: 'TP. Hồ Chí Minh'
        }); 
        setState('REVIEW');
      }, 1000);
    }
  };

  const handleConfirm = (editedData) => {
    setState('SUCCESS');
    const finalData = editedData || parsedData;
    if (editedData) setParsedData(finalData);

    if (window.VNPostAutoFill && typeof window.VNPostAutoFill.fillForm === 'function') {
      window.VNPostAutoFill.fillForm(finalData);
    } else if (window.JtAutoFill && typeof window.JtAutoFill.fillForm === 'function') {
      window.JtAutoFill.fillForm(finalData);
    } else {
      console.warn("Không tìm thấy bộ autofill VNPost/J&T trên trang này");
    }

    setTimeout(() => {
      setState('IDLE');
    }, 2000);
  };

  if (!isOpen) {
    return (
      <button className="af-panel-toggle" onClick={() => setIsOpen(true)}>
        ⚡ AF
      </button>
    );
  }

  return (
    <DraggableCard title="Auto Fill Order" onClose={() => setIsOpen(false)} isAuth={isAuth}>
      {state === 'IDLE' && <ParseMode onParse={handleParse} />}

      {state === 'LOADING' && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '13px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
          <div>Đang bóc tách thông tin bằng AI...</div>
        </div>
      )}

      {state === 'REVIEW' && (
        <ConfidenceReview 
          data={parsedData} 
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
          ⚠️ Lỗi bóc tách AI: {parsedData?.errorMsg}
          <div style={{ marginTop: '10px' }}>
            <button className="af-btn-primary" style={{ background: '#be123c', fontSize: '12px', padding: '6px 12px' }} onClick={() => setState('IDLE')}>
              Thử lại
            </button>
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
    </DraggableCard>
  );
}
