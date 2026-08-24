import { AdminRepository } from './admin.repository.js';
import { AuthSession } from '../auth/auth.session.esm.js';

/**
 * Admin Service - Lớp Xử Lý Business Logic (Service Layer)
 * Giao tiếp với UI component. Bọc lỗi, định dạng Response.
 */
export class AdminService {
  /**
   * Kiểm tra Authentication & Authorization (Frontend Basic)
   * Lớp an ninh chính vẫn nằm ở Supabase RLS.
   */
  static async _ensureAdmin() {
    const sess = await AuthSession.getSession().catch(() => null);
    if (!sess || !sess.user) {
      throw new Error("Lỗi Xác Thực: Bạn chưa đăng nhập.");
    }

    // Kiểm tra quyền Admin ở tầng ứng dụng bằng cách truy cập Supabase client trực tiếp
    const supabase = globalThis.SupabaseCloud ? globalThis.SupabaseCloud.getClient() : null;
    if (supabase) {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role_id, roles(code)')
        .eq('user_id', sess.user.id);

      let isAdmin = false;
      if (data && data.length > 0) {
        isAdmin = data.some(ur => ur.roles && ur.roles.code === 'SYSTEM_ADMIN');
      }

      if (!isAdmin) {
        throw new Error("Lỗi Quyền Hạn: Chỉ tài khoản Quản trị viên hệ thống (SYSTEM_ADMIN) mới có quyền thực hiện.");
      }
    }
    return sess.user.id;
  }

  /**
   * Fetch KPIs cho trang Overview
   */
  static async getOverviewMetrics() {
    try {
      await this._ensureAdmin();
      const kpis = await AdminRepository.getKpis();
      return {
        success: true,
        data: kpis
      };
    } catch (e) {
      console.error("[AdminService] getOverviewMetrics Error:", e);
      return {
        success: false,
        error: e.message || "Không thể lấy số liệu tổng quan"
      };
    }
  }

  /**
   * Fetch System Health thật cho trang System Health
   */
  static async getSystemHealth() {
    try {
      await this._ensureAdmin();
      const health = await AdminRepository.getSystemHealth();
      return {
        success: true,
        data: health
      };
    } catch (e) {
      console.error("[AdminService] getSystemHealth Error:", e);
      return {
        success: false,
        error: e.message || "Không thể lấy dữ liệu hệ thống"
      };
    }
  }

  /**
   * Fetch Danh sách Cửa hàng
   */
  static async getAllShops() {
    try {
      await this._ensureAdmin();
      const shops = await AdminRepository.getShops();
      return {
        success: true,
        data: shops
      };
    } catch (e) {
      console.error("[AdminService] getAllShops Error:", e);
      return {
        success: false,
        error: e.message || "Không thể tải danh sách cửa hàng"
      };
    }
  }

  /**
   * Fetch Danh sách Users
   */
  static async getAllUsers() {
    try {
      await this._ensureAdmin();
      const users = await AdminRepository.getUsers();
      return {
        success: true,
        data: users
      };
    } catch (e) {
      console.error("[AdminService] getAllUsers Error:", e);
      return {
        success: false,
        error: e.message || "Không thể tải danh sách người dùng"
      };
    }
  }

  // --- ACTIONS (Kèm Audit Log Tự Động) --- //

  /**
   * Ví dụ: Thay đổi Plan của Shop
   */
  static async updateShopPlan(shopId, oldPlan, newPlan) {
    try {
      await this._ensureAdmin();
      
      // Thực hiện cập nhật thật trong cơ sở dữ liệu
      await AdminRepository.updateShopPlan(shopId, newPlan);

      // Tự động Audit
      await AdminRepository.insertAuditLog(
        'ADMIN_CHANGE_PLAN',
        shopId,
        'shop',
        { plan: oldPlan },
        { plan: newPlan },
        'SUCCESS'
      );

      return { success: true };
    } catch (e) {
      await AdminRepository.insertAuditLog(
        'ADMIN_CHANGE_PLAN',
        shopId,
        'shop',
        { plan: oldPlan },
        { plan: newPlan },
        'FAILED'
      );
      return { success: false, error: e.message };
    }
  }

