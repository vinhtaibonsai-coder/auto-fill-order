// =========================================================================
// REALTIME.SERVICE.JS — DỊCH VỤ ĐỒNG BỘ REALTIME THEO CHANNEL SHOP (SHOP-UUID)
// =========================================================================

const RealtimeService = {
  _activeChannel: null,

  async subscribeShopChannel(shopId, onDataChanged) {
    if (!shopId) {
      const activeShop = typeof ShopService !== 'undefined' ? await ShopService.getActiveShop() : null;
      if (activeShop) shopId = activeShop.id;
    }
    if (!shopId) return false;

    console.log(`[RealtimeService] Đã lắng nghe Kênh Realtime Shop: shop-${shopId}`);

    if (typeof SupabaseCloud !== 'undefined' && typeof window !== 'undefined' && window.supabaseClient) {
      try {
        if (this._activeChannel) {
          window.supabaseClient.removeChannel(this._activeChannel);
        }

        const channelName = `shop-${shopId}`;
        this._activeChannel = window.supabaseClient
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            console.log('[Realtime] Nhận sự kiện Đơn nháp:', payload);
            if (typeof onDataChanged === 'function') onDataChanged('orders', payload);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'submitted_orders' }, payload => {
            console.log('[Realtime] Nhận sự kiện Đơn đã lên:', payload);
            if (typeof onDataChanged === 'function') onDataChanged('submitted_orders', payload);
          })
          .subscribe();
      } catch (e) {
        console.warn('[RealtimeService] Lỗi subscribe channel:', e);
      }
    }
    return true;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.RealtimeService = RealtimeService;
}
