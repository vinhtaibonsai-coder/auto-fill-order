import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Brain, Cpu, ShieldCheck, Check, AlertCircle, RefreshCw, Layers, Copy, CheckCheck, Eye, Terminal, FileText, ChevronDown, ChevronUp, Cloud } from 'lucide-react';
import { OrderStorage } from '../../../../application/storage.esm.js';
import { AuthService } from '../../../../domain/auth/auth.service.esm.js';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

// Prompt chuẩn mặc định của hệ thống AI Gateway trên Cloud Server
const DEFAULT_SYSTEM_PROMPTS = {
  parse: `Bạn là một trợ lý AI chuyên nghiệp chuyên bóc tách thông tin đơn hàng từ văn bản thô sang định dạng JSON.

Nhiệm vụ của bạn là đọc kỹ đoạn văn bản thô dưới đây và trích xuất các trường thông tin sau:
1. "name": Tên khách hàng (Họ và tên người nhận). Nếu không có tên rõ ràng hoặc không thể xác định chắc chắn (ví dụ: chỉ có tên hàng hoặc địa chỉ), hãy để chuỗi rỗng "". Tuyệt đối không tự bịa tên hoặc lấy tên sản phẩm, tên cửa hàng làm tên người nhận.
2. "phone": Số điện thoại người nhận. Chuẩn hóa thành chuỗi số điện thoại Việt Nam bắt đầu bằng 0, gồm 10 hoặc 11 chữ số (ví dụ: "0901234567"). Nếu có nhiều số điện thoại, ưu tiên số đầu tiên hợp lý.
3. "orderCode": Mã đơn hàng của shop hoặc mã quản lý đơn hàng (ví dụ: "DH123456", "e100.377"). Tuyệt đối KHÔNG lấy số điện thoại, số nhà, số căn hộ, mã zip, số tiền, hoặc chữ "Cod", "COD" kèm số tiền thu hộ làm mã đơn hàng. Nếu không có mã đơn hàng rõ ràng, để chuỗi rỗng "".
4. "codAmount": Số tiền thu hộ (COD) dưới dạng số nguyên (ví dụ: 150000). 
   - Hỗ trợ nhận diện các ký hiệu viết tắt như "150k" -> 150000, "150.000đ" -> 150000, "150,000" -> 150000.
   - Chú ý cách viết tiền thu hộ dạng "1.700k" hay "1,700k" nghĩa là 1700k (1700000 - 1 triệu 700 nghìn đồng), tuyệt đối không được bóc tách nhầm thành 170000 (trăm bảy mươi nghìn) hay 1700.
   - Nếu đơn hàng có các từ chỉ trạng thái đã thanh toán trước như "chuyển khoản", "đã ck", "ck", "đã thanh toán", "đã chuyển khoản", "paid", "free", hoặc "0đ", hãy đặt codAmount = 0.
   - Nếu không đề cập đến tiền thu hộ, đặt mặc định là 0.
5. "correctAddress": Địa chỉ nhận hàng đầy đủ và chính xác nhất (bao gồm số nhà, tên đường, ngõ, ngách, tên cửa hàng/tòa nhà/chung cư, phường/xã, quận/huyện, tỉnh/thành phố). Mở rộng các từ viết tắt địa danh (vd: HN -> Hà Nội, HCM -> Hồ Chí Minh). KHÔNG tự ý bịa thêm Phường/Xã/Quận/Huyện nếu không có thông tin trong văn bản.

YÊU CẦU ĐẦU RA:
- Chỉ trả về duy nhất một đối tượng JSON hợp lệ, KHÔNG bọc trong markdown (\`\`\`json ... \`\`\`), KHÔNG có giải thích thêm.
- Cấu trúc JSON bắt buộc:
{
  "name": "...",
  "phone": "...",
  "orderCode": "...",
  "codAmount": 0,
  "correctAddress": "..."
}`,

  address: `Bạn là chuyên gia chuẩn hóa địa chỉ Việt Nam. Hãy tách địa chỉ sau thành cấu trúc JSON có các trường: street, ward, district, province.

YÊU CẦU:
- street PHẢI chứa ĐẦY ĐỦ: số nhà, tên đường, tên cửa hàng/cơ sở, tòa nhà, khu đô thị (vd "579/43 Đường Quang Trung", "S202 Vinhomes Smart City").
- ward, district, province đầy đủ, đúng chính tả.
- Nếu địa chỉ viết tắt (HN, HCM...) hãy mở rộng.
- Tuyệt đối KHÔNG bỏ sót số nhà, tên đường, tên cửa hàng; tất cả trong 4 trường trên.
- Nếu có tên cửa hàng/cơ sở, đưa vào street.

JSON format:
{
  "street": "...",
  "ward": "...",
  "district": "...",
  "province": "..."
}`,

  vision: `Bạn là chuyên gia trích xuất đơn hàng từ hình ảnh (ảnh chụp màn hình Zalo/Facebook, hóa đơn viết tay, phiếu gửi hàng).
Hãy phân tích kỹ hình ảnh và bóc tách thông tin khách hàng sang cấu trúc JSON:
1. "name": Tên khách hàng (Họ và tên người nhận). Nếu không có tên rõ ràng hoặc chữ quá mờ, để chuỗi rỗng "".
2. "phone": Số điện thoại người nhận (10 hoặc 11 số, bắt đầu bằng 0).
3. "orderCode": Mã đơn hàng của shop (nếu có trên ảnh), nếu không có để "".
4. "codAmount": Số tiền thu hộ COD dưới dạng số nguyên (vd: 150000). Chú ý cách viết triệu (1tr5 -> 1500000), k (250k -> 250000). Nếu là chuyển khoản hoặc đã thanh toán, để 0.
5. "correctAddress": Địa chỉ nhận hàng đầy đủ nhất (số nhà, tên đường, thôn, xóm, phường/xã, quận/huyện, tỉnh/thành phố). Mở rộng viết tắt (HN -> Hà Nội, HCM -> Hồ Chí Minh).
6. "productItem": Tên sản phẩm / số lượng hàng hóa cần giao.
7. "extraNote": Ghi chú giao hàng.

JSON format:
{
  "name": "...",
  "phone": "...",
  "orderCode": "...",
  "codAmount": 0,
  "correctAddress": "...",
  "productItem": "...",
  "extraNote": "..."
}`
};

