import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { SystemConfigRepository, ShopQuotaRepository } from '../../../../domain/admin/admin.config.repository.js';
import { AdminRepository } from '../../../../domain/admin/admin.repository.js';
import QuotaOverview from '../../components/QuotaOverview';
import { SkeletonHeroKpis, SkeletonCard } from '../../components/Skeleton';

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
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [showFullKeys, setShowFullKeys] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [databaseKeys, setDatabaseKeys] = useState([]);
  const [modelUsageStats, setModelUsageStats] = useState([]);
  const [costRates, setCostRates] = useState([]);
  const [providerResilience, setProviderResilience] = useState({});
  const [tableFilter, setTableFilter] = useState('all');
  
  // Tab Switcher State ('keys' | 'quota' | 'prompts' | 'database' | 'all')
  const [activeSection, setActiveSection] = useState('keys');

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

        // Tải thống kê số lượt đã dùng của từng model
        const stats = await AdminRepository.getAiModelsUsageStats().catch(() => []);
        setModelUsageStats(stats);

        // Tải biểu phí giá vốn mô hình AI từ bảng ai_model_cost_rates
        const rates = await AdminRepository.getAiModelCostRates().catch(() => []);
        setCostRates(rates);

        // Tải chỉ số độ phục hồi & SLA nhà cung cấp AI
        const resilience = await AdminRepository.getProviderResilienceAnalytics(
          new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
          new Date().toISOString()
        ).catch(() => ({ by_provider: {} }));
        if (resilience?.by_provider) {
          setProviderResilience(resilience.by_provider);
        }

        // Helper parse an toàn cho dữ liệu từ Supabase system_configs
        const safeParseConfig = (v) => {
          if (!v) return {};
          if (typeof v === 'string') {
            try {
              const parsed = JSON.parse(v);
              if (typeof parsed === 'string') return { key: parsed, keys: [parsed], value: parsed };
              return parsed;
            } catch (_) {
              return { key: v, keys: [v], value: v };
            }
          }
          return v;
        };

        // 1. Tải cấu hình Groq & Provider mặc định
        const keyData = await SystemConfigRepository.getSystemConfig('groq_api_keys').catch(() => []);
        let activeProv = 'groq';
        let activeMod = 'llama-3.3-70b-versatile';
        let fetchedGroqKeys = [];
        let lastUpdate = null;

        if (keyData && keyData.length > 0 && keyData[0].value) {
          const rawVal = keyData[0].value;
          const val = safeParseConfig(rawVal);
          lastUpdate = keyData[0].updated_at;
          if (val.provider) {
            activeProv = val.provider;
          }
          if (val.model) {
            activeMod = val.model;
          }
          if (Array.isArray(val.keys)) {
            val.keys.forEach(k => { if (k && typeof k === 'string' && k.trim()) fetchedGroqKeys.push(k.trim()); });
          } else if (val.key && typeof val.key === 'string' && val.key.trim()) {
            fetchedGroqKeys.push(val.key.trim());
          }
        }

        // 2. Tải cấu hình Gemini API Key (hỗ trợ cả dàn keys mảng lẫn chuỗi đơn)
        const geminiData = await SystemConfigRepository.getSystemConfig('gemini_api_key').catch(() => []);
        let fetchedGeminiKeys = [];
        let geminiModel = 'gemini-3.6-flash';
        if (geminiData && geminiData.length > 0 && geminiData[0].value) {
          const rawVal = geminiData[0].value;
          const val = safeParseConfig(rawVal);
          if (val.model) geminiModel = val.model;
          if (Array.isArray(val.keys)) {
            val.keys.forEach(k => { if (k && typeof k === 'string' && k.trim() && !fetchedGeminiKeys.includes(k.trim())) fetchedGeminiKeys.push(k.trim()); });
          }
          if (val.key && typeof val.key === 'string' && val.key.trim() && !fetchedGeminiKeys.includes(val.key.trim())) {
            fetchedGeminiKeys.push(val.key.trim());
          }
          if (typeof rawVal === 'string' && (rawVal.startsWith('AIzaSy') || rawVal.startsWith('AQ.')) && !fetchedGeminiKeys.includes(rawVal.trim())) {
            fetchedGeminiKeys.push(rawVal.trim());
          }
        }

        // 3. Tải cấu hình OpenAI API Key
        const openaiData = await SystemConfigRepository.getSystemConfig('openai_api_key').catch(() => []);
        let fetchedOpenaiKeys = [];
        let openaiModel = 'gpt-4o-mini';
        if (openaiData && openaiData.length > 0 && openaiData[0].value) {
          const rawVal = openaiData[0].value;
          const val = safeParseConfig(rawVal);
          if (val.model) openaiModel = val.model;
          if (Array.isArray(val.keys)) {
            val.keys.forEach(k => { if (k && typeof k === 'string' && k.trim() && !fetchedOpenaiKeys.includes(k.trim())) fetchedOpenaiKeys.push(k.trim()); });
          }
          if (val.key && typeof val.key === 'string' && val.key.trim() && !fetchedOpenaiKeys.includes(val.key.trim())) {
            fetchedOpenaiKeys.push(val.key.trim());
          }
        }

        // 4. ƯU TIÊN TUYỆT ĐỐI cấu hình default_ai_model (Single Source of Truth)
        const defaultModelData = await SystemConfigRepository.getSystemConfig('default_ai_model').catch(() => []);
        if (defaultModelData && defaultModelData.length > 0 && defaultModelData[0].value) {
          const dVal = safeParseConfig(defaultModelData[0].value);
          if (dVal.provider) activeProv = dVal.provider;
          if (dVal.model) activeMod = dVal.model;
        } else {
          // Fallback từ localStorage nếu DB chưa có bản ghi default_ai_model
          try {
            const savedLocal = localStorage.getItem(STORAGE_KEY);
            if (savedLocal) {
              const p = JSON.parse(savedLocal);
              if (p.provider) activeProv = p.provider;
              if (p.model) activeMod = p.model;
            }
          } catch (_) {}
        }

        setAiProvider(activeProv);
        setSelectedModel(activeMod);

        // Tách lọc sạch sẽ keys: Nếu trong groq_api_keys có chứa nhầm Gemini key (AIzaSy/AQ.), chuyển sang Gemini
        const cleanGroqKeys = [];
        fetchedGroqKeys.forEach(k => {
          if (!k || !k.trim()) return;
          const trimmed = k.trim();
          if (trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) {
            if (!fetchedGeminiKeys.includes(trimmed)) fetchedGeminiKeys.push(trimmed);
          } else {
            cleanGroqKeys.push(trimmed);
          }
        });

        // Tạo dàn keys hợp nhất trên toàn hệ thống
        const unified = [];

        // Nạp Groq keys
        cleanGroqKeys.forEach((k, idx) => {
          if (!k || !k.trim()) return;
          if (unified.some(u => u.key === k.trim())) return;
          unified.push({
            id: `groq-${idx}`,
            provider: 'groq',
            key: k.trim(),
            model: (activeProv === 'groq') ? activeMod : 'llama-3.3-70b-versatile',
            isDefault: activeProv === 'groq',
            sourceConfig: 'groq_api_keys'
          });
        });

        // Nạp Gemini keys
        fetchedGeminiKeys.forEach((k, idx) => {
          if (!k || !k.trim()) return;
          if (unified.some(u => u.key === k.trim())) return;
          unified.push({
            id: `gemini-${idx}`,
            provider: 'gemini',
            key: k.trim(),
            model: activeProv === 'gemini' ? activeMod : geminiModel,
            isDefault: activeProv === 'gemini',
            sourceConfig: 'gemini_api_key'
          });
        });

        // Nạp OpenAI keys
        fetchedOpenaiKeys.forEach((k, idx) => {
          if (!k || !k.trim()) return;
          if (unified.some(u => u.key === k.trim())) return;
          unified.push({
            id: `openai-${idx}`,
            provider: 'openai',
            key: k.trim(),
            model: activeProv === 'openai' ? activeMod : openaiModel,
            isDefault: activeProv === 'openai',
            sourceConfig: 'openai_api_key'
          });
        });

        // SẮP XẾP: Đưa Provider/Model MẶC ĐỊNH (isDefault) lên vị trí đầu bảng (#1)
        unified.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

        setDatabaseKeys(unified);

        // Giữ ô nhập key mới luôn sạch sẽ - không nạp lại dàn keys cũ vào ô nhập
        setGroqKeysInput('');

        const totalKeyCount = unified.length > 0 ? unified.length : fetchedGroqKeys.length;
        if (totalKeyCount > 0) {
          setDbStatusInfo({
            synced: true,
            keyCount: totalKeyCount,
            lastUpdated: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Vừa xong',
            errorDetails: null
          });
        } else {
          setDbStatusInfo({ synced: false, keyCount: 0, lastUpdated: 'Chưa có bản ghi API Key trong DB', errorDetails: 'Bảng system_configs chưa có dữ liệu key' });
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
    const handleRefresh = () => {
      verifyAndLoadFromDB();
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
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
    
    // 1. Lấy tất cả key hiện có của provider này trong database
    const existingKeysForProvider = databaseKeys
      .filter(k => k.provider === aiProvider)
      .map(k => k.key.trim())
      .filter(Boolean);

    // 2. Lấy key từ ô nhập textarea
    const inputKeys = keysList
      .map(k => k.trim())
      .filter(Boolean);

    if (inputKeys.length === 0) {
      setKeySaveStatus({ text: `Vui lòng nhập hoặc dán ít nhất 1 API Key mới cho ${aiProvider.toUpperCase()} trước khi bấm Thêm!`, type: 'error' });
      return;
    }

    // 3. Tự động THÊM VÀO (APPEND/MERGE): Giữ lại tất cả các key cũ đang có, cộng thêm các key mới từ ô nhập
    const mergedKeys = [...existingKeysForProvider];
    let newCount = 0;
    inputKeys.forEach(k => {
      if (!mergedKeys.includes(k)) {
        mergedKeys.push(k);
        newCount++;
      }
    });

    if (newCount === 0) {
      setKeySaveStatus({ text: `⚠️ API Key bạn vừa nhập đã có sẵn trong dàn ${aiProvider.toUpperCase()} rồi (tránh trùng lặp).`, type: 'info' });
      setGroqKeysInput('');
      return;
    }

    if (mergedKeys.length === 0) {
      setKeySaveStatus({ text: `Vui lòng nhập ít nhất 1 API Key cho ${aiProvider.toUpperCase()}!`, type: 'error' });
      return;
    }

    const payloadObj = {
      provider: aiProvider,
      keys: mergedKeys,
      model: selectedModel
    };

    // Chỉ cache provider/model — KHÔNG lưu API key ra localStorage/chrome.storage.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: aiProvider, model: selectedModel }));

    try {
      if (!globalThis.SupabaseCloud) throw new Error('Không tìm thấy Supabase Connection');
      
      const targetConfigKey = aiProvider === 'gemini' ? 'gemini_api_key' : (aiProvider === 'openai' ? 'openai_api_key' : 'groq_api_keys');
      
      if (aiProvider === 'groq') {
        await SystemConfigRepository.upsertSystemConfig('groq_api_keys', payloadObj, `Groq API Keys (${mergedKeys.length} keys gánh tải)`);
      } else if (aiProvider === 'gemini') {
        await SystemConfigRepository.upsertSystemConfig(
          'gemini_api_key',
          { key: mergedKeys[0], keys: mergedKeys, model: selectedModel, updated_at: new Date().toISOString() },
          `Google Gemini API Keys (${mergedKeys.length} keys gánh tải)`
        );
      } else if (aiProvider === 'openai') {
        await SystemConfigRepository.upsertSystemConfig(
          'openai_api_key',
          { key: mergedKeys[0], keys: mergedKeys, model: selectedModel, updated_at: new Date().toISOString() },
          `OpenAI API Keys (${mergedKeys.length} keys)`
        );
      }

      await SystemConfigRepository.upsertSystemConfig(
        'default_ai_model',
        { provider: aiProvider, model: selectedModel, updated_at: new Date().toISOString() },
        'Cấu hình Provider và Model AI mặc định'
      ).catch(() => {});
      
      await AdminRepository.insertAuditLog('ADMIN_UPDATE_AI_KEYS', targetConfigKey, 'config', null, { keyCount: mergedKeys.length, provider: aiProvider });

      const verifyData = await SystemConfigRepository.getSystemConfig(targetConfigKey);

      if (verifyData && verifyData.length > 0 && verifyData[0].value) {
        const savedCount = mergedKeys.length;
        const lastUpdate = verifyData[0].updated_at || new Date().toISOString();

        setDbStatusInfo({
          synced: true,
          keyCount: savedCount,
          lastUpdated: new Date(lastUpdate).toLocaleTimeString(),
          errorDetails: null
        });

        setShowSqlGuide(false);
        setKeySaveStatus({
          text: `🟢 ĐÃ THÊM & ĐỒNG BỘ THÀNH CÔNG! Đã bổ sung +${newCount} key mới vào dàn ${aiProvider.toUpperCase()} (Hiện có tổng cộng ${savedCount} keys hoạt động).`,
          type: 'success'
        });
        setGroqKeysInput('');
        await verifyAndLoadFromDB();
      } else {
        throw new Error('Database chưa lưu thành công bản ghi.');
      }
    } catch (e) {
      setDbStatusInfo({ synced: false, keyCount: mergedKeys.length, lastUpdated: 'Thất bại DB', errorDetails: e.message });
      setKeySaveStatus({ text: `🔴 LỖI ĐỒNG BỘ SUPABASE DATABASE: ${e.message}`, type: 'error' });
      if (e.message.includes('RLS') || e.message.includes('401') || e.message.includes('403') || e.message.includes('ACCESS_DENIED')) setShowSqlGuide(true);
    }
  };

  const handleTestConnection = async () => {
    setTestingKey(true);
    setKeySaveStatus({ text: `⏳ Đang kiểm tra kết nối API Key (${aiProvider.toUpperCase()})...`, type: 'info' });

    // 1. Tìm key trong databaseKeys thuộc về aiProvider đang cấu hình
    const matchingDbKeys = databaseKeys.filter(k => k.provider === aiProvider);
    const matchingDefaultKey = matchingDbKeys.find(k => k.isDefault)?.key || matchingDbKeys[0]?.key;

    // 2. Lấy key từ textarea nếu người dùng đang nhập đúng provider
    let candidateKey = null;
    if (keysList.length > 0) {
      const topKey = keysList[0];
      if (aiProvider === 'gemini' && (topKey.startsWith('AIzaSy') || topKey.startsWith('AQ.'))) candidateKey = topKey;
      else if (aiProvider === 'openai' && topKey.startsWith('sk-')) candidateKey = topKey;
      else if (aiProvider === 'groq' && !topKey.startsWith('AIzaSy') && !topKey.startsWith('sk-')) candidateKey = topKey;
      else if (!candidateKey) candidateKey = topKey;
    }

    const testKey = candidateKey || matchingDefaultKey || matchingDbKeys[0]?.key;

    if (!testKey) {
      setKeySaveStatus({ text: `Vui lòng nhập API Key hợp lệ cho ${aiProvider.toUpperCase()} để kiểm tra!`, type: 'error' });
      setTestingKey(false);
      return;
    }

    try {
      let res;
      if (aiProvider === 'openai') {
        const candidateOpenaiModels = [
          selectedModel,
          'gpt-4o-mini',
          'gpt-4o',
          'gpt-3.5-turbo'
        ].filter(Boolean);
        const uniqueModels = Array.from(new Set(candidateOpenaiModels));

        let workingModel = null;
        for (const mod of uniqueModels) {
          try {
            res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${testKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: mod, messages: [{ role: 'user', content: 'Ping' }], max_tokens: 5 })
            });
            if (res.ok) {
              workingModel = mod;
              break;
            } else if (res.status === 404) {
              continue;
            } else {
              break;
            }
          } catch (e) {
            break;
          }
        }
        if (workingModel && workingModel !== selectedModel) {
          setSelectedModel(workingModel);
          await SystemConfigRepository.upsertSystemConfig(
            'openai_api_key',
            { key: databaseKeys.find(k => k.provider === 'openai')?.key || testKey, keys: databaseKeys.filter(k => k.provider === 'openai').map(k => k.key), model: workingModel, updated_at: new Date().toISOString() },
            `Cập nhật model OpenAI tự động: ${workingModel}`
          ).catch(() => {});
          await SystemConfigRepository.upsertSystemConfig(
            'default_ai_model',
            { provider: 'openai', model: workingModel, updated_at: new Date().toISOString() },
            'Tự động chuyển sang model OpenAI hoạt động'
          ).catch(() => {});
        }
      } else if (aiProvider === 'gemini') {
        // Gemini Models Fallback Chain: Tự động thử nghiệm chuỗi model nếu model hiện tại gặp 404
        const candidateGeminiModels = [
          selectedModel,
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.7-flash',
          'gemini-3.5-flash-lite',
          'gemini-1.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-pro'
        ].filter(Boolean);
        const uniqueModels = Array.from(new Set(candidateGeminiModels));

        let workingModel = null;
        for (const mod of uniqueModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${encodeURIComponent(testKey)}`;
            res = await fetch(geminiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': testKey
              },
              body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] })
            });
            if (res.ok) {
              workingModel = mod;
              break;
            } else if (res.status === 404) {
              continue; // Model này bị 404/không hỗ trợ, thử model tiếp theo
            } else {
              break; // Lỗi xác thực hoặc hết quota thì dừng
            }
          } catch (e) {
            break;
          }
        }

        if (workingModel && workingModel !== selectedModel) {
          setSelectedModel(workingModel);
          // Cập nhật cấu hình model mới này vào database để toàn hệ thống đồng bộ
          await SystemConfigRepository.upsertSystemConfig(
            'gemini_api_key',
            { key: databaseKeys.find(k => k.provider === 'gemini')?.key || testKey, keys: databaseKeys.filter(k => k.provider === 'gemini').map(k => k.key), model: workingModel, updated_at: new Date().toISOString() },
            `Cập nhật model Gemini tự động: ${workingModel}`
          ).catch(() => {});
          await SystemConfigRepository.upsertSystemConfig(
            'default_ai_model',
            { provider: 'gemini', model: workingModel, updated_at: new Date().toISOString() },
            'Tự động chuyển sang model Gemini hoạt động'
          ).catch(() => {});
        }
      } else {
        // Groq Models Fallback Chain: Nếu model hiện tại bị Groq 404 (do Groq chuyển Llama sang Enterprise),
        // hệ thống tự động thử các model miễn phí đang hoạt động của Groq.
        const candidateGroqModels = [
          selectedModel,
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'gemma2-9b-it'
        ].filter(Boolean);
        const uniqueModels = Array.from(new Set(candidateGroqModels));

        let workingModel = null;
        let lastErrStatus = null;
        let lastErrMsg = null;

        for (const mod of uniqueModels) {
          try {
            res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${testKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: mod, messages: [{ role: 'user', content: 'Ping' }], max_tokens: 5 })
            });
            if (res.ok) {
              workingModel = mod;
              break;
            } else if (res.status === 404) {
              const errData = await res.json().catch(() => ({}));
              lastErrStatus = 404;
              lastErrMsg = errData.error?.message || `Model ${mod} không khả dụng (404)`;
              continue;
            } else {
              break;
            }
          } catch (fetchErr) {
            lastErrMsg = fetchErr.message;
            break;
          }
        }

        if (workingModel && workingModel !== selectedModel) {
          const prevModel = selectedModel;
          setSelectedModel(workingModel);
          // Cập nhật cấu hình model mới này vào database để toàn hệ thống đồng bộ
          await SystemConfigRepository.upsertSystemConfig(
            'groq_api_keys',
            { provider: 'groq', keys: databaseKeys.filter(k => k.provider === 'groq').map(k => k.key), model: workingModel, updated_at: new Date().toISOString() },
            `Cập nhật model Groq tự động: ${workingModel}`
          ).catch(() => {});
          await SystemConfigRepository.upsertSystemConfig(
            'default_ai_model',
            { provider: 'groq', model: workingModel, updated_at: new Date().toISOString() },
            'Tự động chuyển sang model Groq hoạt động'
          ).catch(() => {});
        }
      }

      if (res && res.ok) {
        setKeySaveStatus({ text: `🟢 Kiểm tra THÀNH CÔNG! API Key (${aiProvider.toUpperCase()}) hoạt động tốt. Đang cập nhật lượt dùng...`, type: 'success' });
        const testModel = selectedModel || (aiProvider === 'gemini' ? 'gemini-3.6-flash' : 'llama-3.3-70b-versatile');
        await AdminRepository.recordAiUsage({
          model: testModel,
          requestType: 'test_connection',
          promptTokens: 10,
          completionTokens: 5,
          status: 'success'
        }).catch(() => {});
        const updatedStats = await AdminRepository.getAiModelsUsageStats().catch(() => []);
        setModelUsageStats(updatedStats);
        setKeySaveStatus({ text: `🟢 Kiểm tra THÀNH CÔNG! API Key (${aiProvider.toUpperCase()}) kết nối hoàn hảo. Model đang chạy: [${selectedModel}]. Đã ghi nhận 1 lượt kiểm tra (+1 lượt dùng).`, type: 'success' });
      } else {
        const errJson = await res?.json().catch(() => ({}));
        const displayErr = errJson?.error?.message || (res ? `Lỗi HTTP ${res.status}` : 'Không thể kết nối API');
        setKeySaveStatus({ text: `🔴 Key lỗi (${res?.status || 'Net'}): ${displayErr}`, type: 'error' });
      }
    } catch (e) {
      setKeySaveStatus({ text: `🔴 Lỗi mạng: ` + e.message, type: 'error' });
    }
    setTestingKey(false);
  };

  const handleTestSampleOrder = async (targetItem) => {
    // Ưu tiên:
    // 1. targetItem khi bấm 'Bóc tách thử 1 đơn' trên dòng cụ thể trong bảng
    // 2. Item mặc định của hệ thống (isDefault === true)
    // 3. Item thuộc provider đang chọn (aiProvider)
    // 4. Item đầu tiên trong DB
    // 5. Input key đang nhập trong form
    const defaultItem = databaseKeys.find(k => k.provider === aiProvider && k.isDefault)
      || databaseKeys.find(k => k.isDefault)
      || databaseKeys.find(k => k.provider === aiProvider)
      || (databaseKeys.length > 0 ? databaseKeys[0] : null);

    const item = targetItem || defaultItem || (keysList.length > 0 ? { provider: aiProvider, model: selectedModel, key: keysList[0] } : null);
    if (!item || !item.key) {
      setKeySaveStatus({ text: 'Vui lòng nhập hoặc lưu ít nhất 1 API Key hợp lệ để thử nghiệm!', type: 'error' });
      return;
    }
    setTestingKey(true);
    setKeySaveStatus({ text: `⏳ Đang gửi đơn hàng mẫu đến model [${item.model}] (${item.provider.toUpperCase()})...`, type: 'info' });

    const samplePrompt = `Anh Nam 0912345678 Số 123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh COD 250k Giao giờ hành chính Cây kim ngân`;

    try {
      let parseSuccess = false;
      let modelUsed = item.model;
      if (item.provider === 'gemini') {
        const candidateGeminiModels = [
          item.model,
          selectedModel,
          'gemini-3.6-flash',
          'gemini-3.8-flash',
          'gemini-3.7-flash',
          'gemini-3.5-flash-lite',
          'gemini-1.5-flash',
          'gemini-2.0-flash',
          'gemini-1.5-pro'
        ].filter(Boolean);
        const uniqueModels = Array.from(new Set(candidateGeminiModels));

        let lastErr = null;
        for (const mod of uniqueModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${encodeURIComponent(item.key)}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': item.key },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `Bạn là trợ lý bóc tách đơn hàng tiếng Việt. Hãy trích xuất: {"name":"...","phone":"...","address":"...","codAmount":0,"productItem":"..."} từ: ${samplePrompt}`
                  }]
                }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
              })
            });
            if (res.ok) {
              parseSuccess = true;
              modelUsed = mod;
              if (mod !== selectedModel) {
                setSelectedModel(mod);
              }
              break;
            } else if (res.status === 404) {
              const errJson = await res.json().catch(() => ({}));
              lastErr = errJson.error?.message || `Model ${mod} không khả dụng (404)`;
              continue;
            } else {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.error?.message || `Lỗi HTTP ${res.status}`);
            }
          } catch (e) {
            lastErr = e.message;
            if (!e.message.includes('404')) throw e;
          }
        }
        if (!parseSuccess) {
          throw new Error(lastErr || 'Tất cả các model của Gemini đều không khả dụng với key này.');
        }
      } else if (item.provider === 'openai') {
        const candidateOpenaiModels = [
          item.model,
          selectedModel,
          'gpt-4o-mini',
          'gpt-4o',
          'gpt-3.5-turbo'
        ].filter(Boolean);
        const uniqueModels = Array.from(new Set(candidateOpenaiModels));

        let lastErr = null;
        for (const mod of uniqueModels) {
          try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${item.key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: mod,
                messages: [{ role: 'user', content: `Trích xuất JSON {"name","phone","address","codAmount"} từ: ${samplePrompt}` }],
                response_format: { type: 'json_object' }
              })
            });
            if (res.ok) {
              parseSuccess = true;
              modelUsed = mod;
              if (mod !== selectedModel) {
                setSelectedModel(mod);
              }
              break;
            } else if (res.status === 404) {
              const errJson = await res.json().catch(() => ({}));
              lastErr = errJson.error?.message || `Model ${mod} không khả dụng (404)`;
              continue;
            } else {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.error?.message || `Lỗi HTTP ${res.status}`);
            }
          } catch (e) {
            lastErr = e.message;
            if (!e.message.includes('404')) throw e;
          }
        }
        if (!parseSuccess) {
          throw new Error(lastErr || 'Tất cả các model của OpenAI đều không khả dụng với key này.');
        }
      } else {
        const candidateGroqModels = [
          item.model,
          selectedModel,
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'gemma2-9b-it'
        ].filter(Boolean);
        const uniqueModels = Array.from(new Set(candidateGroqModels));

        let lastErr = null;
        for (const mod of uniqueModels) {
          try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${item.key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: mod,
                messages: [{ role: 'user', content: `Trích xuất JSON {"name","phone","address","codAmount"} từ: ${samplePrompt}` }],
                max_tokens: 1000,
                response_format: { type: 'json_object' }
              })
            });
            if (res.ok) {
              parseSuccess = true;
              modelUsed = mod;
              if (mod !== selectedModel) {
                setSelectedModel(mod);
              }
              break;
            } else if (res.status === 404) {
              const errData = await res.json().catch(() => ({}));
              lastErr = errData.error?.message || `Model ${mod} không khả dụng (404)`;
              continue;
            } else {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error?.message || `Lỗi HTTP ${res.status}`);
            }
          } catch (e) {
            lastErr = e.message;
            if (!e.message.includes('404')) throw e;
          }
        }
        if (!parseSuccess) {
          throw new Error(lastErr || 'Tất cả các model của Groq đều không khả dụng với key này.');
        }
      }

      if (parseSuccess) {
        await AdminRepository.recordAiUsage({
          model: modelUsed,
          requestType: 'parse',
          promptTokens: 30,
          completionTokens: 25,
          status: 'success'
        }).catch(() => {});
        const updatedStats = await AdminRepository.getAiModelsUsageStats().catch(() => []);
        setModelUsageStats(updatedStats);
        setKeySaveStatus({
          text: `🎉 BÓC TÁCH MẪU THÀNH CÔNG! Đã gọi model [${modelUsed}] (${item.provider.toUpperCase()}) bóc tách đơn mẫu và ghi nhận 1 lượt bóc tách thực tế vào hệ thống (+1 lượt hôm nay). Bảng dàn Keys đã cập nhật ngay!`,
          type: 'success'
        });
      }
    } catch (err) {
      setKeySaveStatus({ text: `🔴 Lỗi bóc tách thử nghiệm: ${err.message}`, type: 'error' });
    } finally {
      setTestingKey(false);
    }
  };



  const copyKeyToClipboard = (keyStr, id) => {
    try {
      navigator.clipboard.writeText(keyStr);
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2500);
    } catch (_) {}
  };

  const getUsageForModelOrProvider = (modelName, provider) => {
    if (!Array.isArray(modelUsageStats) || modelUsageStats.length === 0) return { calls: 0, today: 0, tokens: 0 };

    const parseStat = (s) => ({
      calls: Number(s.total_calls ?? s.total_requests ?? s.calls ?? 0),
      today: Number(s.calls_today ?? s.today_requests ?? s.today ?? 0),
      tokens: Number(s.total_tokens ?? ((Number(s.total_prompt_tokens) || 0) + (Number(s.total_completion_tokens) || 0)) ?? 0)
    });

    const exact = modelUsageStats.find(s => s.model === modelName);
    if (exact) return parseStat(exact);

    const sub = modelUsageStats.find(s => s.model && (s.model.includes(modelName) || modelName.includes(s.model)));
    if (sub) return parseStat(sub);

    const provHits = modelUsageStats.filter(s => s.model && s.model.toLowerCase().includes((provider || '').toLowerCase()));
    if (provHits.length > 0) {
      return {
        calls: provHits.reduce((acc, h) => acc + Number(h.total_calls ?? h.total_requests ?? h.calls ?? 0), 0),
        today: provHits.reduce((acc, h) => acc + Number(h.calls_today ?? h.today_requests ?? h.today ?? 0), 0),
        tokens: provHits.reduce((acc, h) => acc + Number(h.total_tokens ?? ((Number(h.total_prompt_tokens) || 0) + (Number(h.total_completion_tokens) || 0)) ?? 0), 0)
      };
    }

    return { calls: 0, today: 0, tokens: 0 };
  };

  const handleSetDefaultModel = async (item) => {
    setKeySaveStatus({ text: `⏳ Đang cấu hình [${item.model}] (${item.provider.toUpperCase()}) làm Model Mặc Định...`, type: 'info' });
    try {
      setAiProvider(item.provider);
      setSelectedModel(item.model);

      // Thu thập dàn key chuẩn của chính provider này từ databaseKeys
      const matchingKeys = databaseKeys
        .filter(k => k.provider === item.provider)
        .map(k => k.key);
      if (item.key && !matchingKeys.includes(item.key)) {
        matchingKeys.push(item.key);
      }
      const effectiveKeys = matchingKeys.length > 0 ? matchingKeys : [item.key];

      const payloadObj = {
        provider: item.provider,
        keys: effectiveKeys,
        model: item.model
      };

      // 1. Cập nhật Model AI mặc định toàn hệ thống (Single Source of Truth)
      await SystemConfigRepository.upsertSystemConfig(
        'default_ai_model',
        { provider: item.provider, model: item.model, updated_at: new Date().toISOString() },
        'Model AI mặc định toàn hệ thống'
      );

      // 2. Cập nhật config tương ứng của provider
      if (item.provider === 'groq') {
        await SystemConfigRepository.upsertSystemConfig('groq_api_keys', payloadObj, `Cấu hình AI mặc định: ${item.model} (GROQ)`);
      } else if (item.provider === 'gemini') {
        await SystemConfigRepository.upsertSystemConfig(
          'gemini_api_key',
          { key: effectiveKeys[0], keys: effectiveKeys, model: item.model, updated_at: new Date().toISOString() },
          'Google Gemini API Key cấu hình cho hệ thống'
        ).catch(() => {});
      } else if (item.provider === 'openai') {
        await SystemConfigRepository.upsertSystemConfig(
          'openai_api_key',
          { key: effectiveKeys[0], keys: effectiveKeys, model: item.model, updated_at: new Date().toISOString() },
          'OpenAI API Key cấu hình cho hệ thống'
        ).catch(() => {});
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: item.provider, model: item.model }));

      // Giữ ô nhập key mới luôn sạch sẽ
      setGroqKeysInput('');

      setKeySaveStatus({
        text: `🥇 ĐÃ CHỌN MODEL MẶC ĐỊNH: [${item.model}] (${item.provider.toUpperCase()}) hiện là Model chính! Khi có lỗi 404/429/500, AI Gateway sẽ tự động chuyển sang nhà cung cấp dự phòng.`,
        type: 'success'
      });

      await verifyAndLoadFromDB();
    } catch (e) {
      setKeySaveStatus({ text: `🔴 Lỗi chọn model mặc định: ${e.message}`, type: 'error' });
    }
  };

  const handleRemoveKeyItem = async (item) => {
    if (!window.confirm(`Bạn có chắc muốn xóa key ${item.key.slice(0, 10)}... của ${item.provider.toUpperCase()} không?`)) return;

    try {
      const remaining = databaseKeys
        .filter(k => k.provider === item.provider && k.key !== item.key)
        .map(k => k.key);

      if (item.provider === 'gemini') {
        await SystemConfigRepository.upsertSystemConfig(
          'gemini_api_key',
          { key: remaining[0] || '', keys: remaining, model: item.model, updated_at: new Date().toISOString() },
          'Cập nhật danh sách Gemini keys'
        );
      } else if (item.provider === 'groq') {
        await SystemConfigRepository.upsertSystemConfig(
          'groq_api_keys',
          { provider: 'groq', keys: remaining, model: item.model, updated_at: new Date().toISOString() },
          'Cập nhật danh sách Groq keys'
        );
      } else if (item.provider === 'openai') {
        await SystemConfigRepository.upsertSystemConfig(
          'openai_api_key',
          { key: remaining[0] || '', keys: remaining, model: item.model, updated_at: new Date().toISOString() },
          'Cập nhật danh sách OpenAI keys'
        );
      }
      setGroqKeysInput('');
      setKeySaveStatus({ text: `🟢 Đã xóa 1 key của ${item.provider.toUpperCase()}! Dàn còn ${remaining.length} keys hoạt động.`, type: 'success' });
      await verifyAndLoadFromDB();
    } catch (e) {
      setKeySaveStatus({ text: `🔴 Lỗi xóa key: ${e.message}`, type: 'error' });
    }
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
    else if (provider === 'gemini') setSelectedModel('gemini-3.6-flash');
    else setSelectedModel('llama-3.3-70b-versatile');

    // Giữ ô nhập key mới luôn sạch sẽ và đồng bộ bộ lọc bảng sang provider này
    setGroqKeysInput('');
    setTableFilter(provider);
  };

  const copySqlGuide = () => {
    navigator.clipboard.writeText(FIX_SQL_SCRIPT);
    alert("Đã copy hướng dẫn kiểm tra quyền vào bộ nhớ tạm! Mở Supabase SQL Editor và Dán (Ctrl+V).");
  };

  // Thống kê nhanh cho Hero KPIs
  const geminiKeysCount = databaseKeys.filter(k => k.provider === 'gemini').length;
  const groqKeysCount = databaseKeys.filter(k => k.provider === 'groq').length;
  const openaiKeysCount = databaseKeys.filter(k => k.provider === 'openai').length;

  const totalCallsToday = Array.isArray(modelUsageStats)
    ? modelUsageStats.reduce((acc, s) => acc + Number(s.calls_today ?? s.today_requests ?? s.today ?? 0), 0)
    : 0;

  const totalCallsAllTime = Array.isArray(modelUsageStats)
    ? modelUsageStats.reduce((acc, s) => acc + Number(s.total_calls ?? s.total_requests ?? s.calls ?? 0), 0)
    : 0;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. HEADER & ORIENTATION (Chuẩn ux-dashboard-dev-spec) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span> Cấu Hình AI Engine & Quản Lý Quotas
            </h2>
            {/* Status Indicator Pill - Tinh tế, không che lấp màn hình */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
              background: dbStatusInfo.synced ? '#ecfdf5' : '#fef2f2',
              color: dbStatusInfo.synced ? '#047857' : '#b91c1c',
              border: `1px solid ${dbStatusInfo.synced ? '#a7f3d0' : '#fecaca'}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: dbStatusInfo.synced ? '#10b981' : '#ef4444'
              }} />
              {dbStatusInfo.synced ? 'Supabase: Đã Đồng Bộ 100%' : 'Supabase: Chưa Đồng Bộ'}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
            Quản lý dàn API Keys toàn hệ thống, chuyển tiếp đa nhà cung cấp thông minh (Gemini ➔ Groq ➔ OpenAI) và kiểm soát quota từng shop.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={verifyAndLoadFromDB}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', background: '#ffffff', border: '1px solid #cbd5e1',
              borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, color: '#334155',
              cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <span>🔄</span> Làm Mới Dữ Liệu
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          <SkeletonHeroKpis count={4} />
          <SkeletonCard height={380} />
          <SkeletonCard height={280} />
        </div>
      ) : (
        <>
      {/* 2. HERO KPI METRICS ROW (4 Thẻ chỉ số tổng quan theo chuẩn ux-dashboard-dev-spec) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* KPI 1: TRẠNG THÁI SUPABASE DB */}
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '5px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Trạng Thái Supabase DB</span>
            <span style={{ fontSize: '16px' }}>🗄️</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '15px', fontWeight: 800,
              color: dbStatusInfo.synced ? '#15803d' : '#b91c1c'
            }}>
              {dbStatusInfo.synced ? 'ĐÃ ĐỒNG BỘ 100%' : 'LỖI KẾT NỐI DB'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Bảng <code>system_configs</code></span>
            {dbStatusInfo.synced ? (
              <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Verified</span>
            ) : (
              <button
                onClick={() => document.getElementById('sec-supabase-db')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ border: 'none', background: 'transparent', color: '#be123c', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '11px' }}
              >
                Khắc phục ngay
              </button>
            )}
          </div>
        </div>

        {/* KPI 2: DÀN API KEYS HOẠT ĐỘNG */}
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '5px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Dàn API Keys Trong DB</span>
            <span style={{ fontSize: '16px' }}>🔑</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            {databaseKeys.length} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Keys hoạt động</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {geminiKeysCount} Gemini · {groqKeysCount} Groq · {openaiKeysCount} OpenAI
          </div>
        </div>

        {/* KPI 3: MODEL MẶC ĐỊNH HỆ THỐNG */}
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '5px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Model Mặc Định Hệ Thống</span>
            <span style={{ fontSize: '16px' }}>🥇</span>
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedModel}>
            {selectedModel}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Engine:</span> <strong style={{ color: '#0f172a' }}>{aiProvider.toUpperCase()}</strong>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>• Ưu tiên #1</span>
          </div>
        </div>

        {/* KPI 4: LƯU LƯỢNG GỌI HÔM NAY */}
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '5px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Lưu Lượng Gọi Hôm Nay</span>
            <span style={{ fontSize: '16px' }}>📈</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d' }}>
            +{totalCallsToday.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>lượt</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Tổng tích lũy: <strong>{totalCallsAllTime.toLocaleString()}</strong> lượt bóc tách
          </div>
        </div>
      </div>

      {/* 2B. ĐỘ PHỤC HỒI & SLA NHÀ CUNG CẤP (PROVIDER RESILIENCE & SLA) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              🛡️ Độ Phục Hồi & SLA Nhà Cung Cấp (Provider Resilience)
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Giám sát tỷ lệ thành công (Success Rate), độ trễ p50/p95, phân lớp lỗi và tổng chi phí theo từng nhà cung cấp AI.
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            Chu kỳ: 30 ngày gần nhất
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {['groq', 'gemini', 'grok', 'openai'].map(prov => {
            const data = providerResilience[prov] || {
              provider: prov,
              total_requests: 0,
              success_requests: 0,
              failed_requests: 0,
              success_rate: 100,
              p50_latency_ms: 0,
              p95_latency_ms: 0,
              total_cost: 0,
              error_classes: {}
            };
            const errorKeys = Object.keys(data.error_classes || {});
            return (
              <div key={prov} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '13.5px', textTransform: 'uppercase', color: '#1e293b' }}>
                    {prov === 'groq' ? '⚡ Groq Llama' : prov === 'gemini' ? '💎 Google Gemini' : prov === 'grok' ? '🚀 xAI Grok' : '🧠 OpenAI'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: data.success_rate >= 95 ? '#ecfdf5' : data.success_rate >= 80 ? '#fffbeb' : '#fef2f2',
                    color: data.success_rate >= 95 ? '#059669' : data.success_rate >= 80 ? '#d97706' : '#dc2626'
                  }}>
                    {data.success_rate}% Thành Công
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Độ trễ p50 / p95:</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {data.p50_latency_ms}ms / {data.p95_latency_ms}ms
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>Chi phí ước tính:</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {data.total_cost != null ? `${Number(data.total_cost).toLocaleString()}đ` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>Tổng lượt: <b>{data.total_requests}</b></span>
                    <span>Lỗi: <b style={{ color: data.failed_requests > 0 ? '#dc2626' : '#64748b' }}>{data.failed_requests}</b></span>
                  </div>
                  {errorKeys.length > 0 && (
                    <div style={{ fontSize: '10.5px', color: '#b91c1c', marginTop: '4px' }}>
                      Phân Lớp Lỗi: {errorKeys.map(k => `${k}: ${data.error_classes[k]}`).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CẢNH BÁO NẾU SUPABASE BỊ LỖI KẾT NỐI (Chỉ hiện khi tải xong và thực sự lỗi) */}
      {!loading && !dbStatusInfo.synced && dbStatusInfo.lastUpdated !== 'Chưa kiểm tra' && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: '#991b1b', flexWrap: 'wrap', gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span><strong>Cảnh báo Supabase:</strong> Bảng <code>system_configs</code> chưa được phân quyền hoặc kết nối thất bại. {dbStatusInfo.errorDetails && `(${dbStatusInfo.errorDetails})`}</span>
          </div>
          <button
            onClick={() => document.getElementById('sec-supabase-db')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{
              background: '#b91c1c', color: '#ffffff', border: 'none', padding: '6px 14px',
              borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            🔧 Đi Tới Mục Supabase Để Khắc Phục
          </button>
        </div>
      )}

      {/* 3. THANH ĐIỀU HƯỚNG NHANH CÁC KHU VỰC (Quick Jump Navigation) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', fontWeight: 700 }}>
          <span>📍</span>
          <span>DANH MỤC KHU VỰC:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'sec-ai-keys', label: '1. Cấu Hình AI Engine & Keys', badge: `${databaseKeys.length} Keys`, color: '#2563eb', bg: '#eff6ff' },
            { id: 'sec-prompt-rules', label: '2. Luật Prompt Dùng Chung', badge: defaultPromptRules ? 'Đã bật' : 'Mặc định', color: '#d97706', bg: '#fffbeb' },
            { id: 'sec-shop-quotas', label: '3. Quản Lý Quota Shop', badge: `${shops.length} Shops`, color: '#16a34a', bg: '#f0fdf4' },
            { id: 'sec-supabase-db', label: '4. Supabase DB & Kết Nối', badge: dbStatusInfo.synced ? '100% OK' : 'Cần Fix', color: dbStatusInfo.synced ? '#0f766e' : '#b91c1c', bg: dbStatusInfo.synced ? '#f0fdfa' : '#fef2f2' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                const el = document.getElementById(item.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              style={{
                background: item.bg,
                color: item.color,
                border: `1px solid ${item.color}33`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{item.label}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.85)',
                color: item.color
              }}>
                {item.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* KHU VỰC 1: CẤU HÌNH AI PROVIDER & API KEYS */}
      <div
        id="sec-ai-keys"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #2563eb',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          scrollMarginTop: '20px'
        }}
      >
        {/* HEADER KHU VỰC 1 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              🤖
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px'
                }}>
                  KHU VỰC 1
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Nhà Cung Cấp AI Engine & Quản Lý API Keys
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                Cấu hình API Keys (Gemini, Groq, OpenAI), chọn mô hình bóc tách đơn mặc định và kiểm thử kết nối trực tiếp.
              </p>
            </div>
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#1d4ed8',
            background: '#eff6ff',
            padding: '6px 14px',
            borderRadius: '20px',
            border: '1px solid #bfdbfe',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            🔑 {databaseKeys.length} Keys Trong Hệ Thống
          </span>
        </div>

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
              <option value="gemini">🥇 Google Gemini AI (Gemini 2.0 / 1.5 Flash - Toàn diện, cực nhanh & chuẩn xác)</option>
              <option value="groq">⚡ Groq AI (Llama 3.3 - Nhanh & Miễn phí)</option>
              <option value="openai">🟢 OpenAI ChatGPT (GPT-4o-mini - Chính xác)</option>
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
              {aiProvider === 'gemini' && (
                <>
                  <option value="gemini-3.6-flash">🥇 gemini-3.6-flash (Google Gemini 3.6 Flash - Siêu nhanh & Chuẩn xác nhất - Khuyên dùng)</option>
                  <option value="gemini-3.8-flash">⚡ gemini-3.8-flash (Google Gemini 3.8 Flash - Thế hệ mới nhất)</option>
                  <option value="gemini-3.5-flash-lite">🌱 gemini-3.5-flash-lite (Google Gemini 3.5 Flash Lite - Siêu nhẹ & tiết kiệm)</option>
                  <option value="gemini-1.5-flash">⚡ gemini-1.5-flash (Google Gemini 1.5 Flash - Tốc độ cao, ổn định)</option>
                  <option value="gemini-1.5-pro">🧠 gemini-1.5-pro (Google Gemini 1.5 Pro - Phân tích chuyên sâu)</option>
                  <option value="gemini-2.0-flash">⚠️ gemini-2.0-flash (Google đã chuyển giao sang 3.6 Flash / 1.5 Flash)</option>
                </>
              )}
              {aiProvider === 'openai' && (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini (Khuyên dùng)</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </>
              )}
              {aiProvider === 'groq' && (
                <>
                  <option value="llama-3.3-70b-versatile">🥇 llama-3.3-70b-versatile (Meta Llama 3.3 70B - Cực nhanh & Chuẩn xác nhất - Khuyên dùng)</option>
                  <option value="llama-3.1-8b-instant">⚡ llama-3.1-8b-instant (Meta Llama 3.1 8B - Siêu tốc, Nhẹ & Miễn phí)</option>
                  <option value="gemma2-9b-it">🌱 gemma2-9b-it (Google Gemma 2 9B trên Groq LPU)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* KHUNG THÊM API KEY MỚI */}
        <div style={{
          marginBottom: '20px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>➕</span> Thêm API Key Mới ({aiProvider.toUpperCase()}) Vào Dàn:
            </label>
            <span style={{ fontSize: '11.5px', color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '3px 10px', borderRadius: '6px', fontWeight: 600 }}>
              🛡️ Thêm từng cái hoặc dán nhiều key — Tự động gộp vào dàn, không ghi đè mất key cũ
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <textarea
              rows={2}
              value={groqKeysInput}
              onChange={(e) => setGroqKeysInput(e.target.value)}
              placeholder={
                aiProvider === 'gemini' ? "Dán Gemini API Key mới tại đây (VD: AIzaSy... hoặc AQ...). Hỗ trợ nhập 1 key hoặc dán nhiều key (mỗi key 1 dòng)..." :
                aiProvider === 'openai' ? "Dán OpenAI API Key mới tại đây (VD: sk-proj-...). Hỗ trợ nhập 1 key hoặc dán nhiều key (mỗi key 1 dòng)..." :
                "Dán Groq API Key mới tại đây (VD: gsk_...). Hỗ trợ nhập 1 key hoặc dán nhiều key (mỗi key 1 dòng)..."
              }
              style={{
                flex: '1 1 380px',
                minWidth: '280px',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #94a3b8',
                fontFamily: 'monospace',
                fontSize: '12.5px',
                boxSizing: 'border-box',
                background: '#ffffff',
                lineHeight: 1.4
              }}
            />
            <button
              onClick={handleSaveAIKeys}
              style={{
                padding: '10px 20px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
              }}
            >
              <span>➕</span> Thêm Key Vào Dàn ({aiProvider.toUpperCase()})
            </button>
          </div>

          {aiProvider === 'gemini' && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#1e40af' }}>
                🔑 Chưa có Gemini API Key? Google cho phép tạo miễn phí không cần thẻ tín dụng:
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '4px 10px', borderRadius: '4px', textDecoration: 'none', border: '1px solid #93c5fd' }}
              >
                👉 Lấy Key tại aistudio.google.com ↗
              </a>
            </div>
          )}
        </div>

        {/* BẢNG QUẢN LÝ TOÀN BỘ DÀN KEYS ĐANG HOẠT ĐỘNG TRONG DATABASE */}
        {(() => {
          const geminiCount = databaseKeys.filter(k => k.provider === 'gemini').length;
          const groqCount = databaseKeys.filter(k => k.provider === 'groq').length;
          const openaiCount = databaseKeys.filter(k => k.provider === 'openai').length;

          const displayKeys = databaseKeys.filter(item => {
            if (tableFilter === 'all') return true;
            return item.provider === tableFilter;
          });

          return (
            <div style={{ marginBottom: '20px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              {/* HEADER BẢNG VỚI BỘ LỌC TABS */}
              <div style={{
                background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    📋 BẢNG QUẢN LÝ DÀN KEYS ĐANG HOẠT ĐỘNG ({displayKeys.length} / {databaseKeys.length} Keys)
                  </span>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, background: '#dcfce7', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '12px' }}>
                    🟢 VERIFIED IN DB
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowFullKeys(!showFullKeys)}
                    style={{
                      background: showFullKeys ? '#fef3c7' : '#ffffff',
                      color: showFullKeys ? '#92400e' : '#334155',
                      border: `1px solid ${showFullKeys ? '#fde68a' : '#cbd5e1'}`,
                      padding: '5px 10px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {showFullKeys ? '🔒 Che Bớt Key (Mask)' : '👁️ Hiển Thị Toàn Bộ API Key'}
                  </button>
                  <button
                    onClick={verifyAndLoadFromDB}
                    title="Đọc lại database và cập nhật số liệu mới nhất"
                    style={{
                      background: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '5px 10px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🔄 Làm Mới
                  </button>
                </div>
              </div>

              {/* BỘ LỌC TABS THEO NHÀ CUNG CẤP */}
              <div style={{
                background: '#f1f5f9', padding: '8px 16px', borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
                  Bộ lọc Provider:
                </span>
                {[
                  { id: 'all', label: `Tất cả (${databaseKeys.length})` },
                  { id: 'gemini', label: `🥇 Google Gemini (${geminiCount})` },
                  { id: 'groq', label: `⚡ Groq Cloud (${groqCount})` },
                  { id: 'openai', label: `🟢 OpenAI (${openaiCount})` }
                ].map(tab => {
                  const isActive = tableFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setTableFilter(tab.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: isActive ? 700 : 500,
                        border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: isActive ? '#2563eb' : '#ffffff',
                        color: isActive ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '9px 12px' }}>#</th>
                      <th style={{ padding: '9px 12px' }}>API Key</th>
                      <th style={{ padding: '9px 12px' }}>Nhà Cung Cấp</th>
                      <th style={{ padding: '9px 12px' }}>Model Active</th>
                      <th style={{ padding: '9px 12px' }}>📊 Số Lần Đã Dùng</th>
                      <th style={{ padding: '9px 12px' }}>💰 Giá Vốn / 1M Tokens</th>
                      <th style={{ padding: '9px 12px' }}>Vai Trò</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayKeys.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '28px 16px', textAlign: 'center', color: '#64748b' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                            Chưa có API Key nào {tableFilter !== 'all' ? `cho ${tableFilter.toUpperCase()}` : 'trong hệ thống'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            Dán key mới vào ô nhập phía trên và bấm <strong>"➕ Thêm Key Vào Dàn"</strong> để bắt đầu sử dụng.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayKeys.map((item, idx) => {
                        const isDefaultModel = item.isDefault || (item.provider === aiProvider && item.model === selectedModel);
                        const masked = item.key.length > 12 ? `${item.key.substring(0, 8)}...${item.key.substring(item.key.length - 4)}` : item.key;
                        const usage = getUsageForModelOrProvider(item.model, item.provider);
                        const isCopied = copiedKeyId === item.id;

                        return (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: isDefaultModel ? '#f8faff' : '#ffffff' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#64748b' }}>#{idx + 1}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <code style={{
                                  fontFamily: 'monospace', fontSize: '11px', fontWeight: 600,
                                  color: isDefaultModel ? '#1e3a8a' : '#0f172a',
                                  background: isDefaultModel ? '#eff6ff' : '#f1f5f9',
                                  padding: '4px 8px', borderRadius: '4px',
                                  wordBreak: 'break-all',
                                  border: isDefaultModel ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                                }}>
                                  {showFullKeys ? item.key : masked}
                                </code>
                                <button
                                  onClick={() => copyKeyToClipboard(item.key, item.id)}
                                  title="Copy API Key này vào bộ nhớ tạm"
                                  style={{
                                    border: 'none',
                                    background: isCopied ? '#dcfce7' : '#e2e8f0',
                                    color: isCopied ? '#15803d' : '#334155',
                                    cursor: 'pointer',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {isCopied ? '✓ Đã copy' : '📋 Copy'}
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {item.provider === 'gemini' && (
                                <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '11px' }}>
                                  🥇 Google Gemini
                                </span>
                              )}
                              {item.provider === 'groq' && (
                                <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '11px' }}>
                                  ⚡ Groq Cloud
                                </span>
                              )}
                              {item.provider === 'openai' && (
                                <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '11px' }}>
                                  🟢 OpenAI
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#334155', fontWeight: 600 }}>
                              {item.model}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ fontWeight: 700, color: usage.calls > 0 ? '#1d4ed8' : '#64748b' }}>
                                    {usage.calls.toLocaleString()} lượt
                                  </span>
                                  {usage.today > 0 ? (
                                    <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 600 }}>
                                      (+{usage.today} hôm nay)
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                      0 hôm nay
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>
                                  (Model {item.model})
                                </span>
                                <button
                                  onClick={() => handleTestSampleOrder(item)}
                                  disabled={testingKey}
                                  title="Gọi model bóc tách thử 1 đơn hàng mẫu để kiểm tra và tăng số lượt dùng"
                                  style={{
                                    marginTop: '4px',
                                    padding: '2px 8px',
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    cursor: testingKey ? 'not-allowed' : 'pointer',
                                    width: 'fit-content'
                                  }}
                                >
                                  ⚡ Bóc tách thử 1 đơn
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {(() => {
                                const rate = costRates.find(r => r.model_name === item.model || (r.model_name && item.model && r.model_name.toLowerCase() === item.model.toLowerCase()));
                                if (!rate || rate.input_cost_per_million == null) {
                                  return (
                                    <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                      N/A (Chưa cấu hình)
                                    </span>
                                  );
                                }
                                return (
                                  <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                                      Vào: {Number(rate.input_cost_per_million).toLocaleString()} {rate.currency || 'VND'}
                                    </span>
                                    <span style={{ color: '#475569' }}>
                                      Ra: {Number(rate.output_cost_per_million).toLocaleString()} {rate.currency || 'VND'}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {(() => {
                                const sameProviderKeys = databaseKeys.filter(k => k.provider === item.provider);
                                const keyIndexInProvider = sameProviderKeys.findIndex(k => k.key === item.key);
                                if (isDefaultModel) {
                                  if (keyIndexInProvider === 0) {
                                    return (
                                      <span style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        🥇 Mặc Định Hệ Thống (Key #1)
                                      </span>
                                    );
                                  }
                                  return (
                                    <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      🔄 Dàn Mặc Định (Key Gánh Tải #{keyIndexInProvider + 1})
                                    </span>
                                  );
                                }
                                if (keyIndexInProvider === 0) {
                                  return (
                                    <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                      ⚡ Dự Phòng Tự Động
                                    </span>
                                  );
                                }
                                return (
                                  <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                    ⚡ Dàn Dự Phòng (Key #{keyIndexInProvider + 1})
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                {!isDefaultModel && (
                                  <button
                                    onClick={() => handleSetDefaultModel(item)}
                                    title="Đặt model này làm mặc định chính của toàn hệ thống"
                                    style={{
                                      background: '#eff6ff',
                                      color: '#2563eb',
                                      border: '1px solid #bfdbfe',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    ⭐ Đặt Mặc Định
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemoveKeyItem(item)}
                                  style={{ background: '#fee2e2', color: '#be123c', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                >
                                  🗑️ Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* CHÚ THÍCH MINH BẠCH VỀ ENGINE AI & SỐ LƯỢT GỌI */}
              <div style={{
                background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                padding: '10px 16px', fontSize: '11.5px', color: '#64748b',
                display: 'flex', flexDirection: 'column', gap: '4px'
              }}>
                <div style={{ fontWeight: 700, color: '#334155' }}>
                  💡 Giải thích trạng thái hoạt động & phân phối lượt gọi AI:
                </div>
                <div>
                  • <strong>Tại sao Gemini có 65 lượt còn Groq có 0 lượt?</strong> Toàn bộ 65 lượt hiển thị được thống kê từ lịch sử bóc tách trước đây qua Gemini (gồm cả các đơn bóc tách qua ảnh chụp màn hình Multimodal). Khi bạn đặt Groq làm mặc định, các đơn văn bản mới gửi từ Extension sẽ tự động chạy qua Groq và tăng số lượt cho Groq.
                </div>
                <div>
                  • <strong>Tác vụ bóc tách hình ảnh (Vision):</strong> Luôn tự động dùng Google Gemini Vision để nhận diện chữ tiếng Việt viết tay/hóa đơn mờ chuẩn nhất.
                </div>
                <div>
                  • <strong>Dàn Keys Gánh Tải (Multi-Key Pool):</strong> Khi có nhiều key trong cùng một nhà cung cấp, hệ thống tự động xoay vòng phân phối tải để tránh bị nghẽn hạn ngạch (Rate Limit 429).
                </div>
              </div>
            </div>
          );
        })()}

        {/* BANNER CHUYỂN TIẾP DỰ PHÒNG THÔNG MINH (Smart Cross-Provider Fallback) */}
        <div style={{
          marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: '8px', padding: '14px 16px', fontSize: '12.5px'
        }}>
          <div style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5, marginBottom: '10px' }}>
            Hệ thống luôn ưu tiên chạy <strong>Model Mặc Định</strong> bạn chỉ định (Smart Cross-Provider Fallback). Nếu model chính gặp sự cố (hết hạn ngạch 429, mã model bị hạ cấp 404, hoặc máy chủ nhà cung cấp bị nghẽn 502/503), <strong>AI Gateway sẽ tự động gọi sang Model của nhà cung cấp dự phòng tiếp theo ngay lập tức</strong> mà không làm gián đoạn hay phát sinh lỗi bóc tách đơn hàng của Shop!
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: '6px', padding: '5px 12px', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>🥇 ƯU TIÊN MẶC ĐỊNH:</span> <strong>{selectedModel}</strong> ({aiProvider.toUpperCase()})
            </div>
            <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '13px' }}>──(nếu lỗi)──&gt;</span>
            <div style={{ background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa', borderRadius: '6px', padding: '5px 12px', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>⚡ DỰ PHÒNG 1:</span> <strong>{aiProvider === 'gemini' ? 'llama-3.3-70b-versatile (GROQ)' : 'gemini-3.6-flash (GEMINI)'}</strong>
            </div>
            <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '13px' }}>──(nếu lỗi)──&gt;</span>
            <div style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 12px', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>🟢 DỰ PHÒNG 2:</span> <strong>gpt-4o-mini (OPENAI)</strong>
            </div>
          </div>
        </div>

        {/* CÔNG CỤ TEST HỆ THỐNG */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleTestConnection}
            disabled={testingKey}
            style={{
              padding: '9px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1',
              borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: testingKey ? 'not-allowed' : 'pointer'
            }}
          >
            🧪 Kiểm Tra Kết Nối (Ping Key Đang Chọn)
          </button>
          <button
            onClick={() => handleTestSampleOrder()}
            disabled={testingKey}
            style={{
              padding: '9px 16px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
              borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: testingKey ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}
          >
            ⚡ Bóc Tách Thử 1 Đơn Mẫu (Live AI)
          </button>
        </div>
      </div>

      {/* KHU VỰC 2: CẤU HÌNH LUẬT PROMPT AI DÙNG CHUNG MẶC ĐỊNH */}
      <div
        id="sec-prompt-rules"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #f59e0b',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          scrollMarginTop: '20px'
        }}
      >
        {/* HEADER KHU VỰC 2 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              📜
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  background: '#d97706',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px'
                }}>
                  KHU VỰC 2
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Cấu Hình Luật AI Prompt Dùng Chung (Toàn Hệ Thống)
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                Nhập các quy tắc bóc tách AI tùy chỉnh dùng chung mặc định cho toàn hệ thống. Nếu một Shop không cấu hình luật riêng, hệ thống sẽ tự động áp dụng luật này.
              </p>
            </div>
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: defaultPromptRules ? '#15803d' : '#64748b',
            background: defaultPromptRules ? '#f0fdf4' : '#f8fafc',
            padding: '6px 14px',
            borderRadius: '20px',
            border: `1px solid ${defaultPromptRules ? '#bbf7d0' : '#e2e8f0'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            {defaultPromptRules ? '🟢 Đang áp dụng' : '⚪ Luật mặc định'}
          </span>
        </div>

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
              rows={5}
              value={defaultPromptRules}
              onChange={(e) => setDefaultPromptRules(e.target.value)}
              placeholder="Ví dụ: 'Luôn lấy tiền thu hộ là 0 nếu khách hàng đã thanh toán trước', 'Nếu không có tên khách hàng, hãy điền tên người gửi là Nguyễn Văn A'..."
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                fontSize: '13px', boxSizing: 'border-box', background: '#f8fafc', resize: 'vertical', minHeight: '120px', lineHeight: 1.5
              }}
            />
          </div>

          <div>
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
                borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: defaultPromptRulesSaving ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              {defaultPromptRulesSaving ? 'Đang lưu...' : '💾 Lưu Luật Prompt Mặc Định'}
            </button>
          </div>
        </div>

      {/* KHU VỰC 3: QUẢN LÝ HẠN MỨC QUOTA THEO SHOP */}
      <div
        id="sec-shop-quotas"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          scrollMarginTop: '20px'
        }}
      >
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: '4px solid #16a34a',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          {/* HEADER KHU VỰC 3 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '16px',
            marginBottom: '20px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0
              }}>
                🏢
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px'
                  }}>
                    KHU VỰC 3
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Quản Lý Hạn Ngạch Quota & Gói Cước Theo Cửa Hàng
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                  Điều chỉnh gói dịch vụ (Plan) và giới hạn số lượt bóc tách đơn hàng AI tối đa trong chu kỳ cho từng Shop.
                </p>
              </div>
            </div>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#16a34a',
              background: '#f0fdf4',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid #bbf7d0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              🏬 {shops.length} Cửa Hàng
            </span>
          </div>

            {message.text && (
              <div style={{ padding: '10px 12px', marginBottom: '16px', borderRadius: '6px', fontSize: '13px', background: message.type === 'error' ? '#fee2e2' : '#dcfce7', color: message.type === 'error' ? '#991b1b' : '#166534' }}>
                {message.text}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Chọn Cửa Hàng Cần Cấu Hình:
              </label>
              <select
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', background: '#fff', color: '#0f172a', fontWeight: 600 }}
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '18px' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#16a34a', marginBottom: '4px' }}>Hạn Mức AI (Lượt)</label>
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

            <div>
              <button
                onClick={handleSaveQuota}
                disabled={saving || !selectedShopId}
                style={{ padding: '9px 18px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: (saving || !selectedShopId) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {saving ? 'Đang lưu...' : '💾 Lưu Quota Shop'}
              </button>
            </div>
          </div>

          {/* TOP 10 SHOP DÙNG AI & ĐIỀU PHỐI QUOTA */}
          <QuotaOverview />
        </div>

      {/* KHU VỰC 4: QUẢN LÝ SUPABASE DATABASE & BẢO MẬT HỆ THỐNG */}
      <div
        id="sec-supabase-db"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: `4px solid ${dbStatusInfo.synced ? '#0f766e' : '#b91c1c'}`,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          scrollMarginTop: '20px'
        }}
      >
        {/* HEADER KHU VỰC 4 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: dbStatusInfo.synced ? '#f0fdfa' : '#fef2f2',
              border: `1px solid ${dbStatusInfo.synced ? '#99f6e4' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}>
              🗄️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  background: dbStatusInfo.synced ? '#0f766e' : '#b91c1c',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px'
                }}>
                  KHU VỰC 4
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Trạng Thái Kết Nối & Quản Lý Cơ Sở Dữ Liệu Supabase
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                Giám sát kết nối bảng <code>system_configs</code>, kiểm tra phân quyền Row Level Security (RLS) và sao chép script phân quyền.
              </p>
            </div>
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: '20px',
            background: dbStatusInfo.synced ? '#ecfdf5' : '#fee2e2',
            color: dbStatusInfo.synced ? '#047857' : '#991b1b',
            border: `1px solid ${dbStatusInfo.synced ? '#a7f3d0' : '#fca5a5'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            {dbStatusInfo.synced ? '🟢 ĐÃ ĐỒNG BỘ 100% (LIVE)' : '🔴 CHƯA ĐỒNG BỘ DB'}
          </span>
        </div>

          {/* Grid thông tin chi tiết bảng system_configs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Tên Bảng Dữ Liệu</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>public.system_configs</div>
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>Lưu trữ an toàn các Provider Keys</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Tổng Số Keys Trong DB</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{databaseKeys.length} Keys</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{geminiKeysCount} Gemini · {groqKeysCount} Groq · {openaiKeysCount} OpenAI</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Lần Xác Thực Gần Nhất</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{dbStatusInfo.lastUpdated}</div>
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>Tự động kiểm tra sau mỗi thao tác</div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Chính Sách Bảo Mật (RLS)</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>SYSTEM_ADMIN ONLY</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Chặn hoàn toàn đọc công khai (Zero Leak)</div>
            </div>
          </div>

          {/* Hướng Dẫn Sửa Quyền RLS và Mã SQL Editor */}
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px',
            fontSize: '12.5px', color: '#92400e'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span>🛡️</span> Hướng Dẫn Kiểm Tra Quyền & Sửa Lỗi RLS Bảng <code>system_configs</code>:
              </div>
              <button
                onClick={copySqlGuide}
                style={{
                  background: '#d97706', color: '#fff', border: 'none', padding: '6px 14px',
                  borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px',
                  display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}
              >
                📋 Copy Mã SQL Cho Supabase SQL Editor
              </button>
            </div>
            <p style={{ margin: '0 0 10px 0', lineHeight: 1.5, color: '#78350f' }}>
              Bảng <strong>system_configs</strong> chỉ cho phép quản trị viên cấp cao (SYSTEM_ADMIN) thao tác. Nếu bạn gặp lỗi <code>ACCESS_DENIED</code>, <code>401</code> hoặc <code>403</code>, hãy dán đoạn mã bên dưới vào <strong>Supabase Dashboard &rarr; SQL Editor</strong> và ấn Run:
            </p>
            <pre style={{
              background: '#fef3c7', border: '1px solid #fcd34d', padding: '12px',
              borderRadius: '6px', fontSize: '11.5px', overflowX: 'auto', margin: 0,
              fontFamily: 'monospace', color: '#78350f'
            }}>
              {FIX_SQL_SCRIPT}
            </pre>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
