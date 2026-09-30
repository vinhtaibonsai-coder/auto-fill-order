import React, { useState, useEffect } from 'react';
import { Bot, Save, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import AdminModal from './AdminModal';

export default function ShopAiRulesModal({ open, shop, onClose, onSuccess }) {
  const [rules, setRules] = useState('');
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && shop) {
      setLoading(true);
      setError('');
      AdminService.getShopFeatureFlags(shop.id).then(res => {
        if (res.success && res.data) {
          setFlags(res.data);
          setRules(res.data.custom_prompt_rules || '');
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [open, shop]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await AdminService.updateShopFeatureFlags(shop.id, flags, {
        custom_prompt_rules: rules.trim()
      });
      if (res.success) {
        alert(`Đã cập nhật quy tắc bóc tách AI cho Shop "${shop.name}" thành công!`);
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.error || 'Lỗi khi lưu quy tắc AI.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi lưu quy tắc AI.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !shop) return null;

  return (
    <AdminModal open={open} onClose={onClose} title={`Tùy Chỉnh Quy Tắc AI — ${shop.name}`}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Helper Card */}
        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#475569' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#2563eb" /> Hướng dẫn viết Prompt AI cho Shop:
          </div>
          <div>Ghi rõ các quy tắc nhận diện đặc thù ngành hàng (VD: <em>"Nếu khách ghi 'lũa mini' gán giá 50.000đ"</em> hoặc <em>"Mặc định miễn phí giao hàng cho đơn trên 500k"</em>).</div>
        </div>

        {/* Textarea */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Quy tắc Prompt AI riêng (Custom Prompt Rules):
          </label>
          <textarea
            rows={7}
            placeholder="Nhập quy tắc bóc tách tùy biến cho cửa hàng này..."
            value={rules}
            onChange={e => setRules(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              fontSize: 13,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting || loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
            }}
          >
            <Save size={15} />
            {submitting ? 'Đang lưu...' : 'Lưu Quy Tắc AI'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
