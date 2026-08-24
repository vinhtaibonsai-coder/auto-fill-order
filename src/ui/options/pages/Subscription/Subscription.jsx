import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function Subscription() {
  const [currentPlan, setCurrentPlan] = useState('TRIAL');
  const [budget, setBudget] = useState(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [periodEnd, setPeriodEnd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeShopId, setActiveShopId] = useState(null);
  
  // Payment Modal State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  
  // License Key State
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState(null);

  // Bank details (Default or from system config)
  const BANK_CONFIG = {
    bankCode: 'MB', // MBBank
    accountNo: '0935011695',
    accountName: 'VO DINH TAI',
    bankName: 'MBBank (Ngân hàng Quân Đội)'
  };

  const plans = [
    { 
      code: 'TRIAL', 
      name: 'Dùng thử', 
      price: '0 đ', 
      amount: 0,
      duration: '14 ngày', 
      users: '3 Nhân viên', 
      devices: '2 Thiết bị', 
      ai: '500 Lượt AI/tháng', 
      orders: '1.000 Đơn/tháng',
      popular: false 
    },
    { 
      code: 'PRO_MONTH', 
      name: 'Pro 1 Tháng', 
      price: '199.000 đ/tháng', 
      amount: 199000,
      duration: '1 Tháng', 
      users: '5 Nhân viên', 
      devices: '5 Thiết bị', 
      ai: '2.500 Lượt AI/tháng', 
      orders: '5.000 Đơn/tháng',
      popular: true 
    },
    { 
      code: 'PRO_YEAR', 
      name: 'Pro 1 Năm (Tiết kiệm 40%)', 
      price: '1.490.000 đ/năm', 
      amount: 1490000,
      duration: '12 Tháng', 
      users: '15 Nhân viên', 
      devices: '15 Thiết bị', 
      ai: '50.000 Lượt AI/năm', 
      orders: '100.000 Đơn/năm',
      popular: false,
      badge: 'TIẾT KIỆM 40%'
    },
    { 
      code: 'ENTERPRISE', 
      name: 'Doanh Nghiệp / Chuỗi', 
      price: '3.990.000 đ/năm', 
      amount: 3990000,
      duration: '12 Tháng', 
      users: 'Không giới hạn', 
      devices: 'Không giới hạn', 
      ai: '100.000 Lượt AI', 
      orders: '500.000 Đơn/năm',
      popular: false 
    },
  ];

  useEffect(() => {
    loadSubscription();
  }, []);

  // Polling check payment when modal is open
  useEffect(() => {
    let interval = null;
    if (showPaymentModal && selectedPlan && !paymentSuccess) {
      interval = setInterval(async () => {
        setIsCheckingPayment(true);
        try {
          const configRes = await globalThis.SupabaseCloud.loadConfig();
          const sess = await AuthSession.getSession();
          if (sess && sess.active_shop_id) {
            const subRes = await fetch(
              `${configRes.url}/rest/v1/subscriptions?shop_id=eq.${sess.active_shop_id}&select=plan_tier,current_period_end`,
              {
                headers: {
                  'apikey': configRes.anonKey,
                  'Authorization': `Bearer ${sess.access_token}`
                }
              }
            );
            if (subRes.ok) {
              const rows = await subRes.json();
              if (rows && rows.length > 0) {
                if (rows[0].plan_tier === selectedPlan.code || (selectedPlan.code === 'PRO_YEAR' && rows[0].plan_tier === 'PRO_YEAR')) {
                  setPaymentSuccess(true);
                  setCurrentPlan(rows[0].plan_tier);
                  setPeriodEnd(rows[0].current_period_end);
                  setTimeout(() => {
                    loadSubscription();
                  }, 2000);
                }
              }
            }
          }
        } catch (_) {}
        setIsCheckingPayment(false);
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showPaymentModal, selectedPlan, paymentSuccess]);

  const loadSubscription = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      setActiveShopId(sess.active_shop_id);
      const headers = {
        'apikey': configRes.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      // 1. Tải subscription
      const subRes = await fetch(
        `${configRes.url}/rest/v1/subscriptions?shop_id=eq.${sess.active_shop_id}&select=plan_tier,status,current_period_end,max_members,max_devices`,
        { headers }
      );
      if (subRes.ok) {
        const rows = await subRes.json();
        if (rows && rows.length > 0) {
          setCurrentPlan(rows[0].plan_tier || 'TRIAL');
          setPeriodEnd(rows[0].current_period_end);
        }
      }

      // 2. Tải Shop Quotas
      const quotaRes = await fetch(
        `${configRes.url}/rest/v1/shop_quotas?shop_id=eq.${sess.active_shop_id}&select=*`,
        { headers }
      );
      if (quotaRes.ok) {
        const qRows = await quotaRes.json();
        if (qRows && qRows.length > 0) {
          setBudget({
            monthly_remaining: Math.max(0, qRows[0].ai_monthly_limit - qRows[0].ai_monthly_used),
            monthly_limit: qRows[0].ai_monthly_limit,
            daily_remaining: Math.max(0, qRows[0].ai_daily_limit - qRows[0].ai_daily_used),
            daily_limit: qRows[0].ai_daily_limit
          });
        }
      }

      // 3. Đếm thiết bị active
      try {
        const devRes = await fetch(
          `${configRes.url}/rest/v1/devices?shop_id=eq.${sess.active_shop_id}&is_revoked=eq.false&select=id`,
          { headers }
        );
        if (devRes.ok) {
          const rows = await devRes.json();
          setDeviceCount(Array.isArray(rows) ? rows.length : 0);
        }
      } catch (_) {}
    } catch (err) {
      console.error('Lỗi tải gói cước:', err);
    }
    setIsLoading(false);
  };

  const formatDate = (iso) => {
    if (!iso) return 'Không rõ';
    try {
      return new Date(iso).toLocaleDateString('vi-VN');
    } catch (_) {
      return 'Không rõ';
    }
  };

  const handleOpenPayment = (plan) => {
    if (plan.amount === 0) {
      alert('Bạn đang ở gói Dùng thử. Vui lòng chọn gói Pro để nâng cấp thêm hạn mức.');
      return;
    }
    setSelectedPlan(plan);
    setPaymentSuccess(false);
    setShowPaymentModal(true);
  };

  const handleRedeemKey = async (e) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;
    setIsRedeeming(true);
    setRedeemMessage(null);

    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id) {
        setRedeemMessage({ success: false, text: 'Vui lòng đăng nhập vào Shop để kích hoạt mã.' });
        setIsRedeeming(false);
        return;
      }

      const res = await fetch(`${configRes.url}/rest/v1/rpc/redeem_license_key`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_shop_id: sess.active_shop_id,
          p_key_code: licenseKeyInput.trim().toUpperCase()
        })
      });

      const result = await res.json();
      if (res.ok && result && result.success) {
        setRedeemMessage({ success: true, text: result.message || 'Kích hoạt mã bản quyền thành công!' });
        setLicenseKeyInput('');
        loadSubscription();
      } else {
        setRedeemMessage({ success: false, text: result?.error || result?.message || 'Mã kích hoạt không hợp lệ hoặc đã sử dụng.' });
      }
    } catch (err) {
      setRedeemMessage({ success: false, text: 'Lỗi kết nối máy chủ: ' + err.message });
    }
    setIsRedeeming(false);
  };

  const getTransferContent = () => {
    if (!activeShopId || !selectedPlan) return '';
    // Format: AUTOFILL <SHOP_ID_SHORT> <PLAN>
    return `AUTOFILL ${activeShopId} ${selectedPlan.code}`;
  };

  const getVietQRUrl = () => {
    if (!selectedPlan) return '';
    const memo = encodeURIComponent(getTransferContent());
    const accName = encodeURIComponent(BANK_CONFIG.accountName);
    return `https://img.vietqr.io/image/${BANK_CONFIG.bankCode}-${BANK_CONFIG.accountNo}-compact2.png?amount=${selectedPlan.amount}&addInfo=${memo}&accountName=${accName}`;
  };

  if (isLoading) return <div style={{ padding: '30px', textAlign: 'center' }}>🔄 Đang tải thông tin gói cước...</div>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>💳 Gói Cước & Thanh Toán Tự Động (Commercial SaaS)</h2>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
            Nâng cấp hạn mức AI, số lượng đơn hàng và thành viên. Hệ thống tự động kích hoạt gói cước trong 3 giây qua VietQR.
          </p>
        </div>
      </div>

      {/* Current Active Plan Banner */}
      <div className="card" style={{ marginBottom: '24px', borderLeft: '6px solid #2563eb', background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>GÓI DỊCH VỤ HIỆN TẠI</div>
            <h3 style={{ margin: '4px 0', fontSize: '22px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Gói {currentPlan}
              <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                Đang kích hoạt
              </span>
            </h3>
            <div style={{ fontSize: '13px', color: '#475569' }}>
              Hạn dùng đến: <strong>{formatDate(periodEnd)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '30px', textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>AI Quota tháng này</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>
                {budget ? `${budget.monthly_remaining.toLocaleString()} / ${budget.monthly_limit.toLocaleString()}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Thiết bị đang kết nối</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>{deviceCount} Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {plans.map(p => {
          const isCurrent = p.code === currentPlan;
          return (
            <div
              key={p.code}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                padding: '24px 20px',
                borderRadius: '12px',
                border: isCurrent ? '2px solid #2563eb' : (p.popular ? '2px solid #3b82f6' : '1px solid #e2e8f0'),
                background: p.popular ? '#f0f7ff' : '#ffffff',
                boxShadow: p.popular ? '0 10px 25px -5px rgba(59, 130, 246, 0.15)' : '0 2px 5px rgba(0,0,0,0.05)',
                position: 'relative'
              }}
            >
              {p.popular && (
                <span style={{ position: 'absolute', top: '-12px', right: '16px', background: '#2563eb', color: '#fff', fontSize: '10px', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                  PHỔ BIẾN NHẤT
                </span>
              )}
              {p.badge && (
                <span style={{ position: 'absolute', top: '-12px', right: '16px', background: '#16a34a', color: '#fff', fontSize: '10px', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                  {p.badge}
                </span>
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 700 }}>{p.name}</h4>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', margin: '12px 0 16px 0' }}>{p.price}</div>
                <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', color: '#475569', lineHeight: '2' }}>
                  <li>👥 <strong>{p.users}</strong></li>
                  <li>💻 <strong>{p.devices}</strong></li>
                  <li>⚡ <strong>{p.ai}</strong></li>
                  <li>📦 <strong>{p.orders}</strong></li>
                  <li>🛡️ Hỗ trợ kỹ thuật 24/7</li>
                </ul>
              </div>

              <button
                onClick={() => handleOpenPayment(p)}
                disabled={isCurrent}
                style={{
                  marginTop: '24px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isCurrent ? '#e2e8f0' : '#2563eb',
                  color: isCurrent ? '#64748b' : '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isCurrent ? 'Đang sử dụng' : 'Nâng cấp qua VietQR ⚡'}
              </button>
            </div>
          );
        })}
      </div>

      {/* License Key Activation Section */}
      <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>🔑 Kích hoạt bằng Mã Bản Quyền (License Key)</h3>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
          Nếu bạn đã nhận mã bản quyền từ đối tác hoặc chương trình khuyến mãi, hãy nhập mã vào đây để kích hoạt gói ngay lập tức.
        </p>

        <form onSubmit={handleRedeemKey} style={{ display: 'flex', gap: '12px', maxWidth: '500px' }}>
          <input
            type="text"
            placeholder="VD: AUTOFILL-PRO-98X2-K9L1"
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          />
          <button
            type="submit"
            disabled={isRedeeming || !licenseKeyInput.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: isRedeeming ? 'wait' : 'pointer'
            }}
          >
            {isRedeeming ? 'Đang kiểm tra...' : 'Kích hoạt'}
          </button>
        </form>

        {redeemMessage && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            background: redeemMessage.success ? '#dcfce7' : '#fee2e2',
            color: redeemMessage.success ? '#15803d' : '#b91c1c'
          }}>
            {redeemMessage.success ? '✅ ' : '❌ '} {redeemMessage.text}
          </div>
        )}
      </div>

      {/* VIETQR PAYMENT MODAL */}
      {showPaymentModal && selectedPlan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '520px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowPaymentModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: '#f1f5f9',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            {paymentSuccess ? (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <div style={{ fontSize: '54px', marginBottom: '16px' }}>🎉</div>
                <h3 style={{ fontSize: '22px', color: '#16a34a', margin: '0 0 10px 0' }}>Thanh Toán Thành Công!</h3>
                <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
                  Gói <strong>{selectedPlan.name}</strong> đã được kích hoạt thành công cho cửa hàng của bạn.
                </p>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    marginTop: '20px',
                    padding: '10px 24px',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Bắt đầu sử dụng ngay
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0f172a' }}>
                  ⚡ Quét mã VietQR để kích hoạt gói {selectedPlan.name}
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                  Mở ứng dụng ngân hàng bất kỳ (MB, VCB, Techcombank, Momo...) để quét mã bên dưới.
                </p>

                {/* QR Image Container */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  marginBottom: '20px'
                }}>
                  <img
                    src={getVietQRUrl()}
                    alt="VietQR Payment"
                    style={{ width: '220px', height: '220px', borderRadius: '8px', display: 'inline-block' }}
                  />
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }}></span>
                    Hệ thống tự động kích hoạt sau khi nhận tiền (3 - 5 giây)
                  </div>
                </div>

                {/* Transfer Details */}
                <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '14px', fontSize: '13px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Số tiền:</span>
                    <strong style={{ color: '#2563eb', fontSize: '15px' }}>{selectedPlan.amount.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Số tài khoản:</span>
                    <strong style={{ letterSpacing: '0.5px' }}>{BANK_CONFIG.accountNo} ({BANK_CONFIG.bankCode})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Chủ tài khoản:</span>
                    <strong>{BANK_CONFIG.accountName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Nội dung CK:</span>
                    <code style={{ background: '#e2e8f0', padding: '3px 6px', borderRadius: '4px', fontWeight: 700, color: '#0f172a' }}>
                      {getTransferContent()}
                    </code>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {isCheckingPayment ? '🔄 Đang chờ thanh toán...' : '⚡ Đang lắng nghe webhook...'}
                  </span>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
