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

  // Multi-Provider AI State (Groq, ChatGPT, Gemini)
  const [aiProvider, setAiProvider] = useState('groq'); // 'groq', 'openai', 'gemini'
  const [groqKeysInput, setGroqKeysInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [keySaveStatus, setKeySaveStatus] = useState({ text: '', type: '' });
  const [testingKey, setTestingKey] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Switch default model when provider changes
  const handleProviderChange = (provider) => {
    setAiProvider(provider);
    if (provider === 'openai') setSelectedModel('gpt-4o-mini');
    else if (provider === 'gemini') setSelectedModel('gemini-1.5-flash');
    else setSelectedModel('llama-3.3-70b-versatile');
  };

  // Load Shops & AI Key hiện tại từ DB
  useEffect(() => {
    const fetchData = async () => {
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

        // 1. Fetch Shops
        const response = await fetch(`${configRes.url}/rest/v1/shops?select=id,name`, {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          setShops(result);
          if (result.length > 0) setSelectedShopId(result[0].id);
        }

        // 2. Fetch system_configs (groq_api_keys hoặc ai_provider_config)
        const keyRes = await fetch(`${configRes.url}/rest/v1/system_configs?select=value&key=eq.groq_api_keys`, {
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${token}`
          }
        });

        if (keyRes.ok) {
          const keyData = await keyRes.json();
          if (keyData && keyData.length > 0 && keyData[0].value) {
            const val = keyData[0].value;
            if (val.provider) setAiProvider(val.provider);
            if (Array.isArray(val.keys)) {
              setGroqKeysInput(val.keys.join('\n'));
            } else if (typeof val.keys === 'string') {
              setGroqKeysInput(val.keys);
            }
            if (val.model) setSelectedModel(val.model);
          }
        }
      } catch (err) {
        console.warn('Lỗi khởi tạo:', err);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  // Load Quota của Shop
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
              features: { addressEngine: true, aiParsing: true, autoSync: false }
            });
          } else {
            setQuota({
              shopId: selectedShopId,
              planName: 'FREE',
              dailyQuota: 100,
              usedQuota: 0,
              features: { addressEngine: true, aiParsing: true, autoSync: false }
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

  // Lưu Quota Shop
  const handleSaveQuota = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
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

      if (!response.ok) throw new Error('Lỗi khi lưu dữ liệu');
      setMessage({ text: 'Lưu thông tin hạn mức thành công!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Lỗi: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // Lưu AI Provider Keys (Groq / OpenAI / Gemini) lên Supabase DB
  const handleSaveAIKeys = async () => {
    setKeySaveStatus({ text: 'Đang đồng bộ DB...', type: 'info' });
    const keysArray = groqKeysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);

    if (keysArray.length === 0) {
      setKeySaveStatus({ text: `Vui lòng nhập ít nhất 1 API Key cho ${aiProvider.toUpperCase()}!`, type: 'error' });
      return;
    }

    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : configRes.anonKey;

      const payload = {
        key: 'groq_api_keys',
        value: { provider: aiProvider, keys: keysArray, model: selectedModel },
        description: `API Keys (${aiProvider.toUpperCase()}) do Master Admin cấu hình`,
        updated_at: new Date().toISOString()
      };

      await fetch(`${configRes.url}/rest/v1/system_configs?on_conflict=key`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });

      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.set({ ai_provider: aiProvider, groq_keys: keysArray, ai_model: selectedModel });
      }

      setKeySaveStatus({ text: `✅ Đã chuyển đổi AI sang [${aiProvider.toUpperCase()}] và lưu ${keysArray.length} Keys lên Database!`, type: 'success' });
      setTimeout(() => setKeySaveStatus({ text: '', type: '' }), 4000);
    } catch (e) {
      setKeySaveStatus({ text: 'Lỗi đồng bộ DB: ' + e.message, type: 'error' });
    }
  };

  // Thử kết nối API Key trực tiếp theo từng Provider (Groq / OpenAI ChatGPT / Google Gemini)
  const handleTestConnection = async () => {
    setTestingKey(true);
    setKeySaveStatus({ text: `⏳ Đang thử kết nối tới ${aiProvider.toUpperCase()}...`, type: 'info' });
    const keysArray = groqKeysInput.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    const testKey = keysArray[0];

    if (!testKey) {
      setKeySaveStatus({ text: 'Vui lòng nhập API Key để thử nghiệm!', type: 'error' });
      setTestingKey(false);
      return;
    }

    try {
      let res;
      if (aiProvider === 'openai') {
        // OpenAI ChatGPT API test
        res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Ping test' }],
            max_tokens: 5
          })
        });
      } else if (aiProvider === 'gemini') {
        // Google Gemini API test
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel || 'gemini-1.5-flash'}:generateContent?key=${testKey}`;
        res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping test' }] }]
          })
        });
      } else {
        // Groq API test
        res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${testKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Ping test' }],
            max_tokens: 5
          })
        });
      }

      if (res.ok) {
        setKeySaveStatus({ text: `🟢 Kết nối ${aiProvider.toUpperCase()} (${selectedModel}) THÀNH CÔNG! Key hoạt động bình thường.`, type: 'success' });
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${res.status}`;
        setKeySaveStatus({ text: `🔴 Lỗi kết nối ${aiProvider.toUpperCase()} (${res.status}): ${errMsg}`, type: 'error' });
      }
    } catch (e) {
      setKeySaveStatus({ text: `🔴 Lỗi mạng khi kết nối ${aiProvider.toUpperCase()}: ` + e.message, type: 'error' });
    }
    setTestingKey(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 className="page-title" style={{ margin: 0 }}>🤖 Multi-Provider AI Platform (Groq / ChatGPT / Gemini)</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* CARD 1: CẤU HÌNH NHÀ CUNG CẤP AI (GROQ / OPENAI CHATGPT / GOOGLE GEMINI) */}
        <div className="card" style={{ borderTop: '4px solid #2563eb' }}>
          <h3 style={{ marginTop: 0, color: '#2563eb' }}>🤖 Chọn Nhà Cung Cấp AI (AI Provider)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
            Lựa chọn Engine AI để bóc tách đơn hàng. Hỗ trợ <strong>Groq AI</strong>, <strong>OpenAI ChatGPT</strong> và <strong>Google Gemini</strong>.
          </p>

          {keySaveStatus.text && (
            <div style={{
              padding: '10px 12px', marginBottom: '14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
              background: keySaveStatus.type === 'error' ? '#fee2e2' : keySaveStatus.type === 'success' ? '#dcfce7' : '#eff6ff',
              color: keySaveStatus.type === 'error' ? '#991b1b' : keySaveStatus.type === 'success' ? '#15803d' : '#1d4ed8',
              border: `1px solid ${keySaveStatus.type === 'error' ? '#fca5a5' : keySaveStatus.type === 'success' ? '#86efac' : '#bfdbfe'}`
            }}>
              {keySaveStatus.text}
            </div>
          )}

          {/* Selector chọn Provider */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 600 }}>
              Nhà cung cấp AI Engine:
            </label>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #2563eb', fontWeight: 700, fontSize: '13px' }}
            >
              <option value="groq">⚡ Groq AI (Llama-3.3-70b — Siêu tốc, Miễn phí)</option>
              <option value="openai">🟢 OpenAI ChatGPT (GPT-4o-mini / GPT-4o — Độ chính xác cao)</option>
              <option value="gemini">🔵 Google Gemini AI (Gemini 1.5/2.0 Flash — Bóc tách ảnh/bill mạnh)</option>
            </select>
          </div>

          {/* Selector chọn Model theo Provider */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 600 }}>
              Mô hình Model cho {aiProvider.toUpperCase()}:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            >
              {aiProvider === 'openai' && (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini (Khuyên dùng - Nhanh & Rẻ)</option>
                  <option value="gpt-4o">gpt-4o (Thông minh nhất)</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </>
              )}
              {aiProvider === 'gemini' && (
                <>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Khuyên dùng - Siêu nhanh)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Thế hệ mới)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Chính xác cao)</option>
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

          {/* Textarea nhập Keys */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 600 }}>
              Danh sách API Key {aiProvider.toUpperCase()} (Mỗi key một dòng):
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
                width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSaveAIKeys}
              style={{
                flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer'
              }}
            >
              💾 Lưu & Chuyển AI ({aiProvider.toUpperCase()})
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testingKey}
              style={{
                padding: '10px 14px', background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: testingKey ? 'not-allowed' : 'pointer'
              }}
            >
              🧪 Thử kết nối
            </button>
          </div>
        </div>

        {/* CARD 2: EDIT QUOTA THEO SHOP */}
        <div className="card" style={{ borderTop: '4px solid #16a34a', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '12px' }}>
              <span>Đang tải dữ liệu...</span>
            </div>
          )}

          <h3 style={{ marginTop: 0, color: '#16a34a' }}>📊 Quản lý Quota theo Shop</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            Thiết lập giới hạn số lượt bóc tách AI cho từng Cửa hàng.
          </p>

          {message.text && (
            <div style={{ padding: '10px 12px', marginBottom: '14px', borderRadius: '6px', fontSize: '12px', background: message.type === 'error' ? '#fee2e2' : '#dcfce7', color: message.type === 'error' ? '#991b1b' : '#15803d' }}>
              {message.text}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Chọn Cửa hàng (Shop)</label>
            <select 
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
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

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Gói cước (Plan)</label>
            <select 
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              value={quota.planName}
              onChange={(e) => setQuota({ ...quota, planName: e.target.value })}
            >
              <option value="FREE">FREE (100 lượt)</option>
              <option value="STARTER">STARTER (1.000 lượt)</option>
              <option value="PRO">PRO (5.000 lượt)</option>
              <option value="BUSINESS">BUSINESS (20.000 lượt)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#16a34a', marginBottom: '4px', fontWeight: 600 }}>Tổng Hạn Mức AI (Tháng)</label>
              <input 
                type="number" 
                value={quota.dailyQuota}
                onChange={(e) => setQuota({ ...quota, dailyQuota: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', boxSizing: 'border-box' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#be123c', marginBottom: '4px', fontWeight: 600 }}>Lượt Đã Dùng</label>
              <input 
                type="number" 
                value={quota.usedQuota}
                onChange={(e) => setQuota({ ...quota, usedQuota: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', boxSizing: 'border-box' }} 
              />
            </div>
          </div>

          <button 
            onClick={handleSaveQuota}
            disabled={saving || !selectedShopId}
            style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: (saving || !selectedShopId) ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Đang lưu...' : 'Lưu Quota Shop'}
          </button>
        </div>
      </div>
    </div>
  );
}
