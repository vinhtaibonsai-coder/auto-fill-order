import React, { useState, useEffect } from 'react';
import { Send, UploadCloud, AlertCircle, Sparkles, CheckSquare } from 'lucide-react';
import AdminModal from './AdminModal';

export default function PublishReleaseModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    version: '1.0.1',
    minVersion: '1.0.0',
    forceUpdate: false,
    rolloutPercentage: 100,
    downloadUrl: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.version.trim()) {
      setError('Vui lòng nhập số phiên bản phát hành.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit?.(form);
    } catch (err) {
      setError(err.message || 'Lỗi khi phát hành phiên bản.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Phát Hành Cập Nhật Extension (OTA Release)">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Version Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Phiên bản mới: *
            </label>
            <input
              type="text"
              required
              placeholder="ví dụ: 2.5.0"
              value={form.version}
              onChange={e => { setForm({ ...form, version: e.target.value }); setError(''); }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Phiên bản tối thiểu hỗ trợ: *
            </label>
            <input
              type="text"
              required
              placeholder="ví dụ: 2.0.0"
              value={form.minVersion}
              onChange={e => setForm({ ...form, minVersion: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        {/* Rollout % and Force Update */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Tỷ lệ triển khai (%):
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.rolloutPercentage}
              onChange={e => setForm({ ...form, rolloutPercentage: Number(e.target.value) })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 16 }}>
            <input
              type="checkbox"
              checked={form.forceUpdate}
              onChange={e => setForm({ ...form, forceUpdate: e.target.checked })}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
              Bắt buộc cập nhật ngay
            </span>
          </label>
        </div>

        {/* Download URL */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
            Đường dẫn tải file ZIP cập nhật (Download URL):
          </label>
          <input
            type="url"
            placeholder="https://drive.google.com/... hoặc link tải trực tiếp file zip"
            value={form.downloadUrl}
            onChange={e => setForm({ ...form, downloadUrl: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>

        {/* Release notes */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
            Ghi chú thay đổi (Release Notes):
          </label>
          <textarea
            rows={4}
            placeholder="Nội dung cập nhật tính năng mới hoặc sửa lỗi..."
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1', resize: 'vertical' }}
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
            disabled={submitting}
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
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
            }}
          >
            <UploadCloud size={15} />
            {submitting ? 'Đang phát hành...' : 'Phát Hành Phiên Bản'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