  /**
   * Fetch Danh sách Shops (Tổng hợp KPIs) cho màn hình Shops
   */
  static async getShopsList() {
    try {
      await this._ensureAdmin();
      const shops = await AdminRepository.getShopsList();
      return {
        success: true,
        data: shops
      };
    } catch (e) {
      console.error("[AdminService] getShopsList Error:", e);
      return {
        success: false,
        error: e.message || "Không thể tải danh sách cửa hàng"
      };
    }
  }

  /**
   * Cập nhật trạng thái Shop (Active/Suspended/Trial)
   */
  static async updateShopStatus(shopId, oldStatus, newStatus) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateShopStatus(shopId, newStatus);
      
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_SHOP_STATUS',
        shopId,
        'shop',
        { status: oldStatus },
        { status: newStatus },
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_SHOP_STATUS',
        shopId,
        'shop',
        { status: oldStatus },
        { status: newStatus },
        'FAILED'
      );
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // SHOP FEATURE FLAGS MANAGEMENT
  // ==========================================

  static async getShopFeatureFlags(shopId) {
    try {
      await this._ensureAdmin();
      const flags = await AdminRepository.getShopFeatureFlags(shopId);
      return { success: true, data: flags };
    } catch (e) {
      console.error("[AdminService] getShopFeatureFlags Error:", e);
      return { success: false, error: e.message || "Không thể tải cấu hình Shop" };
    }
  }

  static async updateShopFeatureFlags(shopId, oldData, updates) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateShopFeatureFlags(shopId, updates);
      
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_SHOP_FLAGS',
        shopId,
        'shop',
        oldData,
        updates,
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_SHOP_FLAGS',
        shopId,
        'shop',
        oldData,
        updates,
        'FAILED'
      );
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================

  /**
   * Fetch Danh sách Users cho Admin Dashboard
   */
  static async getUsersList(filters = {}) {
    try {
      await this._ensureAdmin();
      const users = await AdminRepository.getUsersList(filters);
      return {
        success: true,
        data: users
      };
    } catch (e) {
      console.error("[AdminService] getUsersList Error:", e);
      return {
        success: false,
        error: e.message || "Không thể tải danh sách người dùng"
      };
    }
  }

  /**
   * Cập nhật trạng thái User (Active/Suspended)
   */
  static async updateUserStatus(userId, oldStatus, newStatus) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateUserStatus(userId, newStatus);
      
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_USER_STATUS',
        userId,
        'user',
        { status: oldStatus },
        { status: newStatus },
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_USER_STATUS',
        userId,
        'user',
        { status: oldStatus },
        { status: newStatus },
        'FAILED'
      );
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // DEVICE MANAGEMENT
  // ==========================================

  /**
   * Liệt kê toàn bộ thiết bị trong hệ thống (SYSTEM_ADMIN only)
   */
  static async listDevices() {
    try {
      await this._ensureAdmin();
      const devices = await AdminRepository.listDevices();
      return { success: true, data: devices };
    } catch (e) {
      console.error('[AdminService] listDevices Error:', e);
      return { success: false, error: e.message || 'Không thể tải danh sách thiết bị' };
    }
  }

  /**
   * Thu hồi hoặc khôi phục thiết bị
   */
  static async revokeDevice(deviceId, revoked = true) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.revokeDevice(deviceId, revoked);
      await AdminRepository.insertAuditLog(
        revoked ? 'ADMIN_REVOKE_DEVICE' : 'ADMIN_RESTORE_DEVICE',
        deviceId,
        'device',
        { revoked: !revoked },
        { revoked },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] revokeDevice Error:', e);
      return { success: false, error: e.message || 'Không thể cập nhật thiết bị' };
    }
  }

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  /**
   * Lấy danh sách subscriptions kèm thông tin shop
   */
  static async getSubscriptions() {
    try {
      await this._ensureAdmin();
      const subs = await AdminRepository.getSubscriptions();
      return { success: true, data: subs };
    } catch (e) {
      console.error('[AdminService] getSubscriptions Error:', e);
      return { success: false, error: e.message || 'Không thể tải danh sách subscriptions' };
    }
  }

  /**
   * Cập nhật subscription (đổi plan, trạng thái)
   */
  static async updateSubscription(subscriptionId, oldData, updates) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateSubscription(subscriptionId, updates);
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_SUBSCRIPTION',
        subscriptionId,
        'subscription',
        oldData,
        updates,
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // SUPPORT TICKETS
  // ==========================================

  /**
   * Lấy danh sách support tickets
   */
  static async getSupportTickets(filters = {}) {
    try {
      await this._ensureAdmin();
      const tickets = await AdminRepository.getSupportTickets(filters);
      return { success: true, data: tickets };
    } catch (e) {
      console.error('[AdminService] getSupportTickets Error:', e);
      return { success: false, error: e.message || 'Không thể tải danh sách tickets' };
    }
  }

  /**
   * Cập nhật trạng thái ticket
   */
  static async updateTicketStatus(ticketId, oldStatus, newStatus) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateTicketStatus(ticketId, newStatus);
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_TICKET_STATUS',
        ticketId,
        'support_ticket',
        { status: oldStatus },
        { status: newStatus },
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // RELEASE VERSIONS
  // ==========================================

  /**
   * Lấy danh sách phiên bản Extension
   */
  static async getReleaseVersions() {
    try {
      await this._ensureAdmin();
      const versions = await AdminRepository.getReleaseVersions();
      return { success: true, data: versions };
    } catch (e) {
      console.error('[AdminService] getReleaseVersions Error:', e);
      return { success: false, error: e.message || 'Không thể tải danh sách phiên bản' };
    }
  }

  // ==========================================
  // CARRIER HEALTH
  // ==========================================

  /**
   * Lấy trạng thái sức khoẻ của các nhà vận chuyển
   */
  static async getCarrierHealth() {
    try {
      await this._ensureAdmin();
      const carriers = await AdminRepository.getCarrierHealth();
      return { success: true, data: carriers };
    } catch (e) {
      console.error('[AdminService] getCarrierHealth Error:', e);
      return { success: false, error: e.message || 'Không thể tải dữ liệu carrier' };
    }
  }

  // ==========================================
  // FEATURE FLAGS
  // ==========================================

  /**
   * Lấy danh sách feature flags
   */
  static async getFeatureFlags() {
    try {
      await this._ensureAdmin();
      const flags = await AdminRepository.getFeatureFlags();
      return { success: true, data: flags };
    } catch (e) {
      console.error('[AdminService] getFeatureFlags Error:', e);
      return { success: false, error: e.message || 'Không thể tải feature flags' };
    }
  }

  /**
   * Toggle feature flag
   */
  static async updateFeatureFlag(flagId, oldData, updates) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateFeatureFlag(flagId, updates);
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_FEATURE_FLAG',
        flagId,
        'feature_flag',
        oldData,
        updates,
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // ADDRESS DATASET VERSIONS
  // ==========================================

  /**
   * Lấy danh sách Address Dataset Versions
   */
  static async getAddressDatasets() {
    try {
      await this._ensureAdmin();
      const datasets = await AdminRepository.getAddressDatasets();
      return { success: true, data: datasets };
    } catch (e) {
      console.error('[AdminService] getAddressDatasets Error:', e);
      return { success: false, error: e.message || 'Không thể tải Address Datasets' };
    }
  }

  /**
   * Cập nhật trạng thái Address Dataset (VD: Rollback, Kích hoạt)
   */
  static async updateAddressDatasetStatus(datasetId, oldData, updates) {
    try {
      await this._ensureAdmin();
      await AdminRepository.updateAddressDataset(datasetId, updates);
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_ADDRESS_DATASET',
        datasetId,
        'address_dataset_version',
        oldData,
        updates,
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static async activateAddressDataset(dataset, action, reason) {
    try {
      await this._ensureAdmin();
      if (!dataset?.id || !dataset?.version || Number(dataset.total_records || 0) <= 0) {
        throw new Error('Dataset chưa vượt qua bước validate.');
      }
      if (!['publish', 'rollback'].includes(action)) throw new Error('Hành động phát hành không hợp lệ.');
      if (!reason?.trim()) throw new Error('Phải nhập lý do phát hành hoặc rollback.');
      const result = await AdminRepository.activateAddressDataset(dataset.id, action, reason.trim());
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // SECURITY / AUDIT
  // ==========================================

  /**
   * Lấy thống kê bảo mật và audit logs hôm nay
   */
  static async getSecurityStats() {
    try {
      await this._ensureAdmin();
      const stats = await AdminRepository.getSecurityStats();
      return { success: true, data: stats };
    } catch (e) {
      console.error('[AdminService] getSecurityStats Error:', e);
      return { success: false, data: { total: 0, logs: [] } };
    }
  }
}
