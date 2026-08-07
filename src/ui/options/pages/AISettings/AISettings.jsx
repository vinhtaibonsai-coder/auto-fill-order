import React, { useState, useEffect } from 'react';
import { OrderStorage } from '../../../../application/storage.js';

export default function AISettings() {
  const [config, setConfig] = useState({
    confidenceThreshold: 90,
    autoCorrect: true,
    promptRules: '',
    groqApiKey: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    async function loadConfig() {
      try {
        const promptKey = await OrderStorage._getScopedKey('customAiPrompt');
        const apiKeyKey = await OrderStorage._getScopedKey('groqApiKey');
        
        chrome.storage.local.get([promptKey, apiKeyKey], (result) => {
          setConfig(prev => ({
            ...prev,
            promptRules: result[promptKey] || '',
            groqApiKey: result[apiKeyKey] || ''
          }));
          setIsLoading(false);
        });
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
      const promptKey = await OrderStorage._getScopedKey('customAiPrompt');
      const apiKeyKey = await OrderStorage._getScopedKey('groqApiKey');
      
      await new Promise(resolve => {
        chrome.storage.local.set({
          [promptKey]: config.promptRules.trim(),
          [apiKeyKey]: config.groqApiKey.trim()
        }, resolve);
      });
      
      setSaveStatus('✅ Đã lưu cấu hình!');
      setTimeout(() => setSaveStatus(''), 3000);
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

      <div className="card" style={{ maxWidth: '600px' }}>
        
        {/* REMOVED: Local Groq API Key field to comply with Master Architecture v2 Rule 02 (Never expose Groq key to client) */}
        <div style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary)', padding: '10px', background: '#f9f9f9' }}>
          <h3 style={{ marginTop: 0, marginBottom: '8px' }}>AI Model Policy</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Hệ thống đang sử dụng cấu hình AI tự động từ Server (AI Gateway). Mọi truy vấn sẽ được định tuyến an toàn qua Supabase Cloud để đảm bảo bảo mật.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Custom AI Prompt Rules</label>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
            Thêm các chỉ dẫn đặc biệt để ép AI bóc tách theo ý bạn (VD: "Mặc định tiền thu hộ là 0").
          </div>
          <textarea 
            value={config.promptRules}
            onChange={(e) => setConfig({...config, promptRules: e.target.value})}
            style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', height: '100px', resize: 'vertical' }}
            placeholder="Ví dụ: Ưu tiên bắt số điện thoại ở cuối câu..."
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
