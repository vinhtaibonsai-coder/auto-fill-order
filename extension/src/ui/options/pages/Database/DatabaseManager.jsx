import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Trash2, AlertTriangle, CheckCircle2, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { OrderStorage } from '../../../../application/storage.esm.js';

const hasChromeStorage = () => typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

export default function DatabaseManager() {
  const [stats, setStats] = useState({
    usageBytes: 0,
    quotaBytes: 5242880, // 5MB Chrome storage quota
    savedOrdersCount: 0,
    submittedOrdersCount: 0
  });
  const [isWiping, setIsWiping] = useState(false);
  const [wipeStatus, setWipeStatus] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadStats = async () => {
    try {
      const saved = await OrderStorage.getOrders().catch(() => []);
      const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);

      const finish = (bytes) => {
        setStats({
          usageBytes: bytes || 0,
          quotaBytes: 5242880,
          savedOrdersCount: saved.length,
          submittedOrdersCount: submitted.length
        });
      };

      if (hasChromeStorage() && typeof chrome.storage.local.getBytesInUse === 'function') {
        chrome.storage.local.getBytesInUse(null, finish);
      } else {
        const bytes = typeof localStorage !== 'undefined'
          ? new Blob(Object.values(localStorage)).size
          : JSON.stringify({ saved, submitted }).length;
        finish(bytes);
      }
    } catch (err) {
      console.error("Lỗi khi tải DB Stats:", err);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleWipeDatabase = async () => {
    setIsWiping(true);
    setWipeStatus('Đang xóa dữ liệu...');
    try {
      const savedKey = await OrderStorage._getOrdersKey();
      const submittedKey = await OrderStorage._getSubmittedKey();

      await new Promise(resolve => {
        if (hasChromeStorage()) {
          chrome.storage.local.remove([savedKey, submittedKey], resolve);
        } else if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(savedKey);
          localStorage.removeItem(submittedKey);
          resolve();
        } else {
          resolve();
        }
      });

      setWipeStatus('✅ Đã làm sạch Database thành công!');
      setShowConfirmModal(false);
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
      <div style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Quản Lý Bộ Nhớ Cục Bộ & Cache</h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>
          Theo dõi dung lượng lưu trữ cục bộ và dọn dẹp bộ nhớ đệm (Cache) của Extension trên máy tính này.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Storage Capacity Card */}
        <div className="card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <HardDrive size={15} color="var(--primary)" /> Dung Lượng Bộ Nhớ Cục Bộ
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: usagePercent > 80 ? 'var(--danger)' : 'var(--primary)', marginTop: '8px' }}>
            {usagePercent}%
          </div>
          <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Đã dùng <strong>{usageMb} MB</strong> / {quotaMb} MB (Chrome Storage Quota)
          </div>

          <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '999px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ width: `${usagePercent}%`, height: '100%', background: usagePercent > 80 ? 'var(--danger)' : 'var(--primary)', borderRadius: '999px' }}></div>
          </div>
        </div>

        {/* Records Count Card */}
        <div className="card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Database size={15} color="var(--success)" /> Dữ Liệu Trong Bộ Nhớ Máy
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)' }}>Đơn nháp (Chưa gửi)</span>
            <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}>{stats.savedOrdersCount}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-main)' }}>Đơn đã gửi lên bưu cục</span>
            <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--success)' }}>{stats.submittedOrdersCount}</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{
        border: '1px solid rgba(239, 68, 68, 0.3)',
        background: 'var(--color-danger-bg)',
        borderRadius: '12px',
        padding: '22px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger-text)', marginBottom: '8px' }}>
          <ShieldAlert size={20} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Vùng Nguy Hiểm (Dọn Dẹp Cache)</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-danger-text)', margin: '0 0 16px 0', lineHeight: '1.5', opacity: 0.9 }}>
          Hành động này sẽ xóa sạch dữ liệu đơn nháp và lịch sử lưu tạm trên trình duyệt của máy tính này. Hãy đảm bảo dữ liệu quan trọng đã được đồng bộ an toàn lên Cloud.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isWiping}
            style={{
              background: 'var(--danger)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isWiping ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
            }}
          >
            <Trash2 size={15} /> {isWiping ? 'Đang dọn dẹp...' : 'Dọn dẹp Bộ nhớ Cục bộ (Xóa Cache)'}
          </button>
          {wipeStatus && (
            <span style={{ fontSize: '13px', fontWeight: 700, color: wipeStatus.includes('✅') ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
              {wipeStatus}
            </span>
          )}
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '440px',
            padding: '22px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            animation: 'fadeInPop 0.15s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', marginBottom: '12px' }}>
              <AlertTriangle size={22} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Xác Nhận Xóa Bộ Nhớ Cục Bộ</h3>
            </div>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Hành động này sẽ <strong>XÓA TOÀN BỘ</strong> dữ liệu đơn hàng (Nháp + Đã Lên) lưu trên máy tính này. Dữ liệu trên Cloud sẽ không bị ảnh hưởng. Bạn có chắc muốn tiếp tục?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleWipeDatabase}
                disabled={isWiping}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isWiping ? 'not-allowed' : 'pointer'
                }}
              >
                {isWiping ? 'Đang xóa...' : 'Đồng Ý Xóa Cache'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
