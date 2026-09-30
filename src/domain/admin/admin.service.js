import { AdminRepository } from './admin.repository.js';
import { AuthSession } from '../auth/auth.session.esm.js';
import { FeatureFlagEvaluator } from '../feature-flags/evaluator.js';

/**
 * Admin Service - Lớp Xử Lý Business Logic (Service Layer)
 * Giao tiếp với UI component. Bọc lỗi, định dạng Response.
 */
export class AdminService {
  /**
   * Kiểm tra Authentication & Authorization (Frontend Basic)
   * Lớp an ninh chính vẫn nằm ở Supabase RLS.
   */
  static async _ensureAdmin(allowSupport = false) {
    const sess = await AuthSession.getSession().catch(() => null);
    if (!sess || !sess.user) {
      throw new Error("Lỗi Xác Thực: Bạn chưa đăng nhập.");
    }

    const email = String(sess.user.email || '').toLowerCase();
    const sessRole = String(sess.role || sess.user.role || sess.user.app_metadata?.role || '').toUpperCase();
    if (email.startsWith('admin@') || sessRole === 'SYSTEM_ADMIN' || sessRole === 'SUPER_ADMIN') {
      return sess.user.id;
    }

    // Kiểm tra quyền Admin ở tầng ứng dụng bằng cách truy cập Supabase client trực tiếp
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);
    try {
      const res = await fetch(
        `${configRes.url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(sess.user.id)}&select=role_id,roles(code)`,
        { headers }
      );

      if (res.ok) {
        const rows = await res.json().catch(() => []);
        const isSysAdmin = Array.isArray(rows) && rows.some(ur => ur.roles && ur.roles.code === 'SYSTEM_ADMIN');
        const isSupport = Array.isArray(rows) && rows.some(ur => ur.roles && (ur.roles.code === 'SUPPORT_STAFF' || ur.roles.code === 'STAFF'));

        if (isSysAdmin || (allowSupport && isSupport)) {
          return sess.user.id;
        }
      }
    } catch (_) {}

    if (allowSupport && (sessRole === 'SUPPORT_STAFF' || sessRole === 'STAFF')) {
      return sess.user.id;
    }

