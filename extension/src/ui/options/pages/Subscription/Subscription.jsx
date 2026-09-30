import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmtNumber = value => asNumber(value).toLocaleString('vi-VN');

export default function Subscription() {
  const [currentPlan, setCurrentPlan] = useState('TRIAL');
  const [budget, setBudget] = useState(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [periodEnd, setPeriodEnd] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeShopId, setActiveShopId] = useState(null);
  const [shopCode, setShopCode] = useState('');
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  
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
          const monthlyLimit = asNumber(qRows[0].ai_monthly_limit);
          const monthlyUsed = asNumber(qRows[0].ai_monthly_used);
          const dailyLimit = asNumber(qRows[0].ai_daily_limit);
          const dailyUsed = asNumber(qRows[0].ai_daily_used);
          setBudget({
            monthly_remaining: Math.max(0, monthlyLimit - monthlyUsed),
            monthly_limit: monthlyLimit,
            daily_remaining: Math.max(0, dailyLimit - dailyUsed),
            daily_limit: dailyLimit
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

      // 4. Lấy mã shop (shop_code) để tạo nội dung chuyển khoản ngắn gọn
      try {
        const sRes = await fetch(
          `${configRes.url}/rest/v1/shops?id=eq.${sess.active_shop_id}&select=shop_code,name`,
          { headers }
        );
        if (sRes.ok) {
          const sRows = await sRes.json();
          if (sRows && sRows.length > 0 && sRows[0].shop_code) {
            setShopCode(sRows[0].shop_code);
          }
        }
      } catch (_) {}

      // 5. Tải lịch sử giao dịch thanh toán & hóa đơn
      try {
        const txRes = await fetch(
          `${configRes.url}/rest/v1/payment_transactions?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&limit=20`,
          { headers }
        );
        if (txRes.ok) {
          const txRows = await txRes.json();
          setPaymentTransactions(Array.isArray(txRows) ? txRows : []);
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

      let res = await fetch(`${configRes.url}/rest/v1/rpc/apply_license_key`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_shop_id: sess.active_shop_id,
          p_code: licenseKeyInput.trim().toUpperCase()
        })
      });

      if (!res.ok) {
        // Fallback to redeem_license_key if older schema
        res = await fetch(`${configRes.url}/rest/v1/rpc/redeem_license_key`, {
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
      }

      const result = await res.json();
      if (res.ok && result && (result.success || result.valid)) {
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
    // Format: AF <SHOP_CODE> (Guaranteed < 15 chars, matches SePay regex ^AF <CODE> and passes bank 20-char limits)
    const code = (shopCode || activeShopId.slice(0, 8)).toUpperCase();
    return `AF ${code}`;
  };

  const getVietQRUrl = () => {
    if (!selectedPlan) return '';
    const memo = encodeURIComponent(getTransferContent());
    const accName = encodeURIComponent(BANK_CONFIG.accountName);
    return `https://img.vietqr.io/image/${BANK_CONFIG.bankCode}-${BANK_CONFIG.accountNo}-compact2.png?amount=${selectedPlan.amount}&addInfo=${memo}&accountName=${accName}`;
  };

  if (isLoading) return <div style={{ padding: '30px', textAlign: 'center' }}>🔄 Đang tải thông tin gói cước...</div>;

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>💳 Gói Cước & Nâng Cấp Tự Động</h2>
          <p style={{ color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
            Nâng cấp hạn mức AI, số lượng đơn hàng và số lượng nhân viên. Hệ thống tự động kích hoạt gói cước trong 3 giây qua VietQR.
          </p>
        </div>
      </div>

      {/* Current Active Plan Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'var(--card)', border: '1px solid var(--border)', padding: '22px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>GÓI DỊCH VỤ HIỆN TẠI</div>
            <h3 style={{ margin: '4px 0', fontSize: '22px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Gói {currentPlan}
              <span style={{ fontSize: '12px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                Đang kích hoạt
              </span>
            </h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Hạn dùng đến: <strong>{formatDate(periodEnd)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '30px', textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Hạn mức AI tháng này</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
                {budget ? `${fmtNumber(budget.monthly_remaining)} / ${fmtNumber(budget.monthly_limit)}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Thiết bị đang kết nối</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{deviceCount} Đang hoạt động</div>
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
                justifyContent: 'space-between',
                padding: '24px 20px',
                borderRadius: '12px',
                border: isCurrent ? '2px solid var(--primary)' : (p.popular ? '2px solid var(--primary)' : '1px solid var(--border)'),
                background: p.popular ? 'var(--primary-light)' : 'var(--card)',
                boxShadow: p.popular ? '0 10px 25px -5px rgba(59, 130, 246, 0.15)' : '0 2px 5px rgba(0,0,0,0.03)',
                position: 'relative'
              }}
            >
              {p.popular && (
                <span style={{ position: 'absolute', top: '-12px', right: '16px', background: 'var(--primary)', color: '#fff', fontSize: '10px', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                  PHỔ BIẾN NHẤT
                </span>
              )}
              {p.badge && (
                <span style={{ position: 'absolute', top: '-12px', right: '16px', background: 'var(--success)', color: '#fff', fontSize: '10px', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                  {p.badge}
                </span>
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)', fontWeight: 700 }}>{p.name}</h4>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', margin: '12px 0 16px 0' }}>{p.price}</div>
                <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '2' }}>
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
                  background: isCurrent ? 'var(--border)' : 'var(--primary)',
                  color: isCurrent ? 'var(--text-muted)' : '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isCurrent ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.25)'
                }}
              >
                {isCurrent ? 'Đang sử dụng' : 'Nâng cấp qua VietQR ⚡'}
              </button>
            </div>
          );
        })}
      </div>

      {/* License Key Activation Section */}
      <div className="card" style={{ padding: '24px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--text-main)' }}>🔑 Kích hoạt bằng Mã Bản Quyền (License Key)</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
          Nếu bạn đã nhận mã bản quyền từ đối tác hoặc chương trình khuyến mãi, hãy nhập mã vào đây để kích hoạt gói ngay lập tức.
        </p>

        <form onSubmit={handleRedeemKey} style={{ display: 'flex', gap: '12px', maxWidth: '500px' }}>
          <input
            type="text"
            placeholder="VD: AF-98X2-K9L1-M4N3"
            value={licenseKeyInput}
            onChange={(e) => setLicenseKeyInput(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-main)',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isRedeeming || !licenseKeyInput.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isRedeeming ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
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

      {/* Payment Transactions & Invoice History */}
      <div className="card" style={{ marginTop: '24px', padding: '24px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', fontWeight: 700 }}>
              🧾 Lịch Sử Giao Dịch & Hóa Đơn Thuê Bao
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Theo dõi các giao dịch gia hạn tự động qua VietQR, SePay và kích hoạt bản quyền của cửa hàng.
            </p>
          </div>
          <button
            onClick={loadSubscription}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            🔄 Làm mới
          </button>
        </div>

        {paymentTransactions.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.6 }}>📑</div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Chưa có giao dịch thanh toán nào</div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>Các khoản thanh toán tự động qua VietQR hoặc kích hoạt mã bản quyền sẽ hiển thị tại đây.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <th style={{ padding: '10px 12px' }}>Thời gian</th>
                  <th style={{ padding: '10px 12px' }}>Mã GD / Tham chiếu</th>
                  <th style={{ padding: '10px 12px' }}>Cổng thanh toán</th>
                  <th style={{ padding: '10px 12px' }}>Nội dung CK</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Số tiền</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {paymentTransactions.map((tx, idx) => (
                  <tr key={tx.id || tx.transaction_id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(tx.created_at || tx.payment_time)}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                      {tx.transaction_id || tx.transaction_code || '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '11px', fontWeight: 700 }}>
                        {tx.gateway || 'VIETQR_SEPAY'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {tx.content || tx.description || '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      +{fmtNumber(tx.amount || 0)} đ
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700 }}>
                        Hoàn tất
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            background: 'var(--card)',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '520px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative',
            border: '1px solid var(--border)'
          }}>
            <button
              onClick={() => setShowPaymentModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: 'var(--bg)',
                color: 'var(--text-main)',
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
                <h3 style={{ fontSize: '22px', color: 'var(--success)', margin: '0 0 10px 0' }}>Thanh Toán Thành Công!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                  Gói <strong>{selectedPlan.name}</strong> đã được kích hoạt thành công cho cửa hàng của bạn.
                </p>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  style={{
                    marginTop: '20px',
                    padding: '10px 24px',
                    background: 'var(--success)',
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
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--text-main)', fontWeight: 800 }}>
                  ⚡ Quét mã VietQR để kích hoạt gói {selectedPlan.name}
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Mở ứng dụng ngân hàng bất kỳ (MB, VCB, Techcombank, Momo...) để quét mã bên dưới.
                </p>

                {/* QR Image Container */}
                <div style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
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
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse-live 1.5s infinite' }}></span>
                    Hệ thống tự động kích hoạt sau khi nhận tiền (3 - 5 giây)
                  </div>
                </div>

                {/* Transfer Details */}
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', fontSize: '13px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Số tiền:</span>
                    <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{selectedPlan.amount.toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Số tài khoản:</span>
                    <strong style={{ letterSpacing: '0.5px', color: 'var(--text-main)' }}>{BANK_CONFIG.accountNo} ({BANK_CONFIG.bankCode})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Chủ tài khoản:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{BANK_CONFIG.accountName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nội dung CK:</span>
                    <code style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      {getTransferContent()}
                    </code>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {isCheckingPayment ? '🔄 Đang chờ thanh toán...' : '⚡ Đang lắng nghe webhook...'}
                  </span>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-main)',
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

