import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';

export default function Team() {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [status, setStatus] = useState('');

  const roleLabel = (role) => ({
    OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff', VIEWER: 'Viewer'
  }[role] || role);

  const loadMembers = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const headers = {
        'apikey': configRes.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      // Ưu tiên RPC v2 (JOIN profiles trong SQL — member có email/full_name)
      try {
        const rpcRes = await fetch(`${configRes.url}/rest/v1/rpc/owner_get_members_v2`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_shop_id: sess.active_shop_id })
        });
        if (rpcRes.ok) {
          const rows = await rpcRes.json();
          if (Array.isArray(rows)) {
            const order = { OWNER: 0, MANAGER: 1, STAFF: 2, VIEWER: 3 };
            setMembers(rows.sort((a, b) => (order[a.role_code] ?? 9) - (order[b.role_code] ?? 9)));
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('owner_get_members_v2 lỗi (fallback REST):', e);
      }

      // Fallback: REST shop_members (không có email/full_name do thiếu FK)
      const res = await fetch(
        `${configRes.url}/rest/v1/shop_members?shop_id=eq.${sess.active_shop_id}&removed_at=is.null&select=user_id,role,status,created_at`,
        { headers }
      );
      if (res.ok) {
        const rows = await res.json();
        const order = { OWNER: 0, MANAGER: 1, STAFF: 2, VIEWER: 3 };
        setMembers((rows || []).sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9)));
      }
    } catch (err) {
      console.error('Lỗi tải danh sách thành viên:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadMembers(); }, []);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) { setStatus('❌ Vui lòng nhập email nhân viên.'); return; }
    setIsInviteLoading(true);
    setStatus('');
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) {
        setStatus('❌ Phiên đăng nhập không hợp lệ.');
        setIsInviteLoading(false);
        return;
      }
      const res = await fetch(`${configRes.url}/rest/v1/rpc/owner_invite_staff_v2`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_email: email, p_shop_id: sess.active_shop_id })
      });
      const data = await res.json();
      if (res.ok && data && data.success) {
        setStatus(`✅ Đã gửi lời mời ${email} (${data.invite_code}). Nhân viên nhận thông báo mời trong Shop.`);
        setInviteEmail('');
      } else {
        setStatus('❌ ' + (data?.message || 'Không thể gửi lời mời.'));
      }
    } catch (err) {
      setStatus('❌ Lỗi: ' + err.message);
    }
    setIsInviteLoading(false);
  };

  const handleRemove = async (userId, name) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa "${name}" khỏi Shop?`)) return;
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.active_shop_id || !sess.access_token) return;
      const res = await fetch(`${configRes.url}/rest/v1/rpc/owner_remove_staff_v2`, {
        method: 'POST',
        headers: {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_user_id: userId, p_shop_id: sess.active_shop_id })
      });
      const data = await res.json();
      if (res.ok && data && data.success) {
        setStatus(`✅ Đã xóa ${name} khỏi Shop.`);
        loadMembers();
      } else {
        setStatus('❌ ' + (data?.message || 'Không thể xóa thành viên.'));
      }
    } catch (err) {
      setStatus('❌ Lỗi: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">Team Management</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Quản lý nhân viên thuộc Shop của bạn. Owner có toàn quyền, Staff chỉ có quyền tạo đơn.
      </p>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '15px' }}>Mời nhân viên mới</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="email"
            placeholder="email@nhanvien.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '6px' }}
          />
          <button
            onClick={handleInvite}
            disabled={isInviteLoading}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: isInviteLoading ? 'default' : 'pointer' }}
          >
            {isInviteLoading ? 'Đang gửi...' : '+ Invite Staff'}
          </button>
        </div>
        {status && <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600 }}>{status}</div>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>User</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Role</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có thành viên nào trong Shop.</td></tr>
            ) : members.map(user => {
              const role = user.role_code || user.role || 'VIEWER';
              const status = user.status === 'active' ? 'Active' : (user.status || 'active');
              return (
                <tr key={user.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600 }}>{user.full_name || 'Thành viên'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email || String(user.user_id).slice(0, 13) + '…'}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: role === 'OWNER' ? 'var(--primary)' : 'var(--text-main)' }}>
                      {roleLabel(role)}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                      background: status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: status === 'Active' ? 'var(--success)' : '#d97706'
                    }}>
                      {status}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemove(user.user_id, user.full_name || user.email || 'thành viên')}
                        style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
