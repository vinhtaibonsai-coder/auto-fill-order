import React, { useState, useEffect } from 'react';

export default function OrderSettings() {
  const [config, setConfig] = useState({
    defaultCarrier: 'VNPost',
    defaultGoodsName: 'Quần áo',
    defaultWeightVnpost: 200,
    defaultWeightJt: 0.2,
    defaultCodAmount: 0,
    wfAutoParse: true,
    wfAutoCorrect: true,
    wfStopLowConfidence: true,
    wfAutoSubmit: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'default_carrier',
        'default_goods_name',
        'default_weight_vnpost',
        'default_weight_jt',
        'default_cod_amount',
        'wf_auto_parse',
        'wf_auto_correct',
        'wf_stop_low_confidence',
        'wf_auto_submit'
      ], (result) => {
        setConfig({
          defaultCarrier: result.default_carrier || 'VNPost',
          defaultGoodsName: result.default_goods_name || 'Quần áo',
          defaultWeightVnpost: result.default_weight_vnpost !== undefined ? Number(result.default_weight_vnpost) : 200,
          defaultWeightJt: result.default_weight_jt !== undefined ? Number(result.default_weight_jt) : 0.2,
          defaultCodAmount: result.default_cod_amount !== undefined ? Number(result.default_cod_amount) : 0,
          wfAutoParse: result.wf_auto_parse !== false,
          wfAutoCorrect: result.wf_auto_correct !== false,
          wfStopLowConfidence: result.wf_stop_low_confidence !== false,
          wfAutoSubmit: !!result.wf_auto_submit
        });
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSave = async () => {
    setSaveStatus('Đang lưu...');
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise(resolve => {
          chrome.storage.local.set({
            default_carrier: config.defaultCarrier,
            default_goods_name: config.defaultGoodsName.trim(),
            default_weight_vnpost: Number(config.defaultWeightVnpost) || 0,
            default_weight_jt: Number(config.defaultWeightJt) || 0,
            default_cod_amount: Number(config.defaultCodAmount) || 0,
            wf_auto_parse: config.wfAutoParse,
            wf_auto_correct: config.wfAutoCorrect,
            wf_stop_low_confidence: config.wfStopLowConfidence,
            wf_auto_submit: config.wfAutoSubmit
          }, resolve);
        });
      }
      setSaveStatus('✅ Đã lưu cấu hình mặc định thành công!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      setSaveStatus('❌ Lỗi: ' + err.message);
    }
  };

  if (isLoading) return <div>Đang tải...</div>;

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Order Workflow & Defaults</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Cấu hình các giá trị mặc định khi tự động điền đơn hàng trên các hãng vận chuyển.
      </p>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Giá trị mặc định (Defaults)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Hãng vận chuyển mặc định</label>
            <select 
              value={config.defaultCarrier}
              onChange={(e) => setConfig({...config, defaultCarrier: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
            >
              <option value="VNPost">VNPost</option>
              <option value="J&T Express">J&T Express</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Tên Hàng Hóa Mặc Định (Nếu mã đơn hàng trống)</label>
            <input 
              type="text" 
              value={config.defaultGoodsName}
              onChange={(e) => setConfig({...config, defaultGoodsName: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Trọng lượng mặc định VNPost (gram)</label>
            <input 
              type="number" 
              value={config.defaultWeightVnpost}
              onChange={(e) => setConfig({...config, defaultWeightVnpost: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Trọng lượng mặc định J&T Express (kg)</label>
            <input 
              type="number" 
              step="0.01"
              value={config.defaultWeightJt}
              onChange={(e) => setConfig({...config, defaultWeightJt: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Tiền Thu Hộ (COD) Mặc Định</label>
            <input 
              type="number" 
              value={config.defaultCodAmount}
              onChange={(e) => setConfig({...config, defaultCodAmount: e.target.value})}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Tự động hóa (Workflow)</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input 
            type="checkbox" 
            checked={config.wfAutoParse}
            onChange={(e) => setConfig({...config, wfAutoParse: e.target.checked})}
            id="wf-1" 
            style={{ width: '18px', height: '18px' }} 
          />
          <div>
            <label htmlFor="wf-1" style={{ fontWeight: 600, display: 'block' }}>Tự động phân tích (Auto Parse)</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tự động đưa text vào AI ngay khi copy.</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input 
            type="checkbox" 
            checked={config.wfAutoCorrect}
            onChange={(e) => setConfig({...config, wfAutoCorrect: e.target.checked})}
            id="wf-2" 
            style={{ width: '18px', height: '18px' }} 
          />
          <div>
            <label htmlFor="wf-2" style={{ fontWeight: 600, display: 'block' }}>Tự động chuẩn hóa địa chỉ</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chạy qua Address Engine để mapping phường/xã.</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input 
            type="checkbox" 
            checked={config.wfStopLowConfidence}
            onChange={(e) => setConfig({...config, wfStopLowConfidence: e.target.checked})}
            id="wf-3" 
            style={{ width: '18px', height: '18px' }} 
          />
          <div>
            <label htmlFor="wf-3" style={{ fontWeight: 600, display: 'block' }}>Dừng xem xét nếu độ tin cậy {'< Ngưỡng cài đặt'}</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nếu AI không chắc chắn, sẽ hiện bảng để nhân viên kiểm tra lại.</span>
          </div>
        </div>
 
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input 
            type="checkbox" 
            checked={config.wfAutoSubmit}
            onChange={(e) => setConfig({...config, wfAutoSubmit: e.target.checked})}
            id="wf-4" 
            style={{ width: '18px', height: '18px' }} 
          />
          <div>
            <label htmlFor="wf-4" style={{ fontWeight: 600, display: 'block', color: 'var(--danger)' }}>Tự động Lưu Đơn (Auto Submit) - RỦI RO</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tự động click nút Lưu trên Hãng vận chuyển sau khi điền (Không khuyến nghị).</span>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          onClick={handleSave}
          style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
        >
          Lưu Cấu Hình
        </button>
        {saveStatus && <span style={{ fontSize: '14px', fontWeight: 600, color: saveStatus.includes('✅') ? 'var(--success)' : 'var(--text-main)' }}>{saveStatus}</span>}
      </div>
    </div>
  );
}
