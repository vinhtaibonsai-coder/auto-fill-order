import React, { useState, useEffect } from 'react';
import { OrderStorage } from '../../../../application/storage.esm.js';
import { AuthService } from '../../../../domain/auth/auth.service.esm.js';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function AISettings() {
  const [config, setConfig] = useState({
    confidenceThreshold: 90,
    autoCorrect: true,
    promptRules: ''
  });
  const [budget, setBudget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const getActiveShopId = async () => {
    const activeShop = await OrderStorage.getActiveShop();
    return activeShop ? String(activeShop.id || activeShop) : '';
  };

  useEffect(() => {
    async function loadConfig() {
      try {
        const activeShopId = await getActiveShopId();
        const configRes = await globalThis.SupabaseCloud.loadConfig();
        const sess = await AuthSession.getSession();
        const token = sess ? sess.access_token : null;

        let fetchedPromptRules = '';
        let threshold = 90;
        let autoCorrect = true;
        if (activeShopId) {
          const flags = await AuthService.fetchShopFeatureFlags(activeShopId);
          if (flags) {
            if (flags.custom_prompt_rules) fetchedPromptRules = flags.custom_prompt_rules;
            if (flags.ai_confidence_threshold !== null && flags.ai_confidence_threshold !== undefined) threshold = Number(flags.ai_confidence_threshold);
            if (flags.ai_auto_correct !== null && flags.ai_auto_correct !== undefined) autoCorrect = !!flags.ai_auto_correct;
          }
        }

        // Quota thật từ get_ai_budget
        if (token && activeShopId && !token.startsWith('local_dev_token_')) {
          try {
            const res = await fetch(`${configRes.url}/rest/v1/rpc/get_ai_budget`, {
              method: 'POST',
              headers: {
                'apikey': configRes.anonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ p_shop_id: activeShopId })
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.success) setBudget(data);
            }
          } catch (e) {
            console.warn('Lỗi tải AI budget:', e);
          }
        }

        setConfig({ confidenceThreshold: threshold, autoCorrect, promptRules: fetchedPromptRules });
        setIsLoading(false);
      } catch (err) {
        console.error('Lỗi khi tải cấu hình AI:', err);
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaveStatus('Đang lưu...');
    try {
      const activeShopId = await getActiveShopId();
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      const token = sess ? sess.access_token : null;

      let savedCloud = false;
      if (token && activeShopId && !token.startsWith('local_dev_token_')) {
        const res = await fetch(`${configRes.url}/rest/v1/shop_feature_flags?shop_id=eq.${activeShopId}`, {
          method: 'PATCH',
          headers: {
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            ai_confidence_threshold: Number(config.confidenceThreshold) || 90,
            ai_auto_correct: !!config.autoCorrect
          })
        });
        savedCloud = res.ok;
      }

      // Đồng bộ local cho mọi context (fallback khi offline)
      await new Promise(resolve => {
        chrome.storage.local.set({
          ai_confidence_threshold: Number(config.confidenceThreshold) || 90,
          ai_auto_correct: config.autoCorrect
        }, resolve);
      });

      setSaveStatus(savedCloud
        ? '✅ Đã lưu cấu hình AI lên Cloud và máy!'
        : '✅ Đã lưu cục bộ (Cloud chưa cập nhật — kiểm tra quyền OWNER).');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      setSaveStatus('❌ Lỗi khi lưu: ' + err.message);
    }
  };

  if (isLoading) return <div>Đang tải...</div>;

  return (
    <div>
      <h2 className="page-title">AI Parsing Settings</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Tùy chỉnh hành vi và độ nhạy của Trí tuệ nhân tạo (AI) khi bóc tách đơn hàng.
      </p>

      {budget && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '6px solid var(--primary)', background: '#f8fafc' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>AI QUOTA (THÁNG)</div>
          <div style={{ display: 'flex', gap: '40px', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)' }}>
                {budget.monthly_remaining} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {budget.monthly_limit}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lượt AI còn lại tháng này</div>
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)' }}>
                {budget.daily_remaining} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {budget.daily_limit}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lượt AI còn lại hôm nay</div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px' }}>

        {/* REMOVED: Local Groq API Key field to comply with Master Architecture v2 Rule 02 (Never expose Groq key to client) */}
        <div style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary)', padding: '10px', background: '#f9f9f9' }}>
          <h3 style={{ marginTop: 0, marginBottom: '8px' }}>AI Model Policy</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Hệ thống đang sử dụng cấu hình AI tự động từ Server (AI Gateway). Mọi truy vấn sẽ được định tuyến an toàn qua Supabase Cloud để đảm bảo bảo mật.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Custom AI Prompt Rules <span className="badge badge-warning" style={{fontSize:'10px', marginLeft:'8px'}}>Admin Managed</span></label>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
            Thiết lập này hiện được quản lý tập trung trên Trang Admin Dashboard. Extension sẽ tự động đồng bộ xuống Shop của bạn.
          </div>
          <textarea
            value={config.promptRules}
            readOnly
            disabled
            style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', height: '100px', resize: 'vertical', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            placeholder="Chưa có quy tắc nào được thiết lập từ Admin..."
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Confidence Threshold (%)</label>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
            Hiển thị cảnh báo nếu độ tự tin của AI thấp hơn mức này.
          </div>
          <input
            type="number"
            value={config.confidenceThreshold}
            onChange={(e) => setConfig({...config, confidenceThreshold: e.target.value})}
            style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={config.autoCorrect}
              onChange={(e) => setConfig({...config, autoCorrect: e.target.checked})}
            />
            Bật tính năng Tự động sửa lỗi (Auto-Correct)
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={handleSave}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
          >
            Lưu cấu hình AI
          </button>
          {saveStatus && <span style={{ fontSize: '14px', fontWeight: 600, color: saveStatus.includes('✅') ? 'var(--success)' : 'var(--text-main)' }}>{saveStatus}</span>}
        </div>
      </div>
    </div>
  );
}
