import React, { useState, useEffect } from 'react';
import { OrderStorage } from '../../../../application/storage.js';

export default function DatabaseManager() {
  const [stats, setStats] = useState({
    usageBytes: 0,
    quotaBytes: 5242880, // 5MB Chrome storage quota
    savedOrdersCount: 0,
    submittedOrdersCount: 0
  });
  const [isWiping, setIsWiping] = useState(false);
  const [wipeStatus, setWipeStatus] = useState('');

  const loadStats = async () => {
    try {
      const saved = await OrderStorage.getOrders().catch(() => []);
      const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);
      
      // Calculate approximate usage
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        setStats({
          usageBytes: bytes || 0,
          quotaBytes: 5242880,
          savedOrdersCount: saved.length,
          submittedOrdersCount: submitted.length
        });
      });
    } catch (err) {
      console.error("Lỗi khi tải DB Stats:", err);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleWipeDatabase = async () => {
    if (!confirm('⚠️ CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ dữ liệu đơn hàng (Nháp + Đã Lên) lưu trên máy tính này. Không thể hoàn tác!\n\nBạn có chắc chắn muốn tiếp tục?')) return;
    
    setIsWiping(true);
    setWipeStatus('Đang xóa dữ liệu...');
    try {
      const savedKey = await OrderStorage._getOrdersKey();
      const submittedKey = await OrderStorage._getSubmittedKey();
      
      await new Promise(resolve => {
        chrome.storage.local.remove([savedKey, submittedKey], resolve);
      });
      
      setWipeStatus('✅ Đã làm sạch Database thành công!');
      loadStats();
      setTimeout(() => setWipeStatus(''), 5000);
    } catch (err) {
      setWipeStatus('❌ Lỗi khi xóa: ' + err.message);
    } finally {
      setIsWiping(false);
    }
  };

  const usagePercent = Math.min(100, Math.round((stats.usageBytes / stats.quotaBytes) * 100));
  const usageMb = (stats.usageBytes / (1024 * 1024)).toFixed(2);
  const quotaMb = (stats.quotaBytes / (1024 * 1024)).toFixed(2);

  return (
    <div>
      <h2 className="page-title">Quản lý Database (Storage)</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Theo dõi dung lượng lưu trữ cục bộ và dọn dẹp bộ nhớ đệm (Cache) của Extension.
      </p>

      <div className="grid-cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '14px', textTransform: 'uppercase' }}>Dung lượng Local Storage</h3>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: usagePercent > 80 ? 'var(--danger)' : 'var(--primary)' }}>
            {usagePercent}%
          </div>
          <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Đã dùng {usageMb} MB / {quotaMb} MB
          </div>
          
          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ width: `${usagePercent}%`, height: '100%', background: usagePercent > 80 ? '#ef4444' : '#3b82f6', transition: 'width 0.3s' }}></div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '14px', textTransform: 'uppercase' }}>Bản ghi trong CSDL</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600 }}>Đơn nháp (Chưa lên)</span>
            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{stats.savedOrdersCount}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <span style={{ fontWeight: 600 }}>Đơn đã lên hãng vận chuyển</span>
            <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{stats.submittedOrdersCount}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px', border: '1px solid #fecaca', background: '#fff5f5' }}>
        <h3 style={{ marginTop: 0, color: '#dc2626' }}>Danger Zone</h3>
        <p style={{ fontSize: '14px', color: '#7f1d1d', marginBottom: '16px' }}>
          Hành động này sẽ dọn dẹp giải phóng bộ nhớ. Chú ý chỉ nên thực hiện sau khi các đơn hàng đã được đồng bộ an toàn lên Đám mây (Cloud).
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={handleWipeDatabase}
            disabled={isWiping}
            style={{ 
              background: '#dc2626', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: '6px', 
              fontWeight: 600, 
              cursor: isWiping ? 'not-allowed' : 'pointer',
              opacity: isWiping ? 0.7 : 1
            }}
          >
            {isWiping ? 'Đang dọn dẹp...' : 'Dọn dẹp Database (Xóa Cache)'}
          </button>
          {wipeStatus && <span style={{ fontSize: '14px', fontWeight: 600, color: wipeStatus.includes('✅') ? 'var(--success)' : '#dc2626' }}>{wipeStatus}</span>}
        </div>
      </div>
    </div>
  );
}
