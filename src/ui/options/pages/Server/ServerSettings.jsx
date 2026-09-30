import React, { useEffect, useState } from 'react';

const isConfigured = (cfg) => !!(cfg && cfg.url && cfg.anonKey && !cfg.url.includes('YOUR_SUPABASE'));

export default function ServerSettings({ compact = false }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [status, setStatus] = useState({ type: 'idle', text: 'Chưa kiểm tra cấu hình máy chủ.' });
  const [isBusy, setIsBusy] = useState(false);

  const loadConfig = async () => {
    if (!globalThis.SupabaseCloud || typeof globalThis.SupabaseCloud.loadConfig !== 'function') {
      setStatus({ type: 'error', text: 'Supabase client chưa được nạp trong Options.' });
      return;
    }
    const cfg = await globalThis.SupabaseCloud.loadConfig();
    setUrl(cfg.url || '');
    setAnonKey(cfg.anonKey || '');
    setStatus(isConfigured(cfg)
      ? { type: 'ok', text: 'Đã có cấu hình Supabase. Bạn có thể kiểm tra kết nối trước khi đăng nhập.' }
      : { type: 'warn', text: 'Thiếu Supabase URL hoặc Anon Key. Nhập thông tin rồi bấm Lưu cấu hình.' });
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const saveOnly = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setStatus({ type: 'error', text: 'Vui lòng nhập đủ Supabase URL và Anon Key.' });
      return false;
    }
    if (!globalThis.SupabaseCloud || typeof globalThis.SupabaseCloud.saveConfig !== 'function') {
      setStatus({ type: 'error', text: 'Supabase client chưa được nạp trong Options.' });
      return false;
    }
    await globalThis.SupabaseCloud.saveConfig(url, anonKey);
    setStatus({ type: 'ok', text: 'Đã lưu cấu hình máy chủ Supabase.' });
    return true;
  };

  const handleSave = async () => {
    setIsBusy(true);
    try {
      await saveOnly();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveAndTest = async () => {
    setIsBusy(true);
    try {
      const saved = await saveOnly();
      if (!saved) return;
      if (typeof globalThis.SupabaseCloud.testConnection !== 'function') {
        setStatus({ type: 'ok', text: 'Đã lưu cấu hình. Không tìm thấy hàm kiểm tra kết nối.' });
        return;
      }
      setStatus({ type: 'idle', text: 'Đang kiểm tra kết nối Supabase...' });
      const result = await globalThis.SupabaseCloud.testConnection();
      setStatus(result.ok
        ? { type: 'ok', text: `Kết nối Supabase thành công: ${result.url || url}` }
        : { type: 'error', text: `Kết nối thất bại: ${result.reason || 'không rõ lỗi'}` });
    } finally {
      setIsBusy(false);
    }
  };

  const tone = {
    ok: { bg: 'var(--color-success-bg)', border: 'rgba(16, 185, 129, 0.3)', color: 'var(--color-success-text)' },
    warn: { bg: 'var(--color-warning-bg)', border: 'rgba(245, 158, 11, 0.3)', color: 'var(--color-warning-text)' },
    error: { bg: 'var(--color-danger-bg)', border: 'rgba(239, 68, 68, 0.3)', color: 'var(--color-danger-text)' },
    idle: { bg: 'var(--bg)', border: 'var(--border)', color: 'var(--text-muted)' }
  }[status.type] || { bg: 'var(--bg)', border: 'var(--border)', color: 'var(--text-muted)' };

  return (
    <div style={{ maxWidth: compact ? '100%' : '800px' }}>
      {!compact && <h2 className="page-title">Kết Nối Máy Chủ Supabase</h2>}
      <div className="card" style={{ padding: compact ? '20px' : '24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Máy chủ Đám mây (Supabase Cloud)</h3>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' }}>
            Quản trị viên / Admin
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: '18px', fontSize: '13px', lineHeight: '1.4' }}>
          Cấu hình kết nối cơ sở dữ liệu Supabase Cloud của toàn bộ tiện ích. Tiện ích đã được cấu hình sẵn máy chủ mặc định, chỉ Quản trị viên hệ thống (Master Admin) mới cần thay đổi khi chuyển đổi hạ tầng server.
        </p>

        <div style={{ display: 'grid', gap: '14px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
            Supabase URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              spellCheck={false}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '13px', outline: 'none' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
            Supabase Anon Key
            <textarea
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1Ni..."
              spellCheck={false}
              rows={compact ? 3 : 4}
              style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)', color: 'var(--text-main)', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', outline: 'none' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isBusy}
              style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: isBusy ? 'default' : 'pointer', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)' }}
            >
              Lưu cấu hình
            </button>
            <button
              type="button"
              onClick={handleSaveAndTest}
              disabled={isBusy}
              style={{ background: 'var(--card)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '9px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: isBusy ? 'default' : 'pointer' }}
            >
              {isBusy ? 'Đang xử lý...' : '🔍 Lưu và kiểm tra'}
            </button>
          </div>

          <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, padding: '12px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
            {status.text}
          </div>
        </div>
      </div>
    </div>
  );
}