export default function AISettings() {
  const [config, setConfig] = useState({
    confidenceThreshold: 90,
    ocrConfidenceThreshold: 80,
    autoCorrect: true,
    autoVerify: true,
    enablePerfTelemetry: false,
    promptRules: ''
  });
  const [budget, setBudget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeShopName, setActiveShopName] = useState('');
  const [activeShopId, setActiveShopId] = useState('');
  const [activePromptTab, setActivePromptTab] = useState('parse'); // 'parse' | 'address' | 'custom'
  const [copiedKey, setCopiedKey] = useState('');
  const [cloudSynced, setCloudSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', text: '' });

  const showToast = (text, type = 'success') => {
    setSaveStatus({ type, text });
    setTimeout(() => setSaveStatus({ type: '', text: '' }), 4000);
  };

  const getActiveShopId = async () => {
    const activeShop = await OrderStorage.getActiveShop();
    return activeShop ? String(activeShop.id || activeShop) : '';
  };

  const saveLocalAiConfig = (payload) => new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(payload, resolve);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      Object.entries(payload).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    }
    resolve();
  });

  const shouldUseAiBudgetRpc = () => {
    try {
      return typeof localStorage !== 'undefined'
        && localStorage.getItem('enable_get_ai_budget_rpc') === 'true';
    } catch (_) {
      return false;
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
    showToast('📋 Đã sao chép prompt vào clipboard!');
  };

  const normalizeBudget = (row = {}) => {
    const monthlyLimit = Number(row.ai_monthly_limit ?? row.monthly_limit ?? 0) || 0;
    const monthlyUsed = Number(row.ai_monthly_used ?? row.monthly_used ?? 0) || 0;
    const dailyLimit = Number(row.ai_daily_limit ?? row.daily_limit ?? 0) || 0;
    const dailyUsed = Number(row.ai_daily_used ?? row.daily_used ?? 0) || 0;
    return {
      success: true,
      monthly_remaining: Math.max(0, monthlyLimit - monthlyUsed),
      monthly_limit: monthlyLimit,
      daily_remaining: Math.max(0, dailyLimit - dailyUsed),
      daily_limit: dailyLimit
    };
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeShopId = await getActiveShopId();
      setActiveShopId(activeShopId);
      const configRes = await (globalThis.SupabaseCloud?.loadConfig?.() || Promise.resolve({ url: '', anonKey: '' }));
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : null;

      let fetchedPromptRules = '';
      let threshold = 90;
      let autoCorrect = true;

      // 1. Tải feature flags và custom prompt từ Supabase Cloud
      if (activeShopId) {
        try {
          const flags = await AuthService.fetchShopFeatureFlags(activeShopId);
          if (flags) {
            if (flags.custom_prompt_rules) fetchedPromptRules = flags.custom_prompt_rules;
            if (flags.ai_confidence_threshold !== null && flags.ai_confidence_threshold !== undefined) threshold = Number(flags.ai_confidence_threshold);
            if (flags.ai_auto_correct !== null && flags.ai_auto_correct !== undefined) autoCorrect = !!flags.ai_auto_correct;
            setCloudSynced(true);
          }
        } catch (e) {
          console.warn('[AISettings] Lỗi tải feature flags:', e);
        }

        // Lấy tên shop
        try {
          if (configRes?.url) {
            const shopRes = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/shops?id=eq.${activeShopId}&select=name`, {
              headers: { apikey: configRes.anonKey, Authorization: `Bearer ${token || configRes.anonKey}` }
            });
            if (shopRes.ok) {
              const shopData = await shopRes.json();
              if (shopData?.[0]?.name) setActiveShopName(shopData[0].name);
            }
          }
        } catch (_) {}
      }

      // 2. Quota thật từ shop_quotas
      if (token && activeShopId && !token.startsWith('local_dev_token_') && configRes?.url) {
        try {
          const res = await fetch(
            `${configRes.url.replace(/\/$/, '')}/rest/v1/shop_quotas?shop_id=eq.${activeShopId}&select=ai_monthly_limit,ai_monthly_used,ai_daily_limit,ai_daily_used`,
            { headers: { 'apikey': configRes.anonKey, 'Authorization': `Bearer ${token}` } }
          );
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows[0]) setBudget(normalizeBudget(rows[0]));
          }
        } catch (e) {
          console.warn('Lỗi tải AI budget:', e);
        }
      }

      if (shouldUseAiBudgetRpc() && token && activeShopId && !token.startsWith('local_dev_token_') && configRes?.url) {
        try {
          const res = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/rpc/get_ai_budget`, {
            method: 'POST',
            headers: {
              'apikey': configRes.anonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_shop_id: activeShopId })
          });
          if (res.ok) {
            const rpcData = await res.json();
            if (rpcData && rpcData.success) {
              setBudget({
                monthly_remaining: Number(rpcData.monthly_remaining || 0),
                monthly_limit: Number(rpcData.monthly_limit || 0),
                daily_remaining: Number(rpcData.daily_remaining || 0),
                daily_limit: Number(rpcData.daily_limit || 0)
              });
            }
          }
        } catch (e) {
          console.warn('Lỗi RPC get_ai_budget:', e);
        }
      }

      // 3. Fallback đọc local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['ai_confidence_threshold', 'ocr_confidence_threshold', 'ai_auto_correct', 'ai_auto_verify', 'enable_perf_telemetry'], (result) => {
          setConfig({
            confidenceThreshold: result.ai_confidence_threshold !== undefined ? result.ai_confidence_threshold : threshold,
            ocrConfidenceThreshold: result.ocr_confidence_threshold !== undefined ? Number(result.ocr_confidence_threshold) : 80,
            autoCorrect: result.ai_auto_correct !== undefined ? result.ai_auto_correct : autoCorrect,
            autoVerify: result.ai_auto_verify !== undefined ? Boolean(result.ai_auto_verify) : true,
            enablePerfTelemetry: result.enable_perf_telemetry !== undefined ? Boolean(result.enable_perf_telemetry) : false,
            promptRules: fetchedPromptRules
          });
          setIsLoading(false);
        });
      } else {
        setConfig({
          confidenceThreshold: threshold,
          ocrConfidenceThreshold: 80,
          autoCorrect: autoCorrect,
          autoVerify: true,
          enablePerfTelemetry: false,
          promptRules: fetchedPromptRules
        });
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Lỗi tải cấu hình AI:', err);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sId = activeShopId || await getActiveShopId();
      const configRes = await (globalThis.SupabaseCloud?.loadConfig?.() || Promise.resolve({ url: '', anonKey: '' }));
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : null;

      let savedCloud = false;
      if (token && sId && !token.startsWith('local_dev_token_') && configRes?.url) {
        const res = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/shop_feature_flags?shop_id=eq.${sId}`, {
          method: 'PATCH',
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            ai_confidence_threshold: Number(config.confidenceThreshold) || 90,
            ai_auto_correct: !!config.autoCorrect,
            custom_prompt_rules: config.promptRules || ''
          })
        });
        savedCloud = res.ok;
      }

      await saveLocalAiConfig({
        ai_confidence_threshold: Number(config.confidenceThreshold) || 90,
        ocr_confidence_threshold: Number(config.ocrConfidenceThreshold) || 80,
        ai_auto_correct: config.autoCorrect,
        ai_auto_verify: config.autoVerify !== undefined ? config.autoVerify : true,
        enable_perf_telemetry: Boolean(config.enablePerfTelemetry)
      });

      setCloudSynced(savedCloud);
      showToast(savedCloud
        ? '✅ Đã lưu cấu hình AI & Quy tắc Prompt lên Cloud toàn Shop!'
        : '✅ Đã lưu cục bộ vào máy trạm.');
    } catch (err) {
      showToast('❌ Lỗi khi lưu: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} className="animate-spin" /> Đang tải cấu hình AI & System Prompt từ Cloud...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="page-title" style={{ margin: 0 }}>Cấu Hình AI Bóc Tách Đơn</h2>
            {cloudSynced && (
              <span style={{
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                padding: '3px 10px',
                borderRadius: 8,
                fontSize: '11.5px',
                fontWeight: 700,
                border: '1px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Cloud size={13} /> Đồng bộ Cloud {activeShopName ? `(${activeShopName})` : ''}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>
            Tùy chỉnh hành vi, kiểm tra prompt mặc định của AI Gateway và thiết lập quy tắc bóc tách riêng cho Shop.
          </p>
        </div>

        <button
          onClick={loadConfig}
          disabled={isLoading}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Tải lại từ Cloud
        </button>
      </div>

      {saveStatus.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: 600,
          marginBottom: '20px',
          background: saveStatus.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
          color: saveStatus.type === 'error' ? 'var(--color-danger-text)' : 'var(--color-success-text)',
          border: `1px solid ${saveStatus.type === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {saveStatus.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
          {saveStatus.text}
        </div>
      )}

      {/* Quota KPI Card */}
      {budget && (
        <div className="card" style={{
          marginBottom: '20px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '18px 22px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Cpu size={15} color="var(--primary)" /> Hạn Mức AI Hàng Tháng (AI Gateway - Llama 3.3 70B / Gemini)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)' }}>
                {budget.monthly_remaining} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {budget.monthly_limit}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Lượt AI còn lại tháng này</div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)' }}>
                {budget.daily_remaining} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {budget.daily_limit}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Lượt AI còn lại hôm nay</div>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1.7fr)', gap: '20px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Controls & Custom Prompt Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Google Gemini 2.0 / 1.5 Flash Support Banner */}
          <div className="card" style={{
            padding: '18px 20px',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.7) 0%, rgba(219, 234, 254, 0.4) 100%)',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '14px', color: '#1e40af' }}>
                <span>🥇</span> Google Gemini 2.0 / 1.5 Flash (AI & Vision Toàn Hệ Thống)
              </div>
              <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #93c5fd' }}>
                Hỗ trợ ảnh & văn bản
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: '#334155', margin: '0 0 12px 0', lineHeight: '1.5' }}>
              Hệ thống đã tích hợp <strong>Google Gemini 2.0 Flash</strong> & <strong>1.5 Flash</strong>. Hỗ trợ bóc tách văn bản đơn hàng siêu tốc, nhận diện ảnh chụp màn hình Zalo, Facebook, hóa đơn và bưu gửi trực tiếp khi dán vào panel.
            </p>

            <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                📍 Nơi Điền API Key Cho Toàn Hệ Thống:
              </div>
              <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                Theo tiêu chuẩn bảo mật hệ thống, API Key nhà cung cấp AI được quản lý tập trung và mã hóa server-side tại Dashboard Quản trị. Quản trị viên (Master Admin) điền key 1 lần và toàn bộ nhân viên, máy trạm trong Shop đều tự động được hưởng quyền truy cập.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href="admin.html#/ai-platform"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                    background: '#2563eb',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(37,99,235,0.3)'
                  }}
                >
                  🚀 Mở Admin Dashboard (AI Platform & Quotas) →
                </a>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    border: '1px solid #93c5fd',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    textDecoration: 'none'
                  }}
                >
                  🔑 Lấy Google Gemini API Key miễn phí ↗
                </a>
              </div>
            </div>
          </div>

          {/* Policy Banner */}
          <div className="card" style={{
            padding: '18px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--card)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
              <Sparkles size={17} color="var(--primary)" /> Kiến Trúc AI Gateway
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '8px 0 0 0', lineHeight: '1.5' }}>
              Mọi yêu cầu bóc tách đơn và chuẩn hóa địa chỉ được bảo mật và định tuyến tự động qua <strong>Supabase Edge Function</strong> (Hỗ trợ <code>gemini-2.0-flash</code>, <code>gemini-1.5-flash</code> và <code>llama-3.3-70b-versatile</code>). Không lưu trữ văn bản riêng tư và tốc độ xử lý dưới 500ms.
            </p>
          </div>

          {/* Custom Rules Editor */}
          <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={17} color="var(--primary)" /> Quy Tắc Prompt Bổ Sung Của Shop
              </h3>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'var(--color-primary-light, #eff6ff)',
                color: 'var(--primary)',
                fontWeight: 700,
                border: '1px solid rgba(37, 99, 235, 0.2)'
              }}>
                Tùy biến Shop
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 12px 0', lineHeight: '1.4' }}>
              Nhập các yêu cầu riêng biệt của Shop bạn. Quy tắc này sẽ được tự động ghép nối vào System Prompt mặc định khi gọi AI.
            </p>

            <textarea
              value={config.promptRules}
              onChange={(e) => setConfig({ ...config, promptRules: e.target.value })}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                height: '130px',
                resize: 'vertical',
                background: 'var(--bg)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontFamily: 'monospace',
                lineHeight: '1.5',
                outline: 'none'
              }}
              placeholder="Ví dụ:&#10;- Shop bán mặt hàng Lúa Thuỷ Sinh, mã đơn thường có tiền tố 'E100.' hoặc 'ORD-'.&#10;- Nếu khách không ghi tên sản phẩm, mặc định sản phẩm là Lúa Thuỷ Sinh.&#10;- Không lấy số điện thoại phụ làm mã đơn hàng."
            />

            {/* Confidence Threshold */}
            <div style={{ marginTop: '18px' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '4px' }}>
                Ngưỡng Độ Tin Cậy Tối Thiểu Bóc Tách Text (%)
              </label>
              <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginBottom: '6px' }}>
                Hiển thị cảnh báo nếu độ tự tin nhận diện của AI thấp hơn mức này (khuyến nghị: 85% - 95%).
              </div>
              <input
                type="number"
                min="50"
                max="100"
                value={config.confidenceThreshold}
                onChange={(e) => setConfig({ ...config, confidenceThreshold: Number(e.target.value) })}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--card)',
                  color: 'var(--text-main)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            {/* OCR Vision Threshold (Phân nhánh Google Vision OCR vs Gemini Vision) */}
            <div style={{ marginTop: '16px', background: 'var(--bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '4px' }}>
                Ngưỡng Kích Hoạt Gemini Vision Khi Bóc Tách Ảnh (%)
              </label>
              <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginBottom: '6px' }}>
                Nếu độ nét Google Vision OCR &lt; mức này (mặc định: 80%), hệ thống tự động kích hoạt Gemini Vision Multimodal để đọc ảnh mờ/chữ viết tay.
              </div>
              <input
                type="number"
                min="40"
                max="95"
                value={config.ocrConfidenceThreshold}
                onChange={(e) => setConfig({ ...config, ocrConfidenceThreshold: Number(e.target.value) })}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--card)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>

            {/* Auto Correct Checkbox */}
            <div style={{ marginTop: '16px', background: 'var(--bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={config.autoCorrect}
                  onChange={(e) => setConfig({ ...config, autoCorrect: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                Bật Tự Động Chuẩn Hóa Địa Chỉ (Auto-Correct)
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '26px' }}>
                Tự động sửa lỗi sai chính tả Phường/Xã, Quận/Huyện dựa trên Từ điển địa chỉ 63 tỉnh thành.
              </div>
            </div>

            {/* Auto AI Verify Checkbox */}
            <div style={{ marginTop: '16px', background: 'var(--bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={config.autoVerify}
                  onChange={(e) => setConfig({ ...config, autoVerify: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                🤖 Tự Động Thẩm Định &amp; Đối Soát Bằng AI (Auto AI Verification)
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '26px' }}>
                Sau khi bóc tách cục bộ siêu tốc (0.01s), AI sẽ tự động chạy ngầm để đối soát lại toàn bộ Tên, SĐT, COD, Mã đơn, Địa chỉ và tự động sửa nếu có sai sót.
              </div>
            </div>

            {/* Dev/Diagnostic Perf Telemetry Toggle */}
            <div style={{ marginTop: '16px', background: 'var(--bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={config.enablePerfTelemetry}
                  onChange={(e) => setConfig({ ...config, enablePerfTelemetry: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                ⚡ Chế Độ Đo Lường Hiệu Năng &amp; Telemetry (Diagnostic / Perf Mode)
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '26px' }}>
                Hiển thị số đo độ trễ chi tiết (gatewayMs, parseMs, ocrMs, cacheHit) trong Console và Panel. Tuyệt đối không ghi nhận hay phát tán dữ liệu đơn hàng (Không PII). Mặc định: Tắt.
              </div>
            </div>

            {/* Privacy & Chrome Web Store Compliance Disclosure */}
            <div style={{ marginTop: '16px', background: '#f0fdf4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '12.5px', color: '#166534', marginBottom: '4px' }}>
                🛡️ Tuân Thủ Quyền Riêng Tư &amp; Bảo Vệ Dữ Liệu Cá Nhân
              </div>
              <div style={{ fontSize: '11.5px', color: '#14532d', lineHeight: '1.4' }}>
                Tiện ích ưu tiên bóc tách cục bộ siêu tốc (Local-First). Khi kích hoạt AI, dữ liệu chỉ dùng để chuẩn hóa biểu mẫu giao nhận, tuyệt đối không lưu trữ để huấn luyện AI cộng đồng hoặc chia sẻ cho bên thứ ba (Tuân thủ Nghị định 13/2023/NĐ-CP &amp; Chrome Web Store Policy).
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '14px', fontSize: '11.5px' }}>
                <a href="privacy.html" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 600 }}>
                  📄 Xem Chính Sách Bảo Mật (Privacy Policy)
                </a>
                <a href="terms.html" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 600 }}>
                  📜 Xem Điều Khoản Dịch Vụ (Terms)
                </a>
              </div>
            </div>

            {/* Action Button */}
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '11px 24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                }}
              >
                {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                {isSaving ? 'Đang lưu lên Cloud...' : 'Lưu Cấu Hình AI Toàn Shop'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: System Prompt Inspector & Cloud Template Preview */}
        <div className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={17} color="var(--primary)" /> Kiểm Tra Prompt Mặc Định Trên Cloud
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '3px 0 0 0' }}>
                Nguyên văn System Prompt đang được AI Gateway thực thi trực tiếp trên Server.
              </p>
            </div>

            {/* Copy Button */}
            <button
              onClick={() => {
                const textToCopy = activePromptTab === 'parse'
                  ? DEFAULT_SYSTEM_PROMPTS.parse
                  : (activePromptTab === 'address' ? DEFAULT_SYSTEM_PROMPTS.address : (config.promptRules || 'Chưa có quy tắc'));
                copyToClipboard(textToCopy, activePromptTab);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {copiedKey === activePromptTab ? <CheckCheck size={14} color="var(--success)" /> : <Copy size={14} />}
              {copiedKey === activePromptTab ? 'Đã sao chép!' : 'Sao chép Prompt'}
            </button>
          </div>

          {/* Prompt Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '14px' }}>
            <button
              onClick={() => setActivePromptTab('parse')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activePromptTab === 'parse' ? 'var(--primary)' : 'transparent',
                color: activePromptTab === 'parse' ? '#fff' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all .15s ease'
              }}
            >
              <FileText size={14} /> 1. Prompt Bóc Tách Đơn
            </button>
            <button
              onClick={() => setActivePromptTab('address')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activePromptTab === 'address' ? 'var(--primary)' : 'transparent',
                color: activePromptTab === 'address' ? '#fff' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all .15s ease'
              }}
            >
              <Layers size={14} /> 2. Prompt Chuẩn Hóa Địa Chỉ
            </button>
            <button
              onClick={() => setActivePromptTab('vision')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activePromptTab === 'vision' ? 'var(--primary)' : 'transparent',
                color: activePromptTab === 'vision' ? '#fff' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all .15s ease'
              }}
            >
              <Sparkles size={14} /> 3. Prompt Gemini Vision (Ảnh)
            </button>
          </div>

          {/* Prompt Code Viewer */}
          <div style={{
            background: '#0f172a',
            color: '#e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '12.5px',
            lineHeight: '1.6',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            maxHeight: '480px',
            overflowY: 'auto',
            border: '1px solid #334155',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {activePromptTab === 'parse' && DEFAULT_SYSTEM_PROMPTS.parse}
            {activePromptTab === 'address' && DEFAULT_SYSTEM_PROMPTS.address}
            {activePromptTab === 'vision' && DEFAULT_SYSTEM_PROMPTS.vision}
          </div>

          {/* Quick Guide */}
          <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
            💡 <strong>Cách hoạt động:</strong> Khi bạn bóc tách đơn, AI Gateway sẽ tải System Prompt này, sau đó ghép thêm <strong>Quy Tắc Prompt Bổ Sung</strong> của bạn vào cuối để tạo thành câu lệnh hoàn chỉnh gửi tới mô hình AI.
          </div>
        </div>

      </div>
    </div>
  );
}
