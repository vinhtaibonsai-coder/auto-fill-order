import React, { useState } from 'react';
import { Store, Building2, Laptop, ArrowRight } from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminService } from '../../../domain/admin/admin.service.js';

export default function AssignDeviceShopModal({ open, device, shops = [], onClose, onAssigned }) {
  const [selectedShopId, setSelectedShopId] = useState(device?.shop_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open || !device) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const devId = device.device_id || device.id;
      const res = await AdminService.assignDeviceToShop(devId, selectedShopId || null);
      if (res.success) {
        onAssigned?.(devId, selectedShopId || null);
        onClose?.();
      } else {
        setError(res.error || 'Gán Shop thất bại');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối khi gán Shop');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Chuyển / Gán Thiết Bị Vào Cửa Hàng (Shop)"
      maxWidth="520px"
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Current Device Details */}
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
            <Laptop size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>
              {device.device_name || 'Trình duyệt Web'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Tài khoản: {device.email || '—'}
            </div>
          </div>
        </div>

        {/* Shop Selection */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Chọn Cửa Hàng mục tiêu:
          </label>
          <select
            value={selectedShopId}
            onChange={e => setSelectedShopId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 13,
              background: '#fff'
            }}
          >
            <option value="">-- Chưa gắn Cửa Hàng (Thiết bị vãng lai) --</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>
                🏢 {s.name} ({s.shop_code || 'Chưa có mã'} - Tối đa {s.max_devices || 5} máy)
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
            Sau khi gán, thiết bị sẽ chịu sự quản lý hạn mức máy trạm và phân quyền theo Cửa Hàng này.
          </p>
        </div>

        {/* Actions */}
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
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {saving ? 'Đang lưu...' : 'Xác nhận Chuyển Shop'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
