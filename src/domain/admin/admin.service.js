import { AdminRepository } from './admin.repository.js';
import { AuthSession } from '../auth/auth.session.js';

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
    // TODO: Verify Role is ADMIN here if embedded in JWT 
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
      
      // Giả sử gọi Repository update ở đây
      // const res = await AdminRepository.updateShopPlan(shopId, newPlan);

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
}
