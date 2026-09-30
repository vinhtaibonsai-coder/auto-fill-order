import React, { useState } from 'react';
import { Edit2, Laptop } from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminService } from '../../../domain/admin/admin.service.js';

export default function EditDeviceNameModal({ open, device, onClose, onSaved }) {
  const [name, setName] = useState(device?.device_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open || !device) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Tên thiết bị không được để trống');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const devId = device.device_id || device.id;
      const res = await AdminService.updateDeviceName(devId, name.trim());
      if (res.success) {
        onSaved?.(devId, name.trim());
        onClose?.();
      } else {
        setError(res.error || 'Cập nhật tên thất bại');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi đổi tên thiết bị');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Đổi Tên Gợi Nhớ Cho Thiết Bị"
      maxWidth="480px"
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Tên gợi nhớ / Nickname thiết bị:
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Máy Kế Toán Tầng 2, Laptop Kho Long Biên..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          />
          <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
            Đặt tên thân thiện giúp Admin và Cửa hàng dễ dàng nhận diện vị trí và vai trò của máy trạm.
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
            {saving ? 'Đang lưu...' : 'Lưu Tên Thiết Bị'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
