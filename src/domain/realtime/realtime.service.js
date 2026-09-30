// =========================================================================
// REALTIME.SERVICE.JS — DỊCH VỤ ĐỒNG BỘ REALTIME & PRESENCE MÁY TRẠM (SUPABASE)
// =========================================================================

const RealtimeService = {
  _activeChannel: null,
  _presenceChannels: new Map(),

  async _getClient() {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.getSupabaseClient === 'function') {
      const client = await SupabaseCloud.getSupabaseClient();
      if (client) return client;
    }
    if (typeof window !== 'undefined' && window.supabaseClient) {
      return window.supabaseClient;
    }
    if (typeof globalThis !== 'undefined' && globalThis.supabaseClient) {
      return globalThis.supabaseClient;
    }
    try {
      const configRes = typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.loadConfig === 'function'
        ? await SupabaseCloud.loadConfig()
        : null;
      if (configRes?.url && configRes?.anonKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const client = createClient(configRes.url, configRes.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'sb-afo-singleton-auth'
          }
        });
        if (typeof window !== 'undefined') window.supabaseClient = client;
        if (typeof globalThis !== 'undefined') globalThis.supabaseClient = client;
        return client;
      }
    } catch (e) {
      console.warn('[RealtimeService] Không thể tự động khởi tạo Supabase Client:', e);
    }
    return null;
  },

  async subscribeShopChannel(shopId, onDataChanged) {
    if (!shopId) {
      const activeShop = typeof ShopService !== 'undefined' ? await ShopService.getActiveShop() : null;
      if (activeShop) shopId = activeShop.id;
    }
    if (!shopId) return false;

    console.log(`[RealtimeService] Đã lắng nghe Kênh Realtime Shop: shop-${shopId}`);
    const client = await this._getClient();
    if (client) {
      try {
        if (this._activeChannel) {
          client.removeChannel(this._activeChannel);
        }

        const channelName = `shop-${shopId}`;
        this._activeChannel = client
          .channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            console.log('[Realtime] Nhận sự kiện Đơn nháp:', payload?.eventType || 'change');
            if (typeof onDataChanged === 'function') onDataChanged('orders', payload);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'submitted_orders' }, payload => {
            console.log('[Realtime] Nhận sự kiện Đơn đã lên:', payload?.eventType || 'change');
            if (typeof onDataChanged === 'function') onDataChanged('submitted_orders', payload);
          })
          .subscribe();
      } catch (e) {
        console.warn('[RealtimeService] Lỗi subscribe channel:', e);
      }
    }
    return true;
  },

  _extractOnlineMap(channel) {
    if (!channel || typeof channel.presenceState !== 'function') return {};
    const state = channel.presenceState();
    const onlineMap = {};
    for (const [key, presences] of Object.entries(state || {})) {
      if (Array.isArray(presences) && presences.length > 0) {
        const latest = presences[presences.length - 1];
        if (latest && latest.device_id) {
          onlineMap[latest.device_id] = latest;
        }
      }
    }
    return onlineMap;
  },

  _getOrCreatePresenceEntry(shopId, client, initialKey = null) {
    const channelName = `workstations-presence-${shopId}`;
    let entry = this._presenceChannels.get(channelName);

    if (!entry) {
      if (typeof client.getChannels === 'function') {
        const existing = client.getChannels().find(
          ch => ch.topic === `realtime:${channelName}` || ch.topic === channelName
        );
        if (existing) {
          try {
            client.removeChannel(existing);
          } catch (_) {}
        }
      }

      const presenceKey = initialKey || `listener-${Math.random().toString(36).slice(2, 8)}`;
      const channel = client.channel(channelName, {
        config: {
          presence: {
            key: presenceKey
          }
        }
      });

      entry = {
        channel,
        listeners: new Set(),
        trackedPayload: null,
        isSubscribed: false,
        isSubscribing: false
      };

      const handlePresenceSync = () => {
        const onlineMap = this._extractOnlineMap(channel);
        entry.listeners.forEach(cb => {
          try {
            cb(onlineMap);
          } catch (e) {
            console.error('[Realtime Presence] Lỗi callback presence:', e);
          }
        });
      };

      // In Supabase Realtime, .on() callbacks MUST be registered before .subscribe()
      if (typeof channel.on === 'function') {
        channel
          .on('presence', { event: 'sync' }, handlePresenceSync)
          .on('presence', { event: 'join' }, handlePresenceSync)
          .on('presence', { event: 'leave' }, handlePresenceSync);
      }

      this._presenceChannels.set(channelName, entry);
    }

    return entry;
  },

  _ensureChannelSubscribed(entry, channelName) {
    if (entry.isSubscribed || entry.isSubscribing) return;
    entry.isSubscribing = true;

    try {
      entry.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          entry.isSubscribed = true;
          entry.isSubscribing = false;
          console.log(`[Realtime Presence] Kênh ${channelName} đã kết nối WebSocket.`);
          if (entry.trackedPayload) {
            console.log(`[Realtime Presence] Bắt đầu phát hiện diện trực tuyến: ${entry.trackedPayload.device_id}`);
            await entry.channel.track(entry.trackedPayload).catch(e => console.warn('[Realtime Presence] Lỗi track:', e));
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          entry.isSubscribed = false;
          entry.isSubscribing = false;
        }
      });
    } catch (e) {
      entry.isSubscribing = false;
      console.warn('[Realtime Presence] Lỗi gọi subscribe channel:', e);
    }
  },

  /**
   * Phương Án 1: Máy trạm phát tín hiệu hiện diện (Presence) qua WebSocket
   * Zero DB write - Tự động phát hiện offline trong vài giây khi tab/trình duyệt đóng
   */
  async trackWorkstationPresence(shopId, deviceInfo) {
    if (!shopId || !deviceInfo?.device_id) return false;
    const client = await this._getClient();
    if (!client) return false;

    const channelName = `workstations-presence-${shopId}`;
    const deviceId = deviceInfo.device_id;

    try {
      const entry = this._getOrCreatePresenceEntry(shopId, client, deviceId);
      const payload = {
        device_id: deviceId,
        device_name: deviceInfo.device_name || 'Máy trạm Kho',
        staff_name: deviceInfo.staff_name || 'Nhân viên',
        user_id: deviceInfo.user_id || null,
        client_type: deviceInfo.client_type || 'EXTENSION',
        surface: deviceInfo.surface || 'EXTENSION_PANEL',
        online_at: new Date().toISOString()
      };
      entry.trackedPayload = payload;

      this._ensureChannelSubscribed(entry, channelName);

      if (entry.isSubscribed) {
        await entry.channel.track(payload).catch(e => console.warn('[Realtime Presence] Lỗi track:', e));
      }

      return true;
    } catch (err) {
      console.warn('[Realtime Presence] Lỗi phát hiện diện:', err);
      return false;
    }
  },

  /**
   * Ngắt tín hiệu hiện diện khi đăng xuất hoặc chủ động tắt máy
   */
  async untrackWorkstationPresence(shopId, deviceId) {
    if (!shopId) return;
    const channelName = `workstations-presence-${shopId}`;
    const entry = this._presenceChannels.get(channelName);
    if (entry) {
      try {
        entry.trackedPayload = null;
        await entry.channel.untrack().catch(() => {});
        console.log(`[Realtime Presence] Đã dừng phát hiện diện thiết bị: ${deviceId || ''}`);
        if (entry.listeners.size === 0) {
          const client = await this._getClient();
          if (client) client.removeChannel(entry.channel);
          this._presenceChannels.delete(channelName);
        }
      } catch (_) {}
    }
  },

  /**
   * Dashboard Admin & Trang Quản Lý Nhân Viên lắng nghe danh sách máy online trực tiếp
   */
  async subscribeWorkstationPresence(shopId, onPresenceChange) {
    if (!shopId) return () => {};
    const client = await this._getClient();
    if (!client) return () => {};

    const channelName = `workstations-presence-${shopId}`;

    try {
      const entry = this._getOrCreatePresenceEntry(shopId, client);

      if (typeof onPresenceChange === 'function') {
        entry.listeners.add(onPresenceChange);

        // Báo ngay trạng thái hiện diện hiện tại nếu đã có
        const currentMap = this._extractOnlineMap(entry.channel);
        if (Object.keys(currentMap).length > 0) {
          try {
            onPresenceChange(currentMap);
          } catch (_) {}
        }
      }

      this._ensureChannelSubscribed(entry, channelName);

      return () => {
        try {
          if (typeof onPresenceChange === 'function') {
            entry.listeners.delete(onPresenceChange);
          }
          if (entry.listeners.size === 0 && !entry.trackedPayload) {
            client.removeChannel(entry.channel);
            this._presenceChannels.delete(channelName);
          }
        } catch (_) {}
      };
    } catch (err) {
      console.warn('[Realtime Presence] Lỗi subscribe presence:', err);
      return () => {};
    }
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.RealtimeService = RealtimeService;
}
if (typeof window !== 'undefined') {
  window.RealtimeService = RealtimeService;
}

