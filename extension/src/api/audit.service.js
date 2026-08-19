import { supabase } from '../assets/supabase-config';

export const AuditService = {
  
  /**
   * Log an activity to the audit_logs table
   * @param {string} shopId 
   * @param {string} action (e.g. 'CREATE_ORDER')
   * @param {string} entityType (e.g. 'ORDER')
   * @param {string} entityId 
   * @param {object} details 
   */
  async logActivity(shopId, action, entityType, entityId = null, details = {}) {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([
        {
          shop_id: shopId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details
        }
      ]);
      
    if (error) {
      console.error('Failed to log audit activity:', error);
      // We don't usually throw audit log errors to avoid breaking main workflow
    }
    return data;
  },

  /**
   * Get recent audit logs for a shop
   * @param {string} shopId 
   * @param {number} limit 
   */
  async getRecentLogs(shopId, limit = 50) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, user:user_id(email)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    return data;
  }
};