    throw new Error("Lỗi Quyền Hạn: Bạn không có quyền truy cập chức năng này.");
  }

  /**
   * Fetch KPIs cho trang Overview
   */
  static async getOverviewMetrics(range = '30days') {
    try {
      await this._ensureAdmin();
      const kpis = await AdminRepository.getKpis(range);
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
   * Action: Thử lại các tác vụ đồng bộ thất bại
   */
  static async retryFailedSyncs() {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.retryFailedSyncs();
      return {
        success: true,
        data: res
      };
    } catch (e) {
      console.error("[AdminService] retryFailedSyncs Error:", e);
      return {
        success: false,
        error: e.message || "Không thể thực thi thử lại đồng bộ"
      };
    }
  }

  /**
   * Action: Kiểm tra kết nối và độ phản hồi bưu cục
   */
  static async pingCarrier(carrierCode) {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.pingCarrier(carrierCode);
      return {
        success: true,
        data: res
      };
    } catch (e) {
      console.error("[AdminService] pingCarrier Error:", e);
      return {
        success: false,
        error: e.message || "Không thể gửi tín hiệu kiểm tra bưu cục"
      };
    }
  }

  /**
   * Action: Xóa cache và tải lại toàn bộ Schema
   */
  static async flushSystemCache() {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.flushSystemCache();
      return {
        success: true,
        data: res
      };
    } catch (e) {
      console.error("[AdminService] flushSystemCache Error:", e);
      return {
        success: false,
        error: e.message || "Không thể xóa cache hệ thống"
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

  static async getAiModelCostRates() {
    return await AdminRepository.getAiModelCostRates();
  }

  static async getAiCostAnalytics(from, to) {
    return await AdminRepository.getAiCostAnalytics(from, to);
  }

  static async getProviderResilienceAnalytics(from, to) {
    return await AdminRepository.getProviderResilienceAnalytics(from, to);
  }

  static async getOutboxMetrics() {
    return await AdminRepository.getOutboxMetrics();
  }

  static async replayDeadLetterJobs(queueType = null, jobIds = null) {
    return await AdminRepository.replayDeadLetterJobs(queueType, jobIds);
  }

  static async retryOutboxJob(jobId) {
    return await AdminRepository.retryOutboxJob(jobId);
  }

  static async getDataQualityKpis(range = '30d') {
    return await AdminRepository.getDataQualityKpis(range);
  }

  static async getDataQualityDrilldown(kpiType, range = '30d', limit = 50, offset = 0) {
    return await AdminRepository.getDataQualityDrilldown(kpiType, range, limit, offset);
  }

  static async resolveDataQualityIssue(issueType, recordId, note = 'Đã xử lý') {
    return await AdminRepository.resolveDataQualityIssue(issueType, recordId, note);
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
   * Lấy toàn diện dữ liệu Shop 360: Quota thực, đơn bóc tách & 50 đơn gần nhất
   */
  static async getShop360Data(shopId) {
    try {
      await this._ensureAdmin();
      const data = await AdminRepository.getShop360Data(shopId);
      return {
        success: true,
        data: data
      };
    } catch (e) {
      console.error("[AdminService] getShop360Data Error:", e);
      return {
        success: false,
        error: e.message || "Không thể tải dữ liệu Shop 360"
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
  // SHOP MEMBERS MANAGEMENT
  // ==========================================

  /**
   * Lấy danh sách thành viên của Shop
   */
  static async getShopMembers(shopId) {
    try {
      await this._ensureAdmin();
      const members = await AdminRepository.getShopMembers(shopId);
      return { success: true, data: members };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Gán người dùng vào Shop
   */
  static async assignUserShop(userId, shopId, roleCode = 'STAFF') {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.assignUserShop(userId, shopId, roleCode);
      await AdminRepository.insertAuditLog('ADMIN_ASSIGN_SHOP_MEMBER', shopId, 'shop_member', { userId, roleCode }, null, 'SUCCESS');
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Tạo tài khoản mới và gán trực tiếp vào Shop
   */
  static async createAndAddShopMember(shopId, memberData) {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.createAndAddShopMember(shopId, memberData);
      await AdminRepository.insertAuditLog('ADMIN_CREATE_ADD_SHOP_MEMBER', shopId, 'shop_member', { email: memberData.email, role: memberData.roleCode }, null, 'SUCCESS');
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Xóa nhân viên khỏi Shop
   */
  static async removeShopMember(shopId, userId) {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.removeShopMember(shopId, userId);
      await AdminRepository.insertAuditLog('ADMIN_REMOVE_SHOP_MEMBER', shopId, 'shop_member', { userId }, null, 'SUCCESS');
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Lấy tất cả user cho autocomplete
   */
  static async getAllUsers() {
    try {
      await this._ensureAdmin();
      const users = await AdminRepository.getUsersList({ limit: 1000 });
      return { success: true, data: users };
    } catch (e) {
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
        data: Array.isArray(users) ? users : []
      };
    } catch (e) {
      console.error("[AdminService] getUsersList Error:", e);
      return {
        success: false,
        data: [],
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

  /**
   * Xóa vĩnh viễn tài khoản người dùng (SYSTEM_ADMIN only)
   */
  static async deleteUser(userId, userEmail = '') {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.deleteUser(userId);
      await AdminRepository.insertAuditLog(
        'ADMIN_DELETE_USER',
        userId,
        'user',
        { email: userEmail },
        null,
        'SUCCESS'
      );
      return { success: true, data: res };
    } catch (e) {
      await AdminRepository.insertAuditLog(
        'ADMIN_DELETE_USER',
        userId,
        'user',
        { email: userEmail },
        null,
        'FAILED'
      );
      return { success: false, error: e.message };
    }
  }

  /**
   * Xóa hàng loạt tài khoản người dùng
   */
  static async deleteMultipleUsers(userIds) {
    try {
      await this._ensureAdmin();
      let count = 0;
      for (const id of userIds) {
        const res = await AdminRepository.deleteUser(id);
        if (res?.success || res === true) count++;
      }
      await AdminRepository.insertAuditLog(
        'ADMIN_BULK_DELETE_USERS',
        'bulk',
        'user',
        { count, userIds },
        null,
        'SUCCESS'
      );
      return { success: true, count };
    } catch (e) {
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
      return { success: false, error: e.message || 'Không thể tải danh sách thiết bị', data: [] };
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

  /**
   * Thu hồi toàn bộ thiết bị của một Shop
   */
  static async revokeShopDevices(shopId) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.revokeShopDevices(shopId);
      await AdminRepository.insertAuditLog(
        'ADMIN_REVOKE_SHOP_DEVICES',
        shopId,
        'shop',
        {},
        { shopId, action: 'REVOKE_ALL' },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] revokeShopDevices Error:', e);
      return { success: false, error: e.message || 'Không thể thu hồi thiết bị Shop' };
    }
  }

  /**
   * Dọn dẹp thiết bị / profile trùng lặp rác (1-Click)
   */
  static async cleanupInactiveDevices(shopId) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.cleanupInactiveDevices(shopId);
      await AdminRepository.insertAuditLog(
        'ADMIN_CLEANUP_INACTIVE_DEVICES',
        shopId || 'GLOBAL',
        'device',
        {},
        { shopId },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] cleanupInactiveDevices Error:', e);
      return { success: false, error: e.message || 'Không thể dọn dẹp thiết bị rác' };
    }
  }

  /**
   * Chuyển / Gán thiết bị sang Shop khác
   */
  static async assignDeviceToShop(deviceId, shopId) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.assignDeviceToShop(deviceId, shopId);
      await AdminRepository.insertAuditLog(
        'ADMIN_ASSIGN_DEVICE_SHOP',
        deviceId,
        'device',
        {},
        { deviceId, targetShopId: shopId },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] assignDeviceToShop Error:', e);
      return { success: false, error: e.message || 'Không thể gán Shop cho thiết bị' };
    }
  }

  /**
   * Đổi tên gợi nhớ cho thiết bị
   */
  static async updateDeviceName(deviceId, deviceName) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.updateDeviceName(deviceId, deviceName);
      await AdminRepository.insertAuditLog(
        'ADMIN_RENAME_DEVICE',
        deviceId,
        'device',
        {},
        { deviceId, deviceName },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] updateDeviceName Error:', e);
      return { success: false, error: e.message || 'Không thể đổi tên thiết bị' };
    }
  }

  /**
   * Điều chỉnh số lượng máy trạm tối đa (max_devices) của Shop
   */
  static async updateShopMaxDevices(shopId, maxDevices) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.updateShopMaxDevices(shopId, maxDevices);
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_SHOP_MAX_DEVICES',
        shopId,
        'shop',
        {},
        { shopId, max_devices: maxDevices },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] updateShopMaxDevices Error:', e);
      return { success: false, error: e.message || 'Không thể cập nhật hạn mức số máy của Shop' };
    }
  }

  /**
   * Xóa vĩnh viễn thiết bị khỏi hệ thống
   */
  static async deleteDevice(deviceId) {
    try {
      await this._ensureAdmin();
      const result = await AdminRepository.deleteDevice(deviceId);
      await AdminRepository.insertAuditLog(
        'ADMIN_DELETE_DEVICE',
        deviceId,
        'device',
        {},
        { deviceId },
        'SUCCESS'
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] deleteDevice Error:', e);
      return { success: false, error: e.message || 'Không thể xóa thiết bị' };
    }
  }

  /**
   * Lấy lịch sử đơn hàng bóc tách của thiết bị
   */
  static async getDeviceOrders(deviceId, limit = 50) {
    try {
      await this._ensureAdmin();
      const orders = await AdminRepository.getDeviceOrders(deviceId, limit);
      return { success: true, data: orders };
    } catch (e) {
      console.error('[AdminService] getDeviceOrders Error:', e);
      return { success: false, error: e.message || 'Không thể tải lịch sử đơn của thiết bị', data: [] };
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
   * Tạo mới feature flag
   */
  static async createFeatureFlag(flagData) {
    try {
      await this._ensureAdmin();
      const created = await AdminRepository.createFeatureFlag(flagData);
      await AdminRepository.insertAuditLog(
        'ADMIN_CREATE_FEATURE_FLAG',
        created?.id || 'new',
        'feature_flag',
        null,
        flagData,
        'SUCCESS'
      );
      return { success: true, data: created };
    } catch (e) {
      console.error('[AdminService] createFeatureFlag Error:', e);
      return { success: false, error: e.message || 'Không thể tạo feature flag' };
    }
  }

  /**
   * Toggle hoặc chỉnh sửa feature flag
   */
  static async updateFeatureFlag(flagId, oldData, updates) {
    try {
      await this._ensureAdmin();
      const res = await AdminRepository.updateFeatureFlag(flagId, updates);
      await AdminRepository.insertAuditLog(
        'ADMIN_UPDATE_FEATURE_FLAG',
        flagId,
        'feature_flag',
        oldData,
        updates,
        'SUCCESS'
      );
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] updateFeatureFlag Error:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Xóa feature flag vĩnh viễn
   */
  static async deleteFeatureFlag(flagId, flagKey = '') {
    try {
      await this._ensureAdmin();
      await AdminRepository.deleteFeatureFlag(flagId);
      await AdminRepository.insertAuditLog(
        'ADMIN_DELETE_FEATURE_FLAG',
        flagId,
        'feature_flag',
        { id: flagId, key: flagKey },
        null,
        'SUCCESS'
      );
      return { success: true };
    } catch (e) {
      console.error('[AdminService] deleteFeatureFlag Error:', e);
      return { success: false, error: e.message || 'Không thể xóa feature flag' };
    }
  }

  /**
   * Đánh giá xem feature flag có hiệu lực cho ngữ cảnh hiện tại hay không
   */
  static evaluateFeatureFlag(flag, context = {}) {
    return FeatureFlagEvaluator.isEnabled(flag, context);
  }

  /**
   * Đánh giá toàn bộ danh sách feature flags thành key-value map
   */
  static evaluateAllFeatureFlags(flags = [], context = {}) {
    return FeatureFlagEvaluator.evaluateAll(flags, context);
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

  static async _runAdminAction(action, targetId, targetType, beforeState, afterState, operation) {
    try {
      await this._ensureAdmin();
      const data = await operation();
      await AdminRepository.insertAuditLog(action, targetId, targetType, beforeState, afterState, 'SUCCESS');
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('admin:refresh_data', { 
          detail: { action, targetId, targetType, timestamp: Date.now() } 
        }));
      }
      return { success: true, data };
    } catch (e) {
      await AdminRepository.insertAuditLog(action, targetId, targetType, beforeState, afterState, 'FAILED');
      return { success: false, error: e.message };
    }
  }

  static createShopWithAccount(form) {
    const password = form.password || `Afo@${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}!`;
    return this._runAdminAction('ADMIN_CREATE_SHOP', null, 'shop', null, { email: form.ownerEmail }, () => AdminRepository.createShopWithAccount({ ...form, password, dailyAiLimit: 500 }));
  }

  static topupQuota(shopId, amount) {
    if (![500, 1000, 2000].includes(Number(amount))) return Promise.resolve({ success: false, error: 'Mức cấp quota không hợp lệ.' });
    return this._runAdminAction('ADMIN_TOPUP_QUOTA', shopId, 'shop_quota', null, { amount }, () => AdminRepository.topupQuota(shopId, Number(amount)));
  }
  static async getQuotaOverview() { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.getQuotaOverview() }; } catch (e) { return { success: false, error: e.message }; } }

  static transferShopOwnership(shopId, targetIdentifier) {
    const trimmed = String(targetIdentifier || '').trim();
    if (!trimmed) return Promise.resolve({ success: false, error: 'Vui lòng nhập Email hoặc UUID tài khoản chủ sở hữu mới.' });

    return this._runAdminAction('ADMIN_TRANSFER_OWNERSHIP', shopId, 'shop', null, { target: trimmed }, async () => {
      let targetUserId = trimmed;
      const isEmail = trimmed.includes('@');
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

      if (isEmail || !isUUID) {
        const foundUser = await AdminRepository.findUserByEmailOrId(trimmed);
        if (!foundUser || !foundUser.id) {
          throw new Error(`Không tìm thấy tài khoản người dùng với email/tên "${trimmed}" trong hệ thống.`);
        }
        targetUserId = foundUser.id;
      }

      return await AdminRepository.transferShopOwnership(shopId, targetUserId);
    });
  }
  static createAdminAccount(data) { return this._runAdminAction('ADMIN_CREATE_ACCOUNT', null, 'user', null, { email: data.email, role: data.role }, () => AdminRepository.createAdminAccount(data)); }

  static startImpersonation(shopId, shopName, reason) {
    if (!reason?.trim()) return Promise.resolve({ success: false, error: 'Phải nhập lý do giả lập Shop.' });
    return this._runAdminAction('IMPERSONATION_START', shopId, 'shop', null, { reason }, async () => {
      await AdminRepository.startImpersonation(shopId, reason.trim());
      return { shopId, shopName, reason: reason.trim(), startedAt: new Date().toISOString() };
    });
  }

  static setUserRole(userId, role) { return this._runAdminAction('ADMIN_SET_USER_ROLE', userId, 'user', null, { role }, () => AdminRepository.setUserRole(userId, role)); }
  static overrideSubscription(shopId, plan, months) { return this._runAdminAction('ADMIN_OVERRIDE_SUBSCRIPTION', shopId, 'subscription', null, { plan, months }, () => AdminRepository.overrideSubscription(shopId, plan, months)); }
  static revokeShopDevices(shopId) { return this._runAdminAction('ADMIN_REVOKE_SHOP_DEVICES', shopId, 'device', null, { revoked: true }, () => AdminRepository.revokeShopDevices(shopId)); }
  static replySupportTicket(ticketId, reply, internalNote) { return this._runAdminAction('ADMIN_REPLY_TICKET', ticketId, 'support_ticket', null, { hasReply: true, hasInternalNote: Boolean(internalNote) }, () => AdminRepository.replySupportTicket(ticketId, reply, internalNote)); }
  static publishRelease(data) { return this._runAdminAction('ADMIN_PUBLISH_RELEASE', data.version, 'release', null, data, () => AdminRepository.publishRelease(data)); }
  static recordCarrierProbe(carrierCode, status, responseTimeMs, errorMessage) { return this._runAdminAction('ADMIN_CARRIER_PROBE', carrierCode, 'carrier', null, { status, responseTimeMs, errorMessage }, () => AdminRepository.recordCarrierProbe(carrierCode, status, responseTimeMs, errorMessage)); }

  static async probeCarrierHealth(carrierCode) {
    await this._ensureAdmin();
    return {
      success: false,
      status: 'unknown',
      carrierCode,
      error: 'Chưa cấu hình probe phía máy chủ. Không thể xác nhận trạng thái hãng từ trình duyệt.'
    };
  }
  static async getUnitEconomics() { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.getUnitEconomics() }; } catch (e) { return { success: false, error: e.message }; } }
  static publishRemoteSelectors(data) { return this._runAdminAction('ADMIN_PUBLISH_REMOTE_SELECTORS', data.carrierCode, 'remote_selector_release', null, { minVersion: data.minVersion, keys: Object.keys(data.selectors || {}) }, () => AdminRepository.publishRemoteSelectors(data)); }
  static async listRemoteSelectorReleases(carrierCode, limit = 20) { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.listRemoteSelectorReleases(carrierCode, limit) }; } catch(e) { return { success:false,error:e.message,data:[] }; } }
  static rollbackRemoteSelectors(carrierCode, version, reason) { return this._runAdminAction('ADMIN_ROLLBACK_REMOTE_SELECTORS', `${carrierCode}:${version}`, 'remote_selector_release', null, { reason }, () => AdminRepository.rollbackRemoteSelectors(carrierCode, version, reason)); }
  static async getGrowthMetrics() { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.getGrowthMetrics() }; } catch (e) { return { success: false, error: e.message }; } }
  static async getCommercialIntelligence(range = '30days') { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.getCommercialIntelligence(range) }; } catch (e) { return { success: false, error: e.message }; } }
  static async getUnitEconomicsAnalytics(range = '30days') { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.getUnitEconomicsAnalytics(range) }; } catch (e) { return { success: false, error: e.message }; } }
  static async globalSearch(query, limit = 12) {
    if (!query || String(query).trim().length < 2) return { success: true, data: [] };
    try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.globalSearch(query, limit) }; }
    catch (e) { return { success: false, error: e.message, data: [] }; }
  }
  static async getRetentionPortfolio(inactiveDays = 3, expiringDays = 3) { try { await this._ensureAdmin(); return { success: true, data: await AdminRepository.getRetentionPortfolio(inactiveDays, expiringDays) }; } catch(e) { return { success: false, error: e.message }; } }
  static recordRetentionAction(shopId, actionType, note, status = 'DONE') { return this._runAdminAction('ADMIN_RETENTION_ACTION', shopId, 'shop', null, { actionType, status }, () => AdminRepository.recordRetentionAction(shopId, actionType, note, status)); }
  static async generateRetentionSnapshots(snapshotDate = null, inactiveDays = 3, expiringDays = 3) {
    try {
      await this._ensureAdmin();
      return { success: true, data: await AdminRepository.generateRetentionSnapshots(snapshotDate, inactiveDays, expiringDays) };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }
  static createPlaybookTask(shopId, playbookCode, assigneeId = null, assigneeName = null, dueAt = null, note = null) {
    return this._runAdminAction('ADMIN_CREATE_PLAYBOOK_TASK', shopId, 'shop', null, { playbookCode, assigneeName }, () =>
      AdminRepository.createPlaybookTask(shopId, playbookCode, assigneeId, assigneeName, dueAt, note)
    );
  }
  static updateRetentionTask(taskId, status, outcome = null, nextAction = null, note = null) {
    return this._runAdminAction('ADMIN_UPDATE_RETENTION_TASK', taskId, 'retention_task', null, { status, outcome }, () =>
      AdminRepository.updateRetentionTask(taskId, status, outcome, nextAction, note)
    );
  }
  static async getCohortRetentionAnalytics(months = 6) {
    try {
      await this._ensureAdmin();
      return { success: true, data: await AdminRepository.getCohortRetentionAnalytics(months) };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }
  static async getRetentionTasks(status = 'ALL', playbook = 'ALL', limit = 50) {
    try {
      await this._ensureAdmin();
      return { success: true, data: await AdminRepository.getRetentionTasks(status, playbook, limit) };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }
  static creditWallet(shopId, amount, referenceId, description) { return this._runAdminAction('ADMIN_CREDIT_WALLET', shopId, 'wallet', null, { amount, referenceId }, () => AdminRepository.creditWallet(shopId, amount, referenceId, description)); }
  static async getWalletDetails(shopId) {
    try {
      return { success: true, data: await AdminRepository.getWalletDetails(shopId) };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }
  static topupWallet(shopId, amount, reason, referenceId = null) {
    return this._runAdminAction('ADMIN_TOPUP_WALLET', shopId, 'wallet', null, { amount, reason }, () =>
      AdminRepository.topupWalletWithAudit(shopId, amount, reason, referenceId)
    );
  }
  static refundWallet(shopId, amount, reason, referenceId = null) {
    return this._runAdminAction('ADMIN_REFUND_WALLET', shopId, 'wallet', null, { amount, reason }, () =>
      AdminRepository.refundWalletWithAudit(shopId, amount, reason, referenceId)
    );
  }
  static createReseller(name, code, commissionRate) { return this._runAdminAction('ADMIN_CREATE_RESELLER', code, 'reseller', null, { name, commissionRate }, () => AdminRepository.createReseller(name, code, commissionRate)); }
  static async getResellerPortalOverview(resellerId = null) {
    try {
      return { success: true, data: await AdminRepository.getResellerPortalOverview(resellerId) };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }
  static recordResellerCommissionFromPayment(paymentId) {
    return this._runAdminAction('ADMIN_RECORD_RESELLER_COMMISSION', paymentId, 'payment', null, {}, () =>
      AdminRepository.recordResellerCommissionFromPayment(paymentId)
    );
  }
  static reverseResellerCommission(paymentId, refundAmount, reason = 'Refund') {
    return this._runAdminAction('ADMIN_REVERSE_RESELLER_COMMISSION', paymentId, 'payment', null, { refundAmount, reason }, () =>
      AdminRepository.reverseResellerCommission(paymentId, refundAmount, reason)
    );
  }
  static generateResellerPayoutStatement(resellerId, periodStart, periodEnd) {
    return this._runAdminAction('ADMIN_GENERATE_RESELLER_PAYOUT', resellerId, 'reseller', null, { periodStart, periodEnd }, () =>
      AdminRepository.generateResellerPayoutStatement(resellerId, periodStart, periodEnd)
    );
  }
  static payResellerStatement(statementId, payoutRef) {
    return this._runAdminAction('ADMIN_PAY_RESELLER_STATEMENT', statementId, 'payout_statement', null, { payoutRef }, () =>
      AdminRepository.payResellerStatement(statementId, payoutRef)
    );
  }

  static resetUserPassword(userId, newPassword, forceLogout = true) {
    if (!newPassword || newPassword.length < 6) {
      return Promise.resolve({ success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }
    return this._runAdminAction('ADMIN_RESET_PASSWORD', userId, 'user', null, { forceLogout }, async () => {
      await AdminRepository.resetUserPassword(userId, newPassword);
      if (forceLogout) {
        await AdminRepository.forceLogoutUser(userId).catch(() => {});
      }
      return { userId, forceLogout };
    });
  }

  static updateUserName(userId, fullName) {
    if (!fullName?.trim()) {
      return Promise.resolve({ success: false, error: 'Họ và tên không được để trống.' });
    }
    return this._runAdminAction('ADMIN_UPDATE_USER_NAME', userId, 'user', null, { fullName: fullName.trim() }, () => AdminRepository.updateUserName(userId, fullName.trim()));
  }

  static assignUserShop(userId, shopId, roleCode) {
    return this._runAdminAction('ADMIN_ASSIGN_USER_SHOP', userId, 'user', null, { shopId, roleCode }, () => AdminRepository.assignUserShop(userId, shopId, roleCode));
  }

  static async getShopMembers(shopId) {
    try {
      await this._ensureAdmin();
      const members = await AdminRepository.getShopMembers(shopId);
      return { success: true, data: members || [] };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static removeShopMember(shopId, userId) {
    return this._runAdminAction('ADMIN_REMOVE_SHOP_MEMBER', shopId, 'shop_member', null, { userId }, () => AdminRepository.removeShopMember(shopId, userId));
  }

  static forceLogoutUser(userId) {
    return this._runAdminAction('ADMIN_FORCE_LOGOUT_USER', userId, 'user', null, { revoked: true }, () => AdminRepository.forceLogoutUser(userId));
  }

  static restoreShop(shopId, shopName) {
    return this._runAdminAction('ADMIN_RESTORE_SHOP', shopId, 'shop', null, { name: shopName }, () => AdminRepository.restoreShop(shopId));
  }

  static deleteShop(shopId, shopName) {
    return this._runAdminAction('ADMIN_DELETE_SHOP', shopId, 'shop', { name: shopName }, null, () => AdminRepository.deleteShop(shopId));
  }

  static deleteMultipleShops(shopIds = []) {
    if (!Array.isArray(shopIds) || shopIds.length === 0) return Promise.resolve({ success: true, count: 0 });
    return this._runAdminAction('ADMIN_BULK_DELETE_SHOPS', null, 'shop', null, { count: shopIds.length, shopIds }, async () => {
      await AdminRepository.deleteMultipleShops(shopIds);
      return { count: shopIds.length };
    });
  }

  static async purgeInactiveShops() {
    try {
      await this._ensureAdmin();
      const listRes = await this.getShopsList();
      if (!listRes.success || !Array.isArray(listRes.data)) throw new Error(listRes.error || 'Không thể lấy danh sách Shop');
      const inactives = listRes.data.filter(s => {
        const status = String(s.status || '').toLowerCase();
        const usersCount = Number(s.users_count || 0);
        const devicesCount = Number(s.devices_count || 0);
        const isDummy = String(s.name || '').startsWith('Shop của ') && usersCount === 0;
        return ((status === 'inactive' || status === 'deleted' || usersCount === 0) && devicesCount === 0) || isDummy;
      });
      if (inactives.length === 0) return { success: true, count: 0 };
      let deleted = 0;
      for (const s of inactives) {
        try {
          await AdminRepository.deleteShop(s.id);
          deleted++;
        } catch (_) {}
      }
      await AdminRepository.insertAuditLog('ADMIN_PURGE_INACTIVE_SHOPS', null, 'shop', null, { count: deleted }, 'SUCCESS');
      return { success: true, count: deleted };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Lấy Role hiện tại của tài khoản Admin/Staff
   */
  static async getCurrentAdminRole() {
    try {
      const sess = await AuthSession.getSession().catch(() => null);
      if (!sess?.user) return null;
      const configRes = await AdminRepository._getConfig();
      const headers = await AdminRepository._getAuthHeaders(configRes);
      const res = await fetch(
        `${configRes.url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(sess.user.id)}&select=role_id,roles(code)`,
        { headers }
      );
      if (!res.ok) return null;
      const rows = await res.json().catch(() => []);
      if (rows.some(ur => ur.roles && (ur.roles.code === 'SYSTEM_ADMIN' || ur.roles.code === 'SUPER_ADMIN'))) {
        return 'SYSTEM_ADMIN';
      }
      if (rows.some(ur => ur.roles && (ur.roles.code === 'SUPPORT_STAFF' || ur.roles.code === 'STAFF'))) {
        return 'SUPPORT_STAFF';
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ==========================================
  // GLOBAL ORDERS EXPLORER (READ-ONLY AUDIT)
  // Cho phép cả SYSTEM_ADMIN và SUPPORT_STAFF
  // ==========================================
  static async getGlobalOrders({ search = '', shopId = null, platform = '', source = '', limit = 50, offset = 0 } = {}) {
    try {
      await this._ensureAdmin(true); // Cho phép Support Staff
      const orders = await AdminRepository.getGlobalOrders({ search, shopId, platform, source, limit, offset });
      return { success: true, data: orders };
    } catch (e) {
      console.error('[AdminService] getGlobalOrders Error:', e);
      return { success: false, error: e.message, data: [] };
    }
  }

  // ==========================================
  // LICENSE KEYS & COMMERCE
  // ==========================================
  static async generateLicenseKeys({ type, value, planCode = 'PRO', count = 1, notes = '', expiresDays = null }) {
    try {
      await this._ensureAdmin(false); // Chỉ Master Admin
      const keys = await AdminRepository.generateLicenseKeys({ type, value, planCode, count, notes, expiresDays });
      await AdminRepository.insertAuditLog('ADMIN_GENERATE_LICENSE_KEYS', null, 'license_key', null, { type, value, planCode, count }, 'SUCCESS');
      return { success: true, data: keys };
    } catch (e) {
      console.error('[AdminService] generateLicenseKeys Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async revokeLicenseKey(keyId, reason = 'Admin revoked') {
    return this._runAdminAction('ADMIN_REVOKE_LICENSE_KEY', keyId, 'license_key', null, { reason }, async () => {
      return await AdminRepository.revokeLicenseKey(keyId, reason);
    });
  }

  static async getLicenseKeys({ status = null, limit = 100 } = {}) {
    try {
      await this._ensureAdmin(false); // Chỉ Master Admin
      const keys = await AdminRepository.getLicenseKeys({ status, limit });
      return { success: true, data: keys };
    } catch (e) {
      console.error('[AdminService] getLicenseKeys Error:', e);
      return { success: false, error: e.message, data: [] };
    }
  }

  static async getPaymentTransactions({ limit = 50 } = {}) {
    try {
      await this._ensureAdmin(false); // Chỉ Master Admin
      const txs = await AdminRepository.getPaymentTransactions({ limit });
      return { success: true, data: txs };
    } catch (e) {
      console.error('[AdminService] getPaymentTransactions Error:', e);
      return { success: false, error: e.message, data: [] };
    }
  }

  static async getPaymentReconciliationQueue({ status = 'ALL', search = '', limit = 50, offset = 0 } = {}) {
    try {
      await this._ensureAdmin(false);
      const res = await AdminRepository.getPaymentReconciliationQueue({ status, search, limit, offset });
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] getPaymentReconciliationQueue Error:', e);
      return { success: false, error: e.message, data: { items: [], stats: {}, total: 0 } };
    }
  }

  static async reconcilePaymentTransaction({ transactionId, targetShopId, notes = '' } = {}) {
    try {
      await this._ensureAdmin(false);
      const res = await AdminRepository.reconcilePaymentTransaction({ transactionId, targetShopId, notes });
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] reconcilePaymentTransaction Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async getIncidents({ status = null, severity = null, limit = 50, offset = 0 } = {}) {
    try {
      await this._ensureAdmin(false);
      const res = await AdminRepository.getIncidents({ status, severity, limit, offset });
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] getIncidents Error:', e);
      return { success: false, error: e.message, data: { incidents: [], summary: {} } };
    }
  }

  static async updateIncidentStatus({ incidentId, action, owner = null, notes = null } = {}) {
    try {
      await this._ensureAdmin(false);
      const res = await AdminRepository.updateIncidentStatus({ incidentId, action, owner, notes });
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] updateIncidentStatus Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async applyLicenseKey(shopId, code) {
    try {
      const result = await AdminRepository.applyLicenseKey(shopId, code);
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] applyLicenseKey Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async activateLicenseKeyForShop(shopId, code) {
    return this._runAdminAction('ADMIN_ACTIVATE_LICENSE_KEY', shopId, 'license_key', null, { code }, async () => {
      return await AdminRepository.activateLicenseKeyForShop(shopId, code);
    });
  }

  static async quickExtendSubscription(shopId, months = 1) {
    return this._runAdminAction('ADMIN_QUICK_EXTEND_SUBSCRIPTION', shopId, 'subscription', null, { months }, async () => {
      return await AdminRepository.quickExtendSubscription(shopId, months);
    });
  }

  // ==========================================
  // SYSTEM WEBHOOKS (ALERTS)
  // ==========================================
  static async getSystemWebhooks() {
    try {
      await this._ensureAdmin(false);
      const hooks = await AdminRepository.getSystemWebhooks();
      return { success: true, data: hooks };
    } catch (e) {
      console.error('[AdminService] getSystemWebhooks Error:', e);
      return { success: false, error: e.message, data: [] };
    }
  }

  static async saveSystemWebhook(payload) {
    try {
      await this._ensureAdmin(false);
      await AdminRepository.saveSystemWebhook(payload);
      return { success: true };
    } catch (e) {
      console.error('[AdminService] saveSystemWebhook Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async sendTestWebhook(webhookUrl, platform = 'GENERIC') {
    try {
      await this._ensureAdmin(false);
      if (!webhookUrl || !webhookUrl.startsWith('http')) {
        throw new Error('URL Webhook không hợp lệ.');
      }

      let payload = {};
      const msg = `🟢 [Auto Fill Order] Webhook Ping Test thành công lúc ${new Date().toLocaleString('vi-VN')}! Hệ thống giám sát sẵn sàng.`;
      
      const plat = (platform || '').toUpperCase();
      if (plat === 'DISCORD') {
        payload = { content: msg, username: 'Auto Fill Order Bot' };
      } else if (plat === 'LARK' || plat === 'FEISHU') {
        payload = { msg_type: 'text', content: { text: msg } };
      } else if (plat === 'SLACK') {
        payload = { text: msg };
      } else {
        payload = {
          event: 'TEST_PING',
          message: msg,
          timestamp: new Date().toISOString(),
          system: 'Auto Fill Order Extension'
        };
      }

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Webhook phản hồi mã lỗi HTTP ${res.status}`);
      }
      return { success: true };
    } catch (e) {
      console.error('[AdminService] sendTestWebhook Error:', e);
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // GLOBAL KNOWLEDGE GOVERNANCE (ADMIN)
  // ==========================================
  static async getLearningCandidates(limit = 50) {
    try {
      await this._ensureAdmin(false);
      const candidates = await AdminRepository.getLearningCandidates(limit);
      return { success: true, data: candidates };
    } catch (e) {
      console.error('[AdminService] getLearningCandidates Error:', e);
      return { success: false, error: e.message, data: [] };
    }
  }

  static async promoteToGlobalAlias(rawKey, mapping) {
    try {
      await this._ensureAdmin(false);
      const result = await AdminRepository.promoteToGlobalAlias(rawKey, mapping);
      await AdminRepository.insertAuditLog('ADMIN_PROMOTE_GLOBAL_ALIAS', null, 'global_alias', null, { rawKey, mapping }, 'SUCCESS');
      return { success: true, data: result };
    } catch (e) {
      console.error('[AdminService] promoteToGlobalAlias Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async promoteBatchGlobalAliases(entries) {
    try {
      await this._ensureAdmin(false);
      const res = await AdminRepository.promoteBatchGlobalAliases(entries);
      await AdminRepository.insertAuditLog('ADMIN_PROMOTE_BATCH_GLOBAL_ALIASES', null, 'global_alias', null, { count: entries.length }, 'SUCCESS');
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] promoteBatchGlobalAliases Error:', e);
      return { success: false, error: e.message };
    }
  }


  static async getGlobalAliases() {
    try {
      await this._ensureAdmin(false);
      const aliases = await AdminRepository.getGlobalAliases();
      return { success: true, data: aliases };
    } catch (e) {
      console.error('[AdminService] getGlobalAliases Error:', e);
      return { success: false, error: e.message, data: [] };
    }
  }

  static async deleteGlobalAlias(aliasId) {
    try {
      await this._ensureAdmin(false);
      await AdminRepository.deleteGlobalAlias(aliasId);
      await AdminRepository.insertAuditLog('ADMIN_DELETE_GLOBAL_ALIAS', aliasId, 'global_alias', null, { aliasId }, 'SUCCESS');
      return { success: true };
    } catch (e) {
      console.error('[AdminService] deleteGlobalAlias Error:', e);
      return { success: false, error: e.message };
    }
  }

  static async mineHistoricalKnowledge(shopId = null) {
    try {
      await this._ensureAdmin(false);
      const res = await AdminRepository.mineHistoricalKnowledge(shopId);
      await AdminRepository.insertAuditLog('ADMIN_MINE_HISTORICAL_KNOWLEDGE', null, 'learning_kb', null, { shopId, res }, 'SUCCESS');
      return { success: true, data: res };
    } catch (e) {
      console.error('[AdminService] mineHistoricalKnowledge Error:', e);
      return { success: false, error: e.message };
    }
  }
}
