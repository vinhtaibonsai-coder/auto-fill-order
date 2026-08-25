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
    ok: { bg: '#ecfdf5', border: '#bbf7d0', color: '#047857' },
    warn: { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
    error: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
    idle: { bg: '#f8fafc', border: '#e2e8f0', color: '#334155' }
  }[status.type] || {};

  return (
    <div style={{ maxWidth: compact ? '100%' : '800px' }}>
      {!compact && <h2 className="page-title">Server Connection</h2>}
      <div className="card" style={{ padding: compact ? '20px' : undefined }}>
        <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Máy chủ Supabase</h3>
        <p style={{ color: 'var(--text-muted, #64748b)', marginTop: 0, marginBottom: '18px', fontSize: '13px' }}>
          Cấu hình này được lưu trong Chrome local storage của extension và dùng cho đăng nhập, AI Gateway, đồng bộ Cloud, Options và Admin.
        </p>

        <div style={{ display: 'grid', gap: '14px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            Supabase URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              spellCheck={false}
              style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            Supabase Anon Key
            <textarea
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1Ni..."
              spellCheck={false}
              rows={compact ? 3 : 4}
              style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isBusy}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '8px', fontWeight: 700, cursor: isBusy ? 'default' : 'pointer' }}
            >
              Lưu cấu hình
            </button>
            <button
              type="button"
              onClick={handleSaveAndTest}
              disabled={isBusy}
              style={{ background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: '8px', fontWeight: 700, cursor: isBusy ? 'default' : 'pointer' }}
            >
              {isBusy ? 'Đang xử lý...' : 'Lưu và kiểm tra'}
            </button>
          </div>

          <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, padding: '10px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
            {status.text}
          </div>
        </div>
      </div>
    </div>
  );
}
