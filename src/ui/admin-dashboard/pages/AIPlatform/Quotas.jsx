import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

const STORAGE_KEY = 'ag_ai_provider_config';

const FIX_SQL_SCRIPT = `-- Copy dòng này dán vào Supabase SQL Editor:
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_read_system_configs" ON public.system_configs;
CREATE POLICY "allow_read_system_configs" ON public.system_configs FOR SELECT USING (true);
DROP POLICY IF EXISTS "allow_write_system_configs" ON public.system_configs;
CREATE POLICY "allow_write_system_configs" ON public.system_configs FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.system_configs TO authenticated, anon, service_role;`;

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
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  
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

  // Key array computed
  const keysList = groqKeysInput
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(Boolean);

  // 1. TẢI DỮ LIỆU BAN ĐẦU & TRUY VẤN XÁC MINH TRỰC TIẾP TỪ DATABASE SUPABASE
  const verifyAndLoadFromDB = async () => {
    setLoading(true);
    let loadedFromCache = false;

    // Tải từ LocalStorage trước để giao diện không bị gián đoạn
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.provider) setAiProvider(parsed.provider);
        if (parsed.model) setSelectedModel(parsed.model);
        if (Array.isArray(parsed.keys) && parsed.keys.length > 0) {
          setGroqKeysInput(parsed.keys.join('\n'));
          loadedFromCache = true;
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc LocalStorage:", e);
    }

    // Đọc trực tiếp từ Supabase Database
    try {
      if (globalThis.SupabaseCloud) {
        const configRes = await globalThis.SupabaseCloud.loadConfig();
        const sess = await AuthSession.getSession();
        const token = sess ? sess.access_token : configRes.anonKey;

        // Fetch Shops
        const shopRes = await fetch(`${configRes.url}/rest/v1/shops?select=id,name`, {
          headers: { 'apikey': configRes.anonKey, 'Authorization': `Bearer ${token}` }
        });
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShops(shopData);
          if (shopData.length > 0 && !selectedShopId) setSelectedShopId(shopData[0].id);
        }

        // Fetch System Configs (groq_api_keys) từ Supabase Database
        const keyRes = await fetch(`${configRes.url}/rest/v1/system_configs?select=value,updated_at&key=eq.groq_api_keys`, {
          headers: { 'apikey': configRes.anonKey, 'Authorization': `Bearer ${token}` }
        });

        if (keyRes.ok) {
          const keyData = await keyRes.json();
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
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: val.provider || 'groq', keys: fetchedKeys, model: val.model || 'llama-3.3-70b-versatile' }));
            }

            setDbStatusInfo({
              synced: true,
              keyCount: fetchedKeys.length,
              lastUpdated: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Vừa xong',
              errorDetails: null
            });
          } else {
            setDbStatusInfo({ synced: false, keyCount: loadedFromCache ? keysList.length : 0, lastUpdated: 'Chưa có bản ghi groq_api_keys trong DB (Vui lòng bấm nút Lưu để tạo)', errorDetails: 'Bảng system_configs chưa có dữ liệu key' });
          }
        } else {
          const errTxt = await keyRes.text();
          setDbStatusInfo({ synced: false, keyCount: loadedFromCache ? keysList.length : 0, lastUpdated: 'Lỗi truy vấn DB', errorDetails: `Supabase HTTP ${keyRes.status}: ${errTxt}` });
        }
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra DB:", err);
      setDbStatusInfo({ synced: false, keyCount: 0, lastUpdated: 'Lỗi kết nối DB', errorDetails: err.message });
    }

    setLoading(false);
  };

  useEffect(() => {
    verifyAndLoadFromDB();
  }, []);

  // 2. TẢI QUOTA SHOP
  useEffect(() => {
    if (!selectedShopId) return;

    const fetchShopQuota = async () => {
      try {
        if (!globalThis.SupabaseCloud) return;
        const configRes = await globalThis.SupabaseCloud.loadConfig();
        const sess = await AuthSession.getSession();
        const token = sess ? sess.access_token : configRes.anonKey;

        const response = await fetch(`${configRes.url}/rest/v1/shop_quotas?select=*&shop_id=eq.${selectedShopId}`, {
          headers: { 'apikey': configRes.anonKey, 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const result = await response.json();
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
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchShopQuota();
  }, [selectedShopId]);

  // 3. ĐỒNG BỘ NGAY LẬP TỨC LÊN SUPABASE DB VÀ ĐỌC LẠI XÁC MINH 100%
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

    // Lưu LocalStorage lập tức để bảo vệ dữ liệu trên máy
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadObj));
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ ai_provider: aiProvider, groq_keys: keysArray, ai_model: selectedModel });
    }

    try {
      if (!globalThis.SupabaseCloud) throw new Error('Không tìm thấy Supabase Connection');
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : configRes.anonKey;

      // GHI TRỰC TIẾP VÀO BẢNG system_configs TRÊN SUPABASE DB
      const dbRes = await fetch(`${configRes.url}/rest/v1/system_configs?on_conflict=key`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          key: 'groq_api_keys',
          value: payloadObj,
          description: `Groq & AI Provider Keys do Master Admin cấu hình`,
          updated_at: new Date().toISOString()
        })
      });

      if (!dbRes.ok) {
        const errText = await dbRes.text();
        setShowSqlGuide(true);
        throw new Error(`Supabase RLS từ chối ghi DB (${dbRes.status}): ${errText}`);
      }

      // TRUY VẤN LẠI NGAY TỪ DATABASE SUPABASE ĐỂ XÁC MINH 100% THÀNH CÔNG
      const verifyRes = await fetch(`${configRes.url}/rest/v1/system_configs?select=value,updated_at&key=eq.groq_api_keys`, {
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!verifyRes.ok) throw new Error('Không thể truy vấn lại dữ liệu vừa lưu từ Supabase DB.');
      const verifyData = await verifyRes.json();

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
    }
  };

  // 4. TEST KẾT NỐI KEY
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

  // 5. LƯU QUOTA SHOP
  const handleSaveQuota = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : configRes.anonKey;

      const response = await fetch(`${configRes.url}/rest/v1/shop_quotas?on_conflict=shop_id`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          shop_id: selectedShopId,
          plan_name: quota.planName,
          ai_quota_limit: quota.dailyQuota,
          ai_quota_used: quota.usedQuota,
          updated_at: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Lỗi lưu dữ liệu');
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
    else setSelectedModel('llama-3.3-70b-versatile');
  };

  const copySqlGuide = () => {
    navigator.clipboard.writeText(FIX_SQL_SCRIPT);
    alert("Đã coppy SQL Script vào bộ nhớ tạm! Mở Supabase SQL Editor và Dán (Ctrl+V) để chạy.");
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
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>⚠️ Hướng dẫn Sửa dứt điểm Lỗi RLS Supabase Database:</div>
          <div>Nếu Supabase từ chối ghi DB, hãy mở <strong>Supabase Dashboard &rarr; SQL Editor</strong>, dán mã bên dưới và nhấn <strong>Run</strong>:</div>
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
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Khuyên dùng)</option>
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
            rows={4}
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

      {/* CARD 2: QUẢN LÝ QUOTA THEO SHOP */}
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
