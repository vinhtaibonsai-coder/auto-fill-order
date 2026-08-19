import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function ShopProfile() {
  const [shop, setShop] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchShopProfile = async () => {
      try {
        const configRes = await globalThis.SupabaseCloud.loadConfig();
        const sess = await AuthSession.getSession();
        const token = sess ? sess.access_token : configRes.anonKey;

        if (sess && sess.active_shop_id) {
          const res = await fetch(`${configRes.url}/rest/v1/shops?select=*&id=eq.${sess.active_shop_id}`, {
            headers: {
              'apikey': configRes.anonKey,
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              const s = data[0];
              setShop({
                id: s.id || '',
                name: s.name || '',
                phone: s.phone || '',
                email: s.email || '',
                address: s.address || ''
              });
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    fetchShopProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : configRes.anonKey;

      if (!shop.id) throw new Error('Không tìm thấy ID Cửa hàng');

      const response = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${shop.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: shop.name,
          phone: shop.phone,
          email: shop.email,
          address: shop.address,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Không thể cập nhật thông tin cửa hàng');

      setMessage({ text: 'Cập nhật thông tin cửa hàng thành công!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Lỗi: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: '800px', position: 'relative' }}>
      <h2 className="page-title">Shop Profile</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Thông tin chung của cửa hàng. Thông tin này sẽ được đồng bộ lên các hãng vận chuyển khi tạo đơn.
      </p>

      <div className="card">
        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Đang tải dữ liệu cửa hàng...
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {message.text && (
              <div style={{ padding: '12px', borderRadius: '6px', background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: message.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#6ee7b7'}` }}>
                {message.text}
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Tên Cửa Hàng</label>
              <input 
                type="text" 
                value={shop.name}
                onChange={(e) => setShop({ ...shop, name: e.target.value })}
                placeholder="Ví dụ: My Shop" 
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Mã Shop (UUID)</label>
              <input 
                type="text" 
                disabled 
                value={shop.id}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: '#f8fafc', color: 'var(--text-muted)' }} 
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Số Điện Thoại Liên Hệ</label>
                <input 
                  type="text" 
                  value={shop.phone}
                  onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                  placeholder="0901234567" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Email Kho/Shop</label>
                <input 
                  type="email" 
                  value={shop.email}
                  onChange={(e) => setShop({ ...shop, email: e.target.value })}
                  placeholder="contact@shop.com" 
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} 
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px' }}>Địa Chỉ Kho Hàng (Mặc định)</label>
              <textarea 
                value={shop.address}
                onChange={(e) => setShop({ ...shop, address: e.target.value })}
                placeholder="Số nhà, Đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành..." 
                rows={3} 
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
              ></textarea>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <button 
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Đang lưu...' : 'Lưu Thông Tin'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
