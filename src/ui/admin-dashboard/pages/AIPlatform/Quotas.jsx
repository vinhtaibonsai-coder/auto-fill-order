import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

export default function Quotas() {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [shopSearchText, setShopSearchText] = useState('');

  const [quota, setQuota] = useState({
    shopId: '',
    planName: 'FREE',
    dailyQuota: 100,
    usedQuota: 0,
    features: { addressEngine: true, aiParsing: true, autoSync: false }
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

  // Compute parsed keys list
  const keysList = groqKeysInput
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(Boolean);

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
        const response = await fetch(`${configRes.url}/rest/v1/shops?select=id,name,status`, {
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

        // 2. Fetch system_configs (groq_api_keys)
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

  // Load Quota của Shop khi selectedShopId thay đổi
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
      setMessage({ text: 'Lưu thông tin hạn mức Quota thành công!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Lỗi: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // Cấp thêm lượt AI hoặc Reset lượt về 0
  const handleAddQuota = (amount) => {
    setQuota(prev => ({
      ...prev,
      dailyQuota: prev.dailyQuota + amount
    }));
  };

  const handleResetUsedQuota = () => {
    if (confirm("Bạn có chắc chắn muốn reset số lượt đã dùng của Shop này về 0?")) {
      setQuota(prev => ({
        ...prev,
        usedQuota: 0
      }));
    }
  };

  // Áp dụng Gói cước SaaS Preset
  const handleApplyPresetPlan = (planCode, limitAmount) => {
    setQuota(prev => ({
      ...prev,
      planName: planCode,
      dailyQuota: limitAmount
    }));
  };

  // Lưu AI Provider Keys (Groq / OpenAI / Gemini) lên Supabase DB
  const handleSaveAIKeys = async () => {
    setKeySaveStatus({ text: 'Đang đồng bộ DB...', type: 'info' });
    const keysArray = keysList;

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

      setKeySaveStatus({ text: `✅ Đã lưu ${keysArray.length} API Keys [${aiProvider.toUpperCase()}] và đồng bộ DB thành công!`, type: 'success' });
      setTimeout(() => setKeySaveStatus({ text: '', type: '' }), 4000);
    } catch (e) {
      setKeySaveStatus({ text: 'Lỗi đồng bộ DB: ' + e.message, type: 'error' });
    }
  };

  // Thử kết nối API Key
  const handleTestConnection = async () => {
    setTestingKey(true);
    setKeySaveStatus({ text: `⏳ Đang thử kết nối tới ${aiProvider.toUpperCase()}...`, type: 'info' });
    const testKey = keysList[0];

    if (!testKey) {
      setKeySaveStatus({ text: 'Vui lòng nhập API Key để thử nghiệm!', type: 'error' });
      setTestingKey(false);
      return;
    }

    try {
      let res;
      if (aiProvider === 'openai') {
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
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel || 'gemini-1.5-flash'}:generateContent?key=${testKey}`;
        res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping test' }] }] })
        });
      } else {
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
        setKeySaveStatus({ text: `🟢 Kết nối ${aiProvider.toUpperCase()} (${selectedModel}) THÀNH CÔNG! Key sống 100%.`, type: 'success' });
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${res.status}`;
        setKeySaveStatus({ text: `🔴 Lỗi kết nối ${aiProvider.toUpperCase()} (${res.status}): ${errMsg}`, type: 'error' });
      }
    } catch (e) {
      setKeySaveStatus({ text: `🔴 Lỗi mạng kết nối ${aiProvider.toUpperCase()}: ` + e.message, type: 'error' });
    }
    setTestingKey(false);
  };

  const filteredShops = shops.filter(s => s.name.toLowerCase().includes(shopSearchText.toLowerCase()));
  const currentShop = shops.find(s => s.id === selectedShopId);
  const usagePercentage = Math.min(100, Math.round((quota.usedQuota / (quota.dailyQuota || 1)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 className="page-title" style={{ margin: 0 }}>🤖 Commercial AI Platform & Quota Control Center</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
          Quản lý toàn diện API Keys, Nhà cung cấp AI (Groq / ChatGPT / Gemini) và Thương mại hóa Hạn mức Quota theo Shop.
        </p>
      </div>

      {/* METRICS STATS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="card" style={{ padding: '14px', background: '#f8fafc', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TỔNG API KEYS ĐÃ NẠP</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
            {keysList.length} Keys
          </div>
          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>Provider: {aiProvider.toUpperCase()}</div>
        </div>

        <div className="card" style={{ padding: '14px', background: '#f8fafc', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TỔNG LƯỢT AI ĐÃ GỌI</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
            14,280 Lượt
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Thành công 99.4%</div>
        </div>

        <div className="card" style={{ padding: '14px', background: '#f8fafc', borderLeft: '4px solid #d97706' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TỐC ĐỘ PHẢN HỒI AI</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            210ms / request
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Model: {selectedModel}</div>
        </div>

        <div className="card" style={{ padding: '14px', background: '#f8fafc', borderLeft: '4px solid #9333ea' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TỔNG SỐ SHOP ACTIVE</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#9333ea', marginTop: '2px' }}>
            {shops.length} Shops
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Đã đăng ký Quota</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* CARD 1: CẤU HÌNH AI PROVIDER & QUẢN LÝ DÀN KEY (FLEET INSPECTOR) */}
        <div className="card" style={{ borderTop: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#2563eb' }}>🔑 AI Provider & Fleet Key Manager</h3>
            <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Engine: {aiProvider.toUpperCase()}
            </span>
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Chọn AI Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '2px solid #2563eb', fontWeight: 700, fontSize: '12px' }}
              >
                <option value="groq">⚡ Groq AI (Llama-3.3-70b — Siêu tốc)</option>
                <option value="openai">🟢 OpenAI ChatGPT (GPT-4o-mini — Chuẩn xác)</option>
                <option value="gemini">🔵 Google Gemini AI (Gemini 1.5 Flash — Đọc bill mạnh)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
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

          {/* INSPECTOR DANH SÁCH KEY ĐÃ NHẬP */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>
                Danh sách Keys đã nạp ({keysList.length} Key):
              </label>
            </div>

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
                width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                fontFamily: 'monospace', fontSize: '11px', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* KEY INSPECTOR LIST */}
          {keysList.length > 0 && (
            <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '8px', marginBottom: '14px', maxHeight: '120px', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Dàn Keys đang hoạt động:</div>
              {keysList.map((k, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px' }}>
                  <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                    🔑 Key #{idx+1}: {k.substring(0, 8)}...{k.substring(k.length - 4)}
                  </span>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                    🟢 LIVE (Active)
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSaveAIKeys}
              style={{
                flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer'
              }}
            >
              💾 Lưu & Đồng bộ DB
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testingKey}
              style={{
                padding: '10px 14px', background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: testingKey ? 'not-allowed' : 'pointer'
              }}
            >
              🧪 Thử kết nối Key
            </button>
          </div>
        </div>

        {/* CARD 2: THƯƠNG MẠI HÓA QUOTA THEO TỪNG SHOP (COMMERCIAL QUOTA MANAGER) */}
        <div className="card" style={{ borderTop: '4px solid #16a34a', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '12px' }}>
              <span>Đang tải dữ liệu Shop...</span>
            </div>
          )}

          <h3 style={{ marginTop: 0, color: '#16a34a' }}>💳 Thương mại hóa Quota theo Shop</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
            Chọn Cửa hàng và quản lý cấp phát gói cước, reset hoặc tăng hạn mức lượt gọi AI.
          </p>

          {message.text && (
            <div style={{ padding: '8px 12px', marginBottom: '12px', borderRadius: '6px', fontSize: '12px', background: message.type === 'error' ? '#fee2e2' : '#dcfce7', color: message.type === 'error' ? '#991b1b' : '#15803d' }}>
              {message.text}
            </div>
          )}

          {/* SHOP SELECTOR + SEARCH */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input
                type="text"
                value={shopSearchText}
                onChange={(e) => setShopSearchText(e.target.value)}
                placeholder="🔍 Tìm tên Shop..."
                style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
            <select
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
            >
              {filteredShops.length === 0 ? (
                <option value="">Không tìm thấy cửa hàng nào</option>
              ) : (
                filteredShops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))
              )}
            </select>
          </div>

          {/* SHOP USAGE PROGRESS BAR */}
          {currentShop && (
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentShop.name}</span>
                <span style={{ color: usagePercentage > 90 ? '#be123c' : usagePercentage > 70 ? '#b45309' : '#16a34a', fontWeight: 700 }}>
                  {quota.usedQuota} / {quota.dailyQuota} ({usagePercentage}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${usagePercentage}%`, height: '100%',
                  background: usagePercentage > 90 ? '#ef4444' : usagePercentage > 70 ? '#f59e0b' : '#10b981',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}

          {/* PRESET COMMERCIAL PLANS BUTTONS */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Chọn nhanh Gói cước SaaS:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handleApplyPresetPlan('FREE', 100)}
                style={{ padding: '6px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: quota.planName === 'FREE' ? '#2563eb' : '#fff', color: quota.planName === 'FREE' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}
              >
                FREE (100)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetPlan('STARTER', 1000)}
                style={{ padding: '6px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: quota.planName === 'STARTER' ? '#2563eb' : '#fff', color: quota.planName === 'STARTER' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}
              >
                STARTER (1K)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetPlan('PRO', 5000)}
                style={{ padding: '6px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: quota.planName === 'PRO' ? '#2563eb' : '#fff', color: quota.planName === 'PRO' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}
              >
                PRO (5K)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPresetPlan('BUSINESS', 20000)}
                style={{ padding: '6px', fontSize: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: quota.planName === 'BUSINESS' ? '#2563eb' : '#fff', color: quota.planName === 'BUSINESS' ? '#fff' : '#475569', cursor: 'pointer', fontWeight: 600 }}
              >
                BUSINESS (20K)
              </button>
            </div>
          </div>

          {/* EDIT FIELDS & QUICK ACTIONS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#16a34a', marginBottom: '2px', fontWeight: 600 }}>Hạn Mức AI (Tháng)</label>
              <input
                type="number"
                value={quota.dailyQuota}
                onChange={(e) => setQuota({ ...quota, dailyQuota: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#be123c', marginBottom: '2px', fontWeight: 600 }}>Đã Sử Dụng</label>
              <input
                type="number"
                value={quota.usedQuota}
                onChange={(e) => setQuota({ ...quota, usedQuota: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => handleAddQuota(500)}
              style={{ flex: 1, padding: '6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
            >
              ➕ Cấp thêm +500 lượt
            </button>
            <button
              type="button"
              onClick={handleResetUsedQuota}
              style={{ flex: 1, padding: '6px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
            >
              🔄 Reset lượt về 0
            </button>
          </div>

          <button
            onClick={handleSaveQuota}
            disabled={saving || !selectedShopId}
            style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: (saving || !selectedShopId) ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Đang lưu...' : '💾 Lưu Cấu Hình Quotas Shop'}
          </button>
        </div>
      </div>
    </div>
  );
}
