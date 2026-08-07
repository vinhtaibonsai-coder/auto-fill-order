import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

export default function Quotas() {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  
  const [quota, setQuota] = useState({
    shopId: '',
    planName: 'FREE',
    dailyQuota: 100,
    usedQuota: 0,
    features: {
      addressEngine: true,
      aiParsing: true,
      autoSync: false
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Load danh sách Shops
  useEffect(() => {
    const fetchShops = async () => {
      try {
        if (!globalThis.SupabaseCloud) {
          setMessage({ text: 'Không tìm thấy kết nối Supabase.', type: 'error' });
          setLoading(false);
          return;
        }
        
        const configRes = await globalThis.SupabaseCloud.loadConfig();
        if (!configRes.url) throw new Error('Chưa cấu hình Supabase URL');

        const sess = await AuthSession.getSession();
        const token = sess ? sess.access_token : configRes.anonKey;

        const response = await fetch(`${configRes.url}/rest/v1/shops?select=id,name`, {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Lỗi truy vấn Database');
        
        const result = await response.json();
        setShops(result);
        if (result.length > 0) {
          setSelectedShopId(result[0].id);
        }
      } catch (err) {
        setMessage({ text: 'Lỗi tải danh sách cửa hàng: ' + err.message, type: 'error' });
      }
      setLoading(false);
    };

    fetchShops();
  }, []);

  // Khi selectedShopId thay đổi, load Quota của Shop đó
  useEffect(() => {
    if (!selectedShopId) return;

    const fetchShopQuota = async () => {
      setLoading(true);
      setMessage({ text: '', type: '' });
      try {
        const configRes = await globalThis.SupabaseCloud.loadConfig();
        const sess = await AuthSession.getSession();
        const token = sess ? sess.access_token : configRes.anonKey;

        const response = await fetch(`${configRes.url}/rest/v1/shop_quotas?select=*&shop_id=eq.${selectedShopId}`, {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result && result.length > 0) {
            const q = result[0];
            setQuota({
              shopId: q.shop_id,
              planName: q.plan_name || 'FREE',
              dailyQuota: q.ai_quota_limit || 100,
              usedQuota: q.ai_quota_used || 0,
              features: {
                addressEngine: true,
                aiParsing: true,
                autoSync: false
              }
            });
          } else {
            // Nếu shop chưa có quota, reset về default
            setQuota({
              shopId: selectedShopId,
              planName: 'FREE',
              dailyQuota: 100,
              usedQuota: 0,
              features: {
                addressEngine: true,
                aiParsing: true,
                autoSync: false
              }
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchShopQuota();
  }, [selectedShopId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      // Vì SupabaseCloud.upsert chưa chắc được viết chuẩn trong client.js của bạn,
      // Ta sẽ dùng insert hoặc update tuỳ theo có data hay chưa.
      // Dùng fetch trực tiếp cho chắc chắn upsert
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      if (!configRes.url) throw new Error('Chưa cấu hình Supabase URL');

      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : configRes.anonKey;

      const upsertData = {
        shop_id: selectedShopId,
        plan_name: quota.planName,
        ai_quota_limit: quota.dailyQuota,
        ai_quota_used: quota.usedQuota,
        updated_at: new Date().toISOString()
      };

      const response = await fetch(`${configRes.url}/rest/v1/shop_quotas?on_conflict=shop_id`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(upsertData)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Lỗi khi lưu dữ liệu');
      }

      setMessage({ text: 'Lưu thông tin hạn mức thành công!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Lỗi: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  return (
    <div>
      <h2 className="page-title">AI Platform & Quotas</h2>
      
      <div className="card" style={{ maxWidth: '600px', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '12px' }}>
            <span>Đang tải dữ liệu...</span>
          </div>
        )}

        <h3 style={{ marginTop: 0 }}>Quota Editor</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Quản lý gói cước và giới hạn số lượt bóc tách AI cho từng cửa hàng.
        </p>

        {message.text && (
          <div style={{ padding: '12px', marginBottom: '16px', borderRadius: '6px', background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: message.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#6ee7b7'}` }}>
            {message.text}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px' }}>Chọn Cửa hàng (Shop)</label>
          <select 
            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', borderRadius: '6px' }}
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
          >
            {shops.length === 0 ? (
              <option value="">Chưa có cửa hàng nào</option>
            ) : (
              shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))
            )}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px' }}>Gói cước (Plan)</label>
          <select 
            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', borderRadius: '6px' }}
            value={quota.planName}
            onChange={(e) => setQuota({ ...quota, planName: e.target.value })}
          >
            <option value="FREE">FREE (Miễn phí)</option>
            <option value="BASIC">BASIC (Cơ bản)</option>
            <option value="PRO">PRO (Chuyên nghiệp)</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#10b981' }}>Tổng lượt AI (Tháng)</label>
            <input 
              type="number" 
              value={quota.dailyQuota}
              onChange={(e) => setQuota({ ...quota, dailyQuota: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: '#10b981', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 'bold' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#ef4444' }}>Lượt đã sử dụng</label>
            <input 
              type="number" 
              value={quota.usedQuota}
              onChange={(e) => setQuota({ ...quota, usedQuota: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: '#ef4444', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: 'bold' }} 
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px' }}>Active Features</label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={quota.features.aiParsing} onChange={() => {}} />
              <span>AI Parsing</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={quota.features.addressEngine} onChange={() => {}} />
              <span>Address Engine</span>
            </label>
          </div>
        </div>

        <button 
          className="badge-success" 
          onClick={handleSave}
          disabled={saving || !selectedShopId}
          style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: (saving || !selectedShopId) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (saving || !selectedShopId) ? 0.6 : 1 }}
        >
          {saving ? 'Đang lưu...' : 'Lưu Cấu Hình (Save)'}
        </button>
      </div>
    </div>
  );
}
