// =========================================================================
// PERMISSION.SERVICE.JS — ĐỘNG CƠ PHÂN QUYỀN CHUẨN ACTION-BASED RBAC (Wave 0 Task F01 & F02)
// =========================================================================

const ACTION_PERMISSIONS = Object.freeze({
  'orders.view': { code: 'orders.view', description: 'Xem danh sách & chi tiết đơn hàng', risk: 'LOW' },
  'orders.edit': { code: 'orders.edit', description: 'Tạo và chỉnh sửa đơn hàng trước submit', risk: 'MEDIUM' },
  'orders.submit': { code: 'orders.submit', description: 'Nộp đơn lên hãng vận chuyển (VNPost, J&T)', risk: 'HIGH' },
  'labels.print': { code: 'labels.print', description: 'In nhãn vận đơn A5/A6', risk: 'LOW' },
  'labels.reprint': { code: 'labels.reprint', description: 'In lại nhãn vận đơn (yêu cầu lý do)', risk: 'MEDIUM' },
  'customers.view_pii': { code: 'customers.view_pii', description: 'Xem số điện thoại và địa chỉ đầy đủ (PII)', risk: 'HIGH' },
  'support.manage': { code: 'support.manage', description: 'Chăm sóc khách hàng & quản lý task CSKH', risk: 'LOW' },
  'billing.view': { code: 'billing.view', description: 'Xem số dư ví, COD và báo cáo đối soát', risk: 'MEDIUM' },
  'billing.manage': { code: 'billing.manage', description: 'Quản lý nạp tiền, hoàn tiền và cấu hình ví', risk: 'HIGH' },
  'team.manage': { code: 'team.manage', description: 'Mời thành viên, chỉnh sửa vai trò nhân viên', risk: 'HIGH' },
  'channels.manage': { code: 'channels.manage', description: 'Quản lý kết nối kênh mạng xã hội (Facebook/Zalo)', risk: 'HIGH' },
  'api_keys.manage': { code: 'api_keys.manage', description: 'Tạo, thu hồi và cấu hình API Key / MCP partner', risk: 'HIGH' },
  'audit.view': { code: 'audit.view', description: 'Xem nhật ký kiểm toán và lịch sử thao tác', risk: 'MEDIUM' }
});

const ROLE_ACTION_MATRIX = Object.freeze({
  OWNER: Object.freeze(Object.keys(ACTION_PERMISSIONS)),
  SHOP_OWNER: Object.freeze(Object.keys(ACTION_PERMISSIONS)),
  
  MANAGER: Object.freeze([
    'orders.view',
    'orders.edit',
    'orders.submit',
    'labels.print',
    'labels.reprint',
    'customers.view_pii',
    'support.manage',
    'billing.view',
    'billing.manage',
    'team.manage',
    'channels.manage',
    'api_keys.manage',
    'audit.view'
  ]),
  SHOP_MANAGER: Object.freeze([
    'orders.view',
    'orders.edit',
    'orders.submit',
    'labels.print',
    'labels.reprint',
    'customers.view_pii',
    'support.manage',
    'billing.view',
    'billing.manage',
    'team.manage',
    'channels.manage',
    'api_keys.manage',
    'audit.view'
  ]),

  PACKER: Object.freeze([
    'orders.view',
    'orders.edit',
    'orders.submit',
    'labels.print',
    'labels.reprint',
    'customers.view_pii'
  ]),
  SHOP_PACKER: Object.freeze([
    'orders.view',
    'orders.edit',
    'orders.submit',
    'labels.print',
    'labels.reprint',
    'customers.view_pii'
  ]),

  CSKH: Object.freeze([
    'orders.view',
    'customers.view_pii',
    'support.manage'
  ]),
  SHOP_CSKH: Object.freeze([
    'orders.view',
    'customers.view_pii',
    'support.manage'
  ]),

  ACCOUNTANT: Object.freeze([
    'orders.view',
    'billing.view',
    'audit.view'
  ]),
  SHOP_ACCOUNTANT: Object.freeze([
    'orders.view',
    'billing.view',
    'audit.view'
  ]),

  STAFF: Object.freeze([
    'orders.view',
    'orders.edit'
  ]),
  SHOP_STAFF: Object.freeze([
    'orders.view',
    'orders.edit'
  ])
});

