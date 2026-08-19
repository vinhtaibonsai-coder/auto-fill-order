import { supabase } from '../assets/supabase-config';

export const SubscriptionService = {
  
  /**
   * Get active subscription for a shop
   * @param {string} shopId 
   */
  async getSubscription(shopId) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('status', 'ACTIVE')
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 is not found
      throw error;
    }
    return data;
  },

  /**
   * Create or update a subscription (typically done via server/stripe webhook, but provided here for Admin usage)
   * @param {string} shopId 
   * @param {object} payload 
   */
  async upsertSubscription(shopId, payload) {
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        shop_id: shopId,
        ...payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'shop_id' })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }
};
