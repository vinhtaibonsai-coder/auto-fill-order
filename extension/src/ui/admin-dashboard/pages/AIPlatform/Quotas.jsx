import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { SystemConfigRepository, ShopQuotaRepository } from '../../../../domain/admin/admin.config.repository.js';
import { AdminRepository } from '../../../../domain/admin/admin.repository.js';

const STORAGE_KEY = 'ag_ai_provider_config';

const FIX_SQL_SCRIPT = `-- Nếu bị từ chối (ACCESS_DENIED / 401 / 403):
-- 1. Chạy database/migrations/v34_harden_system_configs.sql trong Supabase SQL Editor.
-- 2. Đảm bảo tài khoản đang đăng nhập có vai trò SYSTEM_ADMIN:
SELECT r.code FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = auth.uid();
-- KHÔNG mở policy USING(true) hay GRANT ALL cho anon/authenticated trên
-- system_configs — bảng này chứa API key của nhà cung cấp AI.`;

export default function Quotas() {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  
  const [quota, setQuota] = useState({
    shopId: '',
    planName: 'FREE',
    dailyQuota: 100,
    usedQuota: 0
  });

  // AI Configuration State
  const [aiProvider, setAiProvider] = useState('groq');
  const [groqKeysInput, setGroqKeysInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('llama-3.1-8b-instant');
  
  // Database Live Verification State
  const [dbStatusInfo, setDbStatusInfo] = useState({
    synced: false,
    keyCount: 0,
    lastUpdated: 'Chưa kiểm tra',
    errorDetails: null
  });

  const [keySaveStatus, setKeySaveStatus] = useState({ text: '', type: '' });
  const [testingKey, setTestingKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Default Custom Prompt Rules State
  const [defaultPromptRules, setDefaultPromptRules] = useState('');
  const [defaultPromptRulesSaveStatus, setDefaultPromptRulesSaveStatus] = useState({ text: '', type: '' });
  const [defaultPromptRulesSaving, setDefaultPromptRulesSaving] = useState(false);

  const keysList = groqKeysInput
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(Boolean);

  const verifyAndLoadFromDB = async () => {
    setLoading(true);

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.provider) setAiProvider(parsed.provider);
        if (parsed.model) setSelectedModel(parsed.model);
      }
    } catch (e) {
      console.warn("Lỗi đọc LocalStorage:", e);
    }

    try {
      if (globalThis.SupabaseCloud) {
        const shopData = await AdminRepository.getShops().catch(() => []);
        setShops(shopData);
        if (shopData.length > 0 && !selectedShopId) setSelectedShopId(shopData[0].id);

        const keyData = await SystemConfigRepository.getSystemConfig('groq_api_keys');

        if (keyData && keyData.length > 0 && keyData[0].value) {
          const val = keyData[0].value;
          const lastUpdate = keyData[0].updated_at;

          if (val.provider) setAiProvider(val.provider);
          if (val.model) setSelectedModel(val.model);

          let fetchedKeys = [];
          if (Array.isArray(val.keys)) fetchedKeys = val.keys;
          else if (typeof val.keys === 'string') fetchedKeys = [val.keys];

          if (fetchedKeys.length > 0) {
            setGroqKeysInput(fetchedKeys.join('\n'));
          }
          // KHÔNG cache key nhà cung cấp xuống localStorage/chrome.storage —
          // chỉ giữ provider/model để UI hiển thị lại nhanh.
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: val.provider || 'groq', model: val.model || 'llama-3.3-70b-versatile' }));

          setDbStatusInfo({
            synced: true,
            keyCount: fetchedKeys.length,
            lastUpdated: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Vừa xong',
            errorDetails: null
          });
        } else {
          setDbStatusInfo({ synced: false, keyCount: 0, lastUpdated: 'Chưa có bản ghi groq_api_keys trong DB (Vui lòng bấm nút Lưu để tạo)', errorDetails: 'Bảng system_configs chưa có dữ liệu key' });
        }

        const promptData = await SystemConfigRepository.getSystemConfig('default_custom_prompt_rules').catch(() => null);
        if (promptData && promptData.length > 0 && promptData[0].value) {
          const valObj = promptData[0].value;
          if (typeof valObj === 'object' && valObj !== null) {
            setDefaultPromptRules(valObj.rules || valObj.value || JSON.stringify(valObj));
          } else {
            setDefaultPromptRules(String(valObj));
          }
        } else {
          setDefaultPromptRules('');
        }
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra DB:", err);
      setDbStatusInfo({ synced: false, keyCount: 0, lastUpdated: 'Lỗi kết nối DB', errorDetails: err.message });
      if (err.message.includes('401') || err.message.includes('403') || err.message.includes('ACCESS_DENIED') || err.message.includes('RLS')) setShowSqlGuide(true);
    }

    setLoading(false);
  };

  useEffect(() => {
    verifyAndLoadFromDB();
  }, []);

  useEffect(() => {
    if (!selectedShopId) return;

    const fetchShopQuota = async () => {
      try {
        if (!globalThis.SupabaseCloud) return;
        const result = await ShopQuotaRepository.getShopQuota(selectedShopId);

        if (result && result.length > 0) {
          const q = result[0];
          setQuota({
            shopId: q.shop_id,
            planName: q.plan_name || 'FREE',
            dailyQuota: q.ai_quota_limit || 100,
            usedQuota: q.ai_quota_used || 0
          });
        } else {
          setQuota({ shopId: selectedShopId, planName: 'FREE', dailyQuota: 100, usedQuota: 0 });
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchShopQuota();
  }, [selectedShopId]);

  const handleSaveAIKeys = async () => {
    setKeySaveStatus({ text: '⏳ Đang đồng bộ vào Supabase Database...', type: 'info' });
    const keysArray = keysList;

    if (keysArray.length === 0) {
      setKeySaveStatus({ text: `Vui lòng nhập ít nhất 1 API Key!`, type: 'error' });
      return;
    }

    const payloadObj = {
      provider: aiProvider,
      keys: keysArray,
      model: selectedModel
    };

    // Chỉ cache provider/model — KHÔNG lưu API key ra localStorage/chrome.storage.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: aiProvider, model: selectedModel }));

    try {
      if (!globalThis.SupabaseCloud) throw new Error('Không tìm thấy Supabase Connection');
      
      await SystemConfigRepository.upsertSystemConfig('groq_api_keys', payloadObj, 'Groq & AI Provider Keys do Master Admin cấu hình');
      
      await AdminRepository.insertAuditLog('ADMIN_UPDATE_AI_KEYS', 'groq_api_keys', 'config', null, { keyCount: keysArray.length, provider: aiProvider });

      const verifyData = await SystemConfigRepository.getSystemConfig('groq_api_keys');

      if (verifyData && verifyData.length > 0 && verifyData[0].value) {
        const savedCount = verifyData[0].value.keys?.length || 0;
        const lastUpdate = verifyData[0].updated_at || new Date().toISOString();

        setDbStatusInfo({
          synced: true,
          keyCount: savedCount,
          lastUpdated: new Date(lastUpdate).toLocaleTimeString(),
          errorDetails: null
        });

        setShowSqlGuide(false);
        setKeySaveStatus({
          text: `🟢 ĐÃ ĐỒNG BỘ DATABASE SUPABASE THÀNH CÔNG 100%! (Đã đọc lại xác minh DB có ${savedCount} Keys lúc ${new Date(lastUpdate).toLocaleTimeString()})`,
          type: 'success'
        });
      } else {
        throw new Error('Database chưa lưu thành công bản ghi.');
      }
    } catch (e) {
      setDbStatusInfo({ synced: false, keyCount: keysArray.length, lastUpdated: 'Thất bại DB', errorDetails: e.message });
      setKeySaveStatus({ text: `🔴 LỖI ĐỒNG BỘ SUPABASE DATABASE: ${e.message}`, type: 'error' });
      if (e.message.includes('RLS') || e.message.includes('401') || e.message.includes('403') || e.message.includes('ACCESS_DENIED')) setShowSqlGuide(true);
    }
  };

  const handleTestConnection = async () => {
    setTestingKey(true);
    setKeySaveStatus({ text: `⏳ Đang kiểm tra kết nối API Key...`, type: 'info' });
    const testKey = keysList[0];

    if (!testKey) {
      setKeySaveStatus({ text: 'Vui lòng nhập API Key để kiểm tra!', type: 'error' });
      setTestingKey(false);
      return;
    }

    try {
      let res;
      if (aiProvider === 'openai') {
        res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${testKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedModel || 'gpt-4o-mini', messages: [{ role: 'user', content: 'Ping' }], max_tokens: 5 })
        });
      } else if (aiProvider === 'gemini') {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel || 'gemini-1.5-flash'}:generateContent?key=${testKey}`;
        res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] })
        });
      } else {
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${testKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedModel || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Ping' }], max_tokens: 5 })
        });
      }

      if (res.ok) {
        setKeySaveStatus({ text: `🟢 Kiểm tra THÀNH CÔNG! API Key (${aiProvider.toUpperCase()}) hoạt động bình thường.`, type: 'success' });
      } else {
        const errJson = await res.json().catch(() => ({}));
        setKeySaveStatus({ text: `🔴 Key lỗi (${res.status}): ${errJson.error?.message || 'Không thể kết nối API'}`, type: 'error' });
      }
    } catch (e) {
      setKeySaveStatus({ text: `🔴 Lỗi mạng: ` + e.message, type: 'error' });
    }
    setTestingKey(false);
  };

  const handleRemoveSingleKey = (indexToRemove) => {
    const updatedList = keysList.filter((_, idx) => idx !== indexToRemove);
    setGroqKeysInput(updatedList.join('\n'));
  };

  const handleSaveQuota = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await ShopQuotaRepository.upsertShopQuota(selectedShopId, quota.planName, quota.dailyQuota, quota.usedQuota);
      await AdminRepository.insertAuditLog('ADMIN_UPDATE_SHOP_QUOTA', selectedShopId, 'shop', null, { planName: quota.planName, dailyQuota: quota.dailyQuota });

      setMessage({ text: 'Lưu Quota Shop thành công!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Lỗi: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  const handleProviderSelect = (provider) => {
    setAiProvider(provider);
    if (provider === 'openai') setSelectedModel('gpt-4o-mini');
    else if (provider === 'gemini') setSelectedModel('gemini-1.5-flash');
    else setSelectedModel('llama-3.1-8b-instant');
  };

  const copySqlGuide = () => {
    navigator.clipboard.writeText(FIX_SQL_SCRIPT);
    alert("Đã copy hướng dẫn kiểm tra quyền vào bộ nhớ tạm! Mở Supabase SQL Editor và Dán (Ctrl+V).");
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
            ⚙️ Cấu Hình AI Engine & Quản Lý Quotas
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Đồng bộ ngay tức thì giữa LocalStorage và Supabase Database kèm xác minh kết quả ghi DB.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={verifyAndLoadFromDB}
            style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
          >
            🔍 Verify DB Now
          </button>
        </div>
      </div>

      {/* KHỐI HIỂN THỊ TRẠNG THÁI ĐỒNG BỘ DATABASE LIVE */}
      <div style={{
        background: dbStatusInfo.synced ? '#f0fdf4' : '#fff1f2',
        border: `1px solid ${dbStatusInfo.synced ? '#bbf7d0' : '#fecdd3'}`,
        borderRadius: '8px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '20px' }}>{dbStatusInfo.synced ? '🟢' : '🔴'}</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: dbStatusInfo.synced ? '#166534' : '#991b1b' }}>
              TRẠNG THÁI SUPABASE DATABASE: {dbStatusInfo.synced ? 'ĐÃ ĐỒNG BỘ 100%' : 'CHƯA ĐỒNG BỘ DB'}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
              Bảng <code>system_configs</code> | Số Keys trong DB: <strong>{dbStatusInfo.keyCount} Keys</strong> | Cập nhật lần cuối: <strong>{dbStatusInfo.lastUpdated}</strong>
            </div>
            {dbStatusInfo.errorDetails && (
              <div style={{ fontSize: '11px', color: '#be123c', marginTop: '4px', fontFamily: 'monospace' }}>
                Chi tiết: {dbStatusInfo.errorDetails}
              </div>
            )}
          </div>
        </div>

        {!dbStatusInfo.synced && (
          <button
            onClick={copySqlGuide}
            style={{ background: '#be123c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            📋 Copy SQL Fix Quyền DB
          </button>
        )}

        {dbStatusInfo.synced && (
          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
            VERIFIED IN DB
          </span>
        )}
      </div>

      {showSqlGuide && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px', fontSize: '12px', color: '#92400e' }}>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>⚠️ Bị từ chối truy cập cấu hình hệ thống:</div>
          <div>Bảng <strong>system_configs</strong> chỉ cho phép SYSTEM_ADMIN thao tác qua RPC. Kiểm tra theo hướng dẫn bên dưới trong <strong>Supabase Dashboard &rarr; SQL Editor</strong>:</div>
          <pre style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', fontSize: '11px', overflowX: 'auto', margin: '8px 0' }}>
            {FIX_SQL_SCRIPT}
          </pre>
          <button onClick={copySqlGuide} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
            📋 Copy Mã SQL Trên
          </button>
        </div>
      )}

      {/* CARD 1: CẤU HÌNH AI PROVIDER & API KEYS */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#0f172a' }}>
          1. Nhà Cung Cấp AI Engine & API Keys
        </h3>

        {keySaveStatus.text && (
          <div style={{
            padding: '10px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            background: keySaveStatus.type === 'error' ? '#fee2e2' : keySaveStatus.type === 'success' ? '#dcfce7' : '#f1f5f9',
            color: keySaveStatus.type === 'error' ? '#991b1b' : keySaveStatus.type === 'success' ? '#166534' : '#334155',
            border: `1px solid ${keySaveStatus.type === 'error' ? '#fca5a5' : keySaveStatus.type === 'success' ? '#86efac' : '#cbd5e1'}`
          }}>
            {keySaveStatus.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Chọn Engine AI:
            </label>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderSelect(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', color: '#0f172a', fontWeight: 600 }}
            >
              <option value="groq">⚡ Groq AI (Llama 3.3 - Nhanh & Miễn phí)</option>
              <option value="openai">🟢 OpenAI ChatGPT (GPT-4o-mini - Chính xác)</option>
              <option value="gemini">🔵 Google Gemini AI (Gemini 1.5 - Tốc độ cao)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Chọn Mô hình (Model):
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', color: '#0f172a' }}
            >
              {aiProvider === 'openai' && (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini (Khuyên dùng)</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </>
              )}
              {aiProvider === 'gemini' && (
                <>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Khuyên dùng)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </>
              )}
              {aiProvider === 'groq' && (
                <>
                  <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Siêu Nhanh - Khuyên dùng)</option>
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Chính xác hơn - Chậm hơn)</option>
                  <option value="llama3-8b-8192">llama3-8b-8192</option>
                  <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            API Keys ({aiProvider.toUpperCase()}) — Nhập mỗi key một dòng:
          </label>
          <textarea
            rows={3}
            value={groqKeysInput}
            onChange={(e) => setGroqKeysInput(e.target.value)}
            placeholder={
              aiProvider === 'openai' ? "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx" :
              aiProvider === 'gemini' ? "AIzaSyxxxxxxxxxxxxxxxxxxxxxxx" :
              "gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx"
            }
            style={{
              width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1',
              fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box', background: '#f8fafc'
            }}
          />
        </div>

        {/* BẢNG HIỂN THỊ DANH SÁCH KEYS ĐÃ NẠP TRONG DATABASE (KEY INSPECTOR TABLE) */}
        {keysList.length > 0 && (
          <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: '12px', fontWeight: 700, color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📋 BẢNG DÀN KEYS ĐANG HOẠT ĐỘNG TRONG DATABASE ({keysList.length} Keys)</span>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>🟢 VERIFIED IN DB</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px 12px' }}>#</th>
                  <th style={{ padding: '8px 12px' }}>Masked API Key</th>
                  <th style={{ padding: '8px 12px' }}>Engine AI</th>
                  <th style={{ padding: '8px 12px' }}>Model Active</th>
                  <th style={{ padding: '8px 12px' }}>Trạng Thái DB</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {keysList.map((k, idx) => {
                  const masked = k.length > 12 ? `${k.substring(0, 8)}...${k.substring(k.length - 4)}` : k;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#64748b' }}>#{idx + 1}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>{masked}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#2563eb' }}>{aiProvider.toUpperCase()}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{selectedModel}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                          🟢 LIVE IN DB
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRemoveSingleKey(idx)}
                          style={{ background: '#fee2e2', color: '#be123c', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                        >
                          🗑️ Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSaveAIKeys}
            style={{
              padding: '10px 20px', background: '#2563eb', color: '#ffffff', border: 'none',
              borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
            }}
          >
            💾 Lưu & Đồng Bộ DATABASE
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testingKey}
            style={{
              padding: '10px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1',
              borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: testingKey ? 'not-allowed' : 'pointer'
            }}
          >
            🧪 Kiểm Tra Kết Nối
          </button>
        </div>
      </div>

      {/* CARD 1.5: CẤU HÌNH LUẬT PROMPT AI DÙNG CHUNG MẶC ĐỊNH */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#0f172a' }}>
          2. Cấu Hìn Luật AI Dùng Chung Mặc Định
        </h3>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
          Nhập các quy tắc bóc tách AI tùy chỉnh dùng chung mặc định cho toàn hệ thống. Nếu một Shop không cấu hình luật riêng, hệ thống sẽ sử dụng luật mặc định này.
        </p>

        {defaultPromptRulesSaveStatus.text && (
          <div style={{
            padding: '10px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            background: defaultPromptRulesSaveStatus.type === 'error' ? '#fee2e2' : defaultPromptRulesSaveStatus.type === 'success' ? '#dcfce7' : '#f1f5f9',
            color: defaultPromptRulesSaveStatus.type === 'error' ? '#991b1b' : defaultPromptRulesSaveStatus.type === 'success' ? '#166534' : '#334155',
            border: `1px solid ${defaultPromptRulesSaveStatus.type === 'error' ? '#fca5a5' : defaultPromptRulesSaveStatus.type === 'success' ? '#86efac' : '#cbd5e1'}`
          }}>
            {defaultPromptRulesSaveStatus.text}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <textarea
            rows={4}
            value={defaultPromptRules}
            onChange={(e) => setDefaultPromptRules(e.target.value)}
            placeholder="Ví dụ: 'Luôn lấy tiền thu hộ là 0 nếu khách hàng đã thanh toán trước', 'Nếu không có tên khách hàng, hãy điền tên người gửi là Nguyễn Văn A'..."
            style={{
              width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1',
              fontSize: '13px', boxSizing: 'border-box', background: '#f8fafc', resize: 'vertical', minHeight: '100px'
            }}
          />
        </div>

        <button
          onClick={async () => {
            setDefaultPromptRulesSaving(true);
            setDefaultPromptRulesSaveStatus({ text: '⏳ Đang lưu cấu hình prompt dùng chung...', type: 'info' });
            try {
              if (!globalThis.SupabaseCloud) throw new Error('Không tìm thấy Supabase Connection');
              const payloadObj = { rules: defaultPromptRules };
              await SystemConfigRepository.upsertSystemConfig('default_custom_prompt_rules', payloadObj, 'Luật Prompt AI mặc định của hệ thống do Master Admin cấu hình');
              await AdminRepository.insertAuditLog('ADMIN_UPDATE_DEFAULT_PROMPT_RULES', 'default_custom_prompt_rules', 'config', null, { hasRules: !!defaultPromptRules });
              setDefaultPromptRulesSaveStatus({ text: '🟢 Đã lưu cấu hình prompt dùng chung mặc định thành công!', type: 'success' });
              setTimeout(() => setDefaultPromptRulesSaveStatus({ text: '', type: '' }), 3000);
            } catch (e) {
              setDefaultPromptRulesSaveStatus({ text: `🔴 Lỗi khi lưu: ${e.message}`, type: 'error' });
            }
            setDefaultPromptRulesSaving(false);
          }}
          disabled={defaultPromptRulesSaving}
          style={{
            padding: '9px 18px', background: '#2563eb', color: '#ffffff', border: 'none',
            borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: defaultPromptRulesSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {defaultPromptRulesSaving ? 'Đang lưu...' : '💾 Lưu Luật Prompt Mặc Định'}
        </button>
      </div>

      {/* CARD 3: QUẢN LÝ QUOTA THEO SHOP */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginTop: 0, marginBottom: '16px', color: '#0f172a' }}>
          2. Quản Lý Hạn Mức Quota Shop
        </h3>

        {message.text && (
          <div style={{ padding: '10px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '13px', background: message.type === 'error' ? '#fee2e2' : '#dcfce7', color: message.type === 'error' ? '#991b1b' : '#166534' }}>
            {message.text}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Chọn Cửa Hàng:
          </label>
          <select
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', color: '#0f172a', fontWeight: 500 }}
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
          >
            {shops.length === 0 ? (
              <option value="">Chưa có cửa hàng nào trong hệ thống</option>
            ) : (
              shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Gói Cước (Plan)</label>
            <select
              value={quota.planName}
              onChange={(e) => setQuota({ ...quota, planName: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
            >
              <option value="FREE">Miễn Phí (FREE)</option>
              <option value="STARTER">Cơ Bản (STARTER)</option>
              <option value="PRO">Chuyên Nghiệp (PRO)</option>
              <option value="BUSINESS">Doanh Nghiệp (BUSINESS)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#16a34a', marginBottom: '4px' }}>Hạn Mức AI (Lượt/Tháng)</label>
            <input
              type="number"
              value={quota.dailyQuota}
              onChange={(e) => setQuota({ ...quota, dailyQuota: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>Đã Sử Dụng</label>
            <input
              type="number"
              value={quota.usedQuota}
              onChange={(e) => setQuota({ ...quota, usedQuota: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          onClick={handleSaveQuota}
          disabled={saving || !selectedShopId}
          style={{ padding: '9px 18px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: (saving || !selectedShopId) ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Đang lưu...' : '💾 Lưu Quota Shop'}
        </button>
      </div>
    </div>
  );
}
