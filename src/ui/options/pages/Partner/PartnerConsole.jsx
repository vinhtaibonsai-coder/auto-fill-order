import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, Plus, Shield, Copy, Check, Trash2, RefreshCw, AlertTriangle, 
  Terminal, BarChart3, Clock, CheckCircle2, Lock
} from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { generatePartnerApiKey } from '../../../../application/partner/partner-gateway.service.js';

export default function PartnerConsole() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState(['orders:parse', 'address:normalize']);
  const [monthlyQuota, setMonthlyQuota] = useState(1000);
  const [createdSecret, setCreatedSecret] = useState(null); // Shown strictly ONCE
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      if (!sess?.access_token || !config?.url || !sess.active_shop_id) {
        setKeys([]);
        return;
      }

      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const res = await fetch(
        `${config.url}/rest/v1/partner_api_clients?shop_id=eq.${sess.active_shop_id}&order=created_at.desc`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setKeys(data || []);
      }
    } catch (err) {
      console.error('[PartnerConsole] Load keys error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    setCreating(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`,
        'Content-Type': 'application/json'
      };

      // Generate key pair client-side
      const generated = generatePartnerApiKey();

      const res = await fetch(`${config.url}/rest/v1/rpc/create_partner_api_key`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_shop_id: sess.active_shop_id,
          p_name: keyName.trim(),
          p_key_prefix: generated.prefix,
          p_key_hash: generated.hash,
          p_scopes: selectedScopes,
          p_monthly_quota: monthlyQuota,
          p_expires_at: null
        })
      });

      if (res.ok) {
        setCreatedSecret(generated.rawKey);
        setKeyName('');
        await loadKeys();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Lỗi khi tạo API Key');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (clientId) => {
    if (!confirm('Bạn có chắc chắn muốn vô hiệu hóa API key này? Thao tác này không thể khôi phục.')) return;
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${config.url}/rest/v1/rpc/revoke_partner_api_key`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_client_id: clientId,
          p_shop_id: sess.active_shop_id
        })
      });

      if (res.ok) {
        await loadKeys();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={22} color="#2563eb" />
            Cổng Tích Hợp Partner API & MCP Gateway
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Quản lý khóa API, phân quyền Scope, hạn mức Quota và giao thức MCP cho bên thứ ba
          </p>
        </div>

        <button
          onClick={() => { setShowCreateModal(true); setCreatedSecret(null); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> Tạo API Key mới
        </button>
      </div>

      {/* QUICK DOCUMENTATION BANNER */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={15} color="#2563eb" />
          <span>Endpoint & Giao thức MCP dành cho nhà phát triển:</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginTop: 10, fontSize: 12 }}>
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px' }}>
            <strong>REST API v1:</strong> <code>POST https://api.autofillorder.vn/v1/orders/parse</code>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px' }}>
            <strong>MCP Server:</strong> <code>stdio://mcp/order-tools/server.mjs</code>
          </div>
        </div>
      </div>

      {/* API KEYS TABLE */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: 12 }}>
              <th style={{ padding: '10px 14px' }}>Tên Khóa</th>
              <th style={{ padding: '10px 14px' }}>Tiền Tố (Prefix)</th>
              <th style={{ padding: '10px 14px' }}>Quyền (Scopes)</th>
              <th style={{ padding: '10px 14px' }}>Hạn Ngạch (Tháng)</th>
              <th style={{ padding: '10px 14px' }}>Trạng Thái</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  Chưa có API key nào được khởi tạo.
                </td>
              </tr>
            ) : (
              keys.map(k => (
                <tr key={k.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>{k.name}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748b' }}>{k.key_prefix}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(k.scopes || []).map(s => (
                        <span key={s} style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <strong>{k.monthly_usage || 0}</strong> / {k.monthly_quota}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: k.status === 'ACTIVE' ? '#ecfdf5' : '#fee2e2',
                      color: k.status === 'ACTIVE' ? '#059669' : '#dc2626'
                    }}>
                      {k.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã thu hồi'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    {k.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {createdSecret ? 'Khóa API Đã Được Tạo Thành Công' : 'Tạo Mới API Key'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            {createdSecret ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, fontSize: 12.5, color: '#92400e', lineHeight: 1.4 }}>
                  <AlertTriangle size={15} style={{ marginBottom: 4 }} />
                  <strong>LƯU Ý QUAN TRỌNG:</strong> Đây là lần duy nhất mã khóa bí mật này hiển thị. Hệ thống chỉ lưu mã băm SHA-256 trên cơ sở dữ liệu và không thể khôi phục lại mã này.
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Secret API Key:</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', fontWeight: 700, color: '#0f172a' }}>
                    {createdSecret}
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdSecret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {copiedSecret ? <Check size={16} /> : <Copy size={16} />}
                  {copiedSecret ? 'Đã sao chép vào bộ nhớ tạm' : 'Sao chép khóa bí mật'}
                </button>

                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Tôi đã lưu khóa an toàn, đóng lại
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                    Tên ứng dụng / Đối tác: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: App Chatbot Bán Hàng, CRM Pancake..."
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                    Hạn ngạch hàng tháng (Monthly Quota):
                  </label>
                  <select
                    value={monthlyQuota}
                    onChange={e => setMonthlyQuota(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                  >
                    <option value={1000}>1,000 lượt gọi / tháng</option>
                    <option value={5000}>5,000 lượt gọi / tháng</option>
                    <option value={20000}>20,000 lượt gọi / tháng</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {creating ? 'Đang tạo...' : 'Tạo khóa'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
