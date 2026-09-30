import './permission.service.js';

const ACTION_PERMISSIONS = globalThis.ACTION_PERMISSIONS || (typeof window !== 'undefined' ? window.ACTION_PERMISSIONS : {});
const ROLE_ACTION_MATRIX = globalThis.ROLE_ACTION_MATRIX || (typeof window !== 'undefined' ? window.ROLE_ACTION_MATRIX : {});
const PermissionService = globalThis.PermissionService || (typeof window !== 'undefined' ? window.PermissionService : null);

export { ACTION_PERMISSIONS, ROLE_ACTION_MATRIX, PermissionService };
export default PermissionService;
