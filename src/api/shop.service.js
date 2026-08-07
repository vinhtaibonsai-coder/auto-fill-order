import { supabase } from '../assets/supabase-config';

export const ShopService = {
  
  /**
   * Fetch current shop profile
   * @param {string} shopId 
   */
  async getShopProfile(shopId) {
    const { data, error } = await supabase
      .from('shops')
      .select('name, shop_code, phone, email, address, ai_quota_monthly, ai_quota_used, order_defaults')
      .eq('id', shopId)
      .single();
      
    if (error) throw error;
    return data;
  },

  /**
   * Update shop profile
   * @param {string} shopId 
   * @param {object} updates 
   */
  async updateShopProfile(shopId, updates) {
    const { data, error } = await supabase
      .from('shops')
      .update(updates)
      .eq('id', shopId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  /**
   * Fetch shop team members
   * @param {string} shopId 
   */
  async getShopMembers(shopId) {
    const { data, error } = await supabase
      .from('shop_members')
      .select('id, user_id, role, created_at')
      .eq('shop_id', shopId);
      
    if (error) throw error;
    return data;
  }
};
