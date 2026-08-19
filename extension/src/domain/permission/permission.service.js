// =========================================================================
// PERMISSION.SERVICE.JS — ĐỘNG CƠ PHÂN QUYỀN CHUẨN PURE RBAC
// =========================================================================

const PermissionService = {
  // Kiểm tra quyền hạn của người dùng hiện tại
  async can(permissionCode) {
    if (!permissionCode) return true;
    
    if (typeof AuthSession === 'undefined') {
      console.warn('[PermissionService] AuthSession not found.');
      return false;
    }

    try {
      const permissions = await AuthSession.getPermissions();
      
      // Admin Override có toàn quyền
      if (permissions && permissions.includes('*')) {
        return true;
      }

      // Check quyền cụ thể
      return permissions && permissions.includes(permissionCode);
    } catch (err) {
      console.warn('[PermissionService] Lỗi kiểm tra quyền:', err);
      return false;
    }
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.PermissionService = PermissionService;
}
