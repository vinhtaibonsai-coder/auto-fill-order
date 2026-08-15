import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.js';

export default function PermissionMatrix() {
  const [permissions, setPermissions] = useState([]); // { id, code, description }
  const [roles, setRoles] = useState([]); // { id, code, name }
  const [matrix, setMatrix] = useState({}); // roleId -> { permId: true }
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMatrix();
  }, []);

  const loadMatrix = async () => {
    try {
      const configRes = await globalThis.SupabaseCloud.loadConfig();
      const sess = await AuthSession.getSession();
      if (!sess || !sess.access_token) {
        setIsLoading(false);
        return;
      }
      const headers = {
        'apikey': configRes.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };
      const SHOP_ROLES = ['SHOP_OWNER', 'SHOP_MANAGER', 'SHOP_STAFF', 'VIEWER'];

      const [permRes, roleRes, rpRes] = await Promise.all([
        fetch(`${configRes.url}/rest/v1/permissions?select=id,code,description&order=code.asc`, { headers }),
        fetch(`${configRes.url}/rest/v1/roles?select=id,code,name`, { headers }),
        fetch(`${configRes.url}/rest/v1/role_permissions?select=role_id,permission_id`, { headers })
      ]);

      const perms = permRes.ok ? await permRes.json() : [];
      const allRoles = roleRes.ok ? await roleRes.json() : [];
      const rps = rpRes.ok ? await rpRes.json() : [];

      const shopRoles = (allRoles || []).filter(r => SHOP_ROLES.includes(r.code));
      const m = {};
      (shopRoles || []).forEach(r => { m[r.id] = {}; });
      (rps || []).forEach(rp => {
        if (m[rp.role_id]) m[rp.role_id][rp.permission_id] = true;
      });

      setPermissions(perms || []);
      setRoles(shopRoles || []);
      setMatrix(m);
    } catch (err) {
      console.error('Lỗi tải ma trận phân quyền:', err);
    }
    setIsLoading(false);
  };

  if (isLoading) return <div style={{ padding: '20px' }}>Đang tải...</div>;

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '6px' }}>🔑 Ma trận Phân Quyền (RBAC Matrix)</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Ma trận quyền thực tế được đồng bộ từ hệ thống (bảng permissions / role_permissions). Quyền do hệ thống quản lý tập trung.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Tác vụ / Quyền hạn</th>
              {roles.map(r => (
                <th key={r.id} style={{ padding: '10px', textAlign: 'center' }}>
                  {r.code.replace('SHOP_', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={roles.length + 1} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không tải được dữ liệu quyền (có thể chưa đăng nhập).
                </td>
              </tr>
            ) : permissions.map(perm => (
              <tr key={perm.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px', fontWeight: 500 }}>
                  {perm.code.toUpperCase()}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{perm.description}</div>
                </td>
                {roles.map(role => (
                  <td key={role.id} style={{ padding: '10px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!matrix[role.id]?.[perm.id]}
                      disabled
                      title="Hệ thống quản lý"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Mọi thay đổi quyền phải được thực hiện bởi Admin Dashboard. Trang này hiển thị trạng thái thực tế.
      </div>
    </div>
  );
}
