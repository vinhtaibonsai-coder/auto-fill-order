import React, { useState } from 'react';
import { SlidersHorizontal, Building2, Smartphone } from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminService } from '../../../domain/admin/admin.service.js';

export default function EditShopMaxDevicesModal({ open, shop, onClose, onSaved }) {
  const [maxDevices, setMaxDevices] = useState(shop?.max_devices || 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open || !shop) return null;

  const presets = [3, 5, 10, 15, 20, 50];

  const handleSave = async (e) => {
    e.preventDefault();
    const num = parseInt(maxDevices, 10);
    if (!num || num < 1) {
      setError('Số lượng thiết bị tối đa phải lớn hơn 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await AdminService.updateShopMaxDevices(shop.id, num);
      if (res.success) {
        onSaved?.(shop.id, num);
        onClose?.();
      } else {
        setError(res.error || 'Cập nhật hạn mức thất bại');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi cập nhật hạn mức');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Cài Đặt Hạn Mức Thiết Bị: ${shop.name || 'Cửa Hàng'}`}
      maxWidth="480px"
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: '#eff6ff', color: '#2563eb',
            display: 'grid', placeItems: 'center'
          }}>
            <Building2 size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>
              {shop.name} ({shop.shop_code || 'Chưa có mã'})
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Hạn mức hiện tại: <strong>{shop.max_devices || 5} thiết bị</strong>
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Số lượng máy trạm / trình duyệt tối đa cho phép:
          </label>
          <input
            type="number"
            min="1"
            max="200"
            value={maxDevices}
            onChange={e => setMaxDevices(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748b', alignSelf: 'center' }}>Chọn nhanh:</span>
            {presets.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setMaxDevices(p)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: Number(maxDevices) === p ? '#2563eb' : '#f1f5f9',
                  color: Number(maxDevices) === p ? '#fff' : '#475569',
                  border: Number(maxDevices) === p ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                {p} máy
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 8 }}>
            Khi số lượng thiết bị của Shop đạt trần hạn mức này, các máy mới đăng nhập sẽ bị từ chối hoặc cần chủ Shop/Admin phê duyệt thêm.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu Hạn Mức Mới'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