const PermissionService = {
  /**
   * Đánh giá ma trận vai trò nội bộ (Pure In-Memory Evaluator)
   * Tuân thủ quy tắc Deny-By-Default cho role hoặc permission lạ.
   */
  evaluateRolePermission(role, permissionCode) {
    if (!role || !permissionCode) return false;
    if (!ACTION_PERMISSIONS[permissionCode]) return false;

    const normalizedRole = String(role).trim().toUpperCase();
    const permissions = ROLE_ACTION_MATRIX[normalizedRole];
    if (!permissions) return false;

    return permissions.includes(permissionCode);
  },

  /**
   * Bất biến bảo vệ Chủ cửa hàng (Owner Immunity Invariant)
   * Quản lý (Manager) tuyệt đối không thể hạ bệ hoặc đổi quyền Chủ shop (Owner).
   */
  canModifyMemberRole(actorRole, targetCurrentRole, targetNewRole) {
    const actor = String(actorRole || '').trim().toUpperCase();
    const targetCurrent = String(targetCurrentRole || '').trim().toUpperCase();

    // System admin hoặc Owner có thể sửa mọi vai trò
    if (['SYSTEM_ADMIN', 'OWNER', 'SHOP_OWNER'].includes(actor)) {
      return true;
    }

    // Manager không được sửa Owner
    if (['MANAGER', 'SHOP_MANAGER'].includes(actor)) {
      if (['OWNER', 'SHOP_OWNER'].includes(targetCurrent)) {
        return false;
      }
      const newRole = String(targetNewRole || '').trim().toUpperCase();
      if (['OWNER', 'SHOP_OWNER'].includes(newRole)) {
        return false;
      }
      return true;
    }

    return false;
  },

  /**
   * Kiểm tra quyền xóa/mời ra khỏi shop
   */
  canRemoveMember(actorRole, targetMemberRole) {
    const actor = String(actorRole || '').trim().toUpperCase();
    const target = String(targetMemberRole || '').trim().toUpperCase();

    if (['SYSTEM_ADMIN', 'OWNER', 'SHOP_OWNER'].includes(actor)) {
      return true;
    }

    if (['MANAGER', 'SHOP_MANAGER'].includes(actor)) {
      if (['OWNER', 'SHOP_OWNER'].includes(target)) {
        return false; // Manager không được xóa Owner
      }
      return true;
    }

    return false;
  },

  /**
   * Kiểm tra quyền hạn của người dùng hiện tại (Session & RPC Aware)
   */
  async can(permissionCode, options = {}) {
    if (!permissionCode) return true;

    // 1. Kiểm tra session hiện tại
    if (typeof AuthSession !== 'undefined') {
      try {
        const session = await AuthSession.getSession?.();
        if (session && session.user) {
          // System Admin có toàn quyền
          if (session.user.role === 'SYSTEM_ADMIN' || session.is_system_admin) {
            return true;
          }

          // Kiểm tra permissions snapshot lưu trong session
          const perms = await AuthSession.getPermissions?.();
          if (perms && (perms.includes('*') || perms.includes(permissionCode))) {
            return true;
          }

          // Kiểm tra theo role trong active_shop
          const userRole = session.active_shop_role || session.role;
          if (userRole && this.evaluateRolePermission(userRole, permissionCode)) {
            return true;
          }
        }
      } catch (err) {
        console.warn('[PermissionService] Lỗi kiểm tra session:', err);
      }
    }

    // 2. Fallback sang server RPC nếu có shop_id
    if (options.shop_id && typeof AuthService !== 'undefined') {
      try {
        const supabase = await AuthService.getSupabaseClient?.();
        if (supabase) {
          const { data, error } = await supabase.rpc('has_shop_permission', {
            p_shop_id: options.shop_id,
            p_permission_code: permissionCode
          });
          if (!error && typeof data === 'boolean') {
            return data;
          }
        }
      } catch (err) {
        console.warn('[PermissionService] Lỗi gọi has_shop_permission RPC:', err);
      }
    }

    return false;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.ACTION_PERMISSIONS = ACTION_PERMISSIONS;
  globalThis.ROLE_ACTION_MATRIX = ROLE_ACTION_MATRIX;
  globalThis.PermissionService = PermissionService;
}
if (typeof window !== 'undefined') {
  window.ACTION_PERMISSIONS = ACTION_PERMISSIONS;
  window.ROLE_ACTION_MATRIX = ROLE_ACTION_MATRIX;
  window.PermissionService = PermissionService;
}

