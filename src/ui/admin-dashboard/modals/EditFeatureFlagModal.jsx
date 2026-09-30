import React, { useState, useEffect } from 'react';
import { Flag, Globe, Layers, Store, User, Sliders, CheckCircle2, XCircle } from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminService } from '../../../domain/admin/admin.service.js';

const AVAILABLE_PLANS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'];

export default function EditFeatureFlagModal({
  open,
  flag = null, // null for create, object for edit
  shops = [],
  users = [],
  onClose,
  onSaved
}) {
  const isEdit = !!flag?.id;

  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [scopeType, setScopeType] = useState('global');
  const [planCode, setPlanCode] = useState('');
  const [targetPlans, setTargetPlans] = useState([]);
  const [shopId, setShopId] = useState('');
  const [userId, setUserId] = useState('');
  const [rolloutPercentage, setRolloutPercentage] = useState(100);
  const [isEnabled, setIsEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (flag) {
      setKey(flag.key || '');
      setDescription(flag.description || '');
      setScopeType(flag.scope_type || (flag.shop_id ? 'shop' : flag.plan_code ? 'plan' : flag.user_id ? 'user' : 'global'));
      setPlanCode(flag.plan_code || '');
      setTargetPlans(Array.isArray(flag.target_plans) ? flag.target_plans : []);
      setShopId(flag.shop_id || '');
      setUserId(flag.user_id || '');
      setRolloutPercentage(Number.isInteger(flag.rollout_percentage) ? flag.rollout_percentage : 100);
      setIsEnabled(flag.is_enabled !== undefined ? !!flag.is_enabled : true);
    } else {
      setKey('');
      setDescription('');
      setScopeType('global');
      setPlanCode('');
      setTargetPlans([]);
      setShopId('');
      setUserId('');
      setRolloutPercentage(100);
      setIsEnabled(true);
    }
    setError('');
  }, [flag, open]);

  if (!open) return null;

  const toggleTargetPlan = (plan) => {
    setTargetPlans(prev =>
      prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    if (!cleanKey) {
      setError('Vui lòng nhập Feature Key (Mã định danh cờ tính năng)');
      return;
    }

    if (scopeType === 'plan' && !planCode && targetPlans.length === 0) {
      setError('Vui lòng chọn ít nhất một gói cước (Plan) mục tiêu');
      return;
    }

    if (scopeType === 'shop' && !shopId) {
      setError('Vui lòng chọn Cửa Hàng (Shop) mục tiêu');
      return;
    }

    if (scopeType === 'user' && !userId.trim()) {
      setError('Vui lòng chọn hoặc nhập User ID mục tiêu');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        key: cleanKey,
        description: description.trim(),
        scope_type: scopeType,
        plan_code: scopeType === 'plan' ? (planCode || targetPlans[0] || null) : null,
        target_plans: scopeType === 'plan' ? targetPlans : [],
        shop_id: scopeType === 'shop' ? shopId : null,
        user_id: scopeType === 'user' ? userId.trim() : null,
        rollout_percentage: Number(rolloutPercentage),
        is_enabled: !!isEnabled
      };

      let res;
      if (isEdit) {
        res = await AdminService.updateFeatureFlag(flag.id, flag, payload);
      } else {
        res = await AdminService.createFeatureFlag(payload);
      }

      if (res.success) {
        onSaved?.(res.data || { ...flag, ...payload });
        onClose?.();
      } else {
        setError(res.error || 'Lỗi lưu Feature Flag');
      }
    } catch (err) {
      setError(err.message || 'Lỗi không xác định khi lưu Feature Flag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEdit ? `Cấu Hình Cờ Tính Năng: ${flag.key}` : 'Tạo Cờ Tính Năng Mới (Feature Flag)'}
      maxWidth="620px"
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* Feature Key */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            FEATURE KEY <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="ví dụ: ai_batch_ocr, carrier_webhook_realtime"
              disabled={isEdit}
              required
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontFamily: 'monospace',
                fontWeight: 600,
                fontSize: 13,
                background: isEdit ? '#f8fafc' : '#ffffff',
                color: isEdit ? '#64748b' : '#0f172a'
              }}
            />
            <Flag size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#64748b' }} />
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Mã nhận diện duy nhất của tính năng trong code hệ thống (dùng chữ thường, số và dấu gạch dưới).
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            MÔ TẢ TÍNH NĂNG
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Mô tả công dụng và mục đích phát hành của tính năng này..."
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 13
            }}
          />
        </div>

        {/* Scope Type Selection */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            PHẠM VI ÁP DỤNG (SCOPE TYPE)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { id: 'global', label: 'Toàn cầu (Global)', icon: Globe, color: '#2563eb' },
              { id: 'plan', label: 'Gói cước (Plan)', icon: Layers, color: '#7c3aed' },
              { id: 'shop', label: 'Cửa hàng (Shop)', icon: Store, color: '#059669' },
              { id: 'user', label: 'Người dùng (User)', icon: User, color: '#d97706' }
            ].map(item => {
              const active = scopeType === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScopeType(item.id)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: active ? `2px solid ${item.color}` : '1px solid #e2e8f0',
                    background: active ? `${item.color}10` : '#ffffff',
                    color: active ? item.color : '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Target Selection */}
        {scopeType === 'plan' && (
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
              CHỌN CÁC GÓI CƯỚC ĐƯỢC PHÉP TRUY CẬP (TARGET PLANS)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AVAILABLE_PLANS.map(plan => {
                const checked = targetPlans.includes(plan) || planCode === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => toggleTargetPlan(plan)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: checked ? '1px solid #7c3aed' : '1px solid #cbd5e1',
                      background: checked ? '#7c3aed' : '#ffffff',
                      color: checked ? '#ffffff' : '#334155',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {checked && <CheckCircle2 size={13} />}
                    {plan}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Hoặc chọn Gói cước chính (Primary Plan Code):</label>
              <select
                value={planCode}
                onChange={e => setPlanCode(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
              >
                <option value="">-- Không chọn riêng --</option>
                {AVAILABLE_PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        )}

        {scopeType === 'shop' && (
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
              CHỌN CỬA HÀNG MỤC TIÊU (TARGET SHOP)
            </label>
            <select
              value={shopId}
              onChange={e => setShopId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                background: '#ffffff'
              }}
            >
              <option value="">-- Chọn Cửa Hàng (Shop) --</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.shop_code ? `[${s.shop_code}]` : ''} - (ID: {s.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              Tính năng sẽ chỉ mở cho các thành viên và thiết bị thuộc cửa hàng được chọn.
            </div>
          </div>
        )}

        {scopeType === 'user' && (
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
              USER ID MỤC TIÊU (UUID HOẶC CHỌN TỪ DANH SÁCH)
            </label>
            {users.length > 0 ? (
              <select
                value={userId}
                onChange={e => setUserId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  background: '#ffffff',
                  marginBottom: 8
                }}
              >
                <option value="">-- Chọn Người Dùng từ danh sách --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email || u.id} ({u.role || 'Member'})
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="Nhập UUID người dùng: ví dụ a1b2c3d4-..."
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontFamily: 'monospace',
                fontSize: 12
              }}
            />
          </div>
        )}

        {/* Rollout Percentage Slider */}
        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={15} color="#2563eb" />
              TỶ LỆ PHÁT HÀNH (ROLLOUT PERCENTAGE): <span style={{ color: '#2563eb' }}>{rolloutPercentage}%</span>
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 10, 25, 50, 100].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setRolloutPercentage(pct)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: rolloutPercentage === pct ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: rolloutPercentage === pct ? '#2563eb' : '#ffffff',
                    color: rolloutPercentage === pct ? '#ffffff' : '#475569',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={rolloutPercentage}
            onChange={e => setRolloutPercentage(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {rolloutPercentage === 100 && 'Phát hành toàn bộ 100% đối tượng được phân quyền.'}
            {rolloutPercentage === 0 && '0% đối tượng được truy cập (Khóa hoàn toàn).'}
            {rolloutPercentage > 0 && rolloutPercentage < 100 && `Thử nghiệm phân nhánh (Canary) cho ~${rolloutPercentage}% số lượng thực thể.`}
          </div>
        </div>

        {/* Is Enabled Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          borderRadius: 8,
          background: isEnabled ? '#f0fdf4' : '#fef2f2',
          border: isEnabled ? '1px solid #bbf7d0' : '1px solid #fecaca'
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isEnabled ? '#15803d' : '#b91c1c' }}>
              {isEnabled ? 'Trạng Thái: ĐANG BẬT (ACTIVE)' : 'Trạng Thái: ĐANG TẮT (DISABLED)'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {isEnabled ? 'Cờ tính năng sẵn sàng được đánh giá và hoạt động.' : 'Ngắt toàn bộ quyền truy cập của cờ này (Emergency Switch).'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEnabled(!isEnabled)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: isEnabled ? '#16a34a' : '#dc2626',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {isEnabled ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {isEnabled ? 'Bật' : 'Tắt'}
          </button>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Đang lưu...' : (isEdit ? 'Lưu Thay Đổi' : 'Tạo Cờ Tính Năng')}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
