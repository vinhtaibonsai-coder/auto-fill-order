import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeService } from '../../src/domain/realtime/realtime.service.esm.js';

test('RealtimeService - trackWorkstationPresence broadcasts presence payload on channel', async () => {
  let trackedPayload = null;
  let subscribedChannelName = null;
  let subscribedPresenceKey = null;

  const mockChannel = {
    subscribe: (callback) => {
      callback('SUBSCRIBED');
      return mockChannel;
    },
    track: async (payload) => {
      trackedPayload = payload;
      return 'ok';
    },
    untrack: async () => 'ok'
  };

  const mockClient = {
    channel: (name, opts) => {
      subscribedChannelName = name;
      subscribedPresenceKey = opts?.config?.presence?.key;
      return mockChannel;
    },
    removeChannel: () => {}
  };

  globalThis.supabaseClient = mockClient;

  const success = await RealtimeService.trackWorkstationPresence('shop-test-123', {
    device_id: 'dev_chromebook_01',
    device_name: 'Máy trạm Kho 1',
    staff_name: 'Nguyễn Văn A',
    client_type: 'EXTENSION',
    surface: 'EXTENSION_PANEL'
  });

  assert.equal(success, true, 'trackWorkstationPresence must return true');
  assert.equal(subscribedChannelName, 'workstations-presence-shop-test-123');
  assert.equal(subscribedPresenceKey, 'dev_chromebook_01');
  assert.equal(trackedPayload.device_id, 'dev_chromebook_01');
  assert.equal(trackedPayload.device_name, 'Máy trạm Kho 1');
  assert.equal(trackedPayload.staff_name, 'Nguyễn Văn A');
  assert.equal(trackedPayload.surface, 'EXTENSION_PANEL');
  assert.ok(trackedPayload.online_at, 'online_at timestamp must be present');
});

test('RealtimeService - subscribeWorkstationPresence reacts to sync and leave events', async () => {
  let presenceSyncHandler = null;
  let currentPresenceState = {
    dev_1: [{ device_id: 'dev_1', staff_name: 'Huy Kho', online_at: '2026-09-23T06:00:00Z' }]
  };

  const mockChannel = {
    presenceState: () => currentPresenceState,
    on: (type, filter, handler) => {
      if (type === 'presence' && filter.event === 'sync') {
        presenceSyncHandler = handler;
      }
      return mockChannel;
    },
    subscribe: () => mockChannel
  };

  let removedChannel = null;
  const mockClient = {
    channel: () => mockChannel,
    removeChannel: (ch) => { removedChannel = ch; }
  };

  globalThis.supabaseClient = mockClient;

  let lastReportedMap = null;
  const unsub = await RealtimeService.subscribeWorkstationPresence('shop-abc', (map) => {
    lastReportedMap = map;
  });

  assert.ok(presenceSyncHandler, 'Must register sync handler');
  
  // Trigger initial sync
  presenceSyncHandler();
  assert.deepEqual(Object.keys(lastReportedMap), ['dev_1']);
  assert.equal(lastReportedMap.dev_1.staff_name, 'Huy Kho');

  // Device disconnects (leaves)
  currentPresenceState = {};
  presenceSyncHandler();
  assert.deepEqual(Object.keys(lastReportedMap), []);

  // Unsubscribe cleanly
  unsub();
  assert.equal(removedChannel, mockChannel);
});

test('Workstation Status Resolution - Prioritizes Realtime presence over DB last_seen', () => {
  const getDeviceOnlineInfo = (d, presenceMap = {}) => {
    if (d.revoked) {
      return { status: 'revoked', text: 'Đã Thu Hồi', label: 'Khóa Quyền' };
    }

    const devId = d.device_id || d.id;
    if (presenceMap && presenceMap[devId]) {
      return {
        status: 'online',
        text: 'Trực tuyến Realtime',
        label: '🟢 Trực tuyến Realtime',
        isRealtime: true,
        diffMins: 0
      };
    }

    const lastDate = d.last_seen || d.last_active_at;
    if (!lastDate) {
      return { status: 'offline', text: 'Offline', label: 'Chưa Từng Kết Nối' };
    }

    const diffMins = Math.floor((Date.now() - new Date(lastDate).getTime()) / 60000);
    if (diffMins <= 7) {
      return { status: 'online', text: 'Đang Online', label: '🟢 Online (DB)' };
    }
    return { status: 'offline', text: 'Offline', label: '⚪ Offline' };
  };

  // Case 1: Device in Realtime presence -> 0s sub-second online
  const deviceWithPresence = { device_id: 'dev_live_99', last_seen: new Date(Date.now() - 3600000).toISOString() };
  const presenceMap = { dev_live_99: { device_id: 'dev_live_99', online_at: new Date().toISOString() } };
  
  const res1 = getDeviceOnlineInfo(deviceWithPresence, presenceMap);
  assert.equal(res1.status, 'online');
  assert.equal(res1.isRealtime, true);
  assert.equal(res1.label, '🟢 Trực tuyến Realtime');

  // Case 2: Device NOT in Realtime presence -> Fallback to DB last_seen
  const res2 = getDeviceOnlineInfo(deviceWithPresence, {});
  assert.equal(res2.status, 'offline', '1 hour old device without realtime presence is offline');
  assert.equal(res2.label, '⚪ Offline');

  // Case 3: Revoked device -> Revoked takes strict precedence
  const revokedDevice = { device_id: 'dev_revoked_01', revoked: true };
  const res3 = getDeviceOnlineInfo(revokedDevice, { dev_revoked_01: {} });
  assert.equal(res3.status, 'revoked');
  assert.equal(res3.label, 'Khóa Quyền');
});

test('RealtimeService - trackWorkstationPresence and subscribeWorkstationPresence coexist without error after subscribe()', async () => {
  let isSubscribed = false;
  let presenceSyncHandler = null;
  let trackCalledWith = null;

  const strictSupabaseChannel = {
    presenceState: () => ({
      dev_k1: [{ device_id: 'dev_k1', staff_name: 'Lan Kho', online_at: '2026-09-25T08:00:00Z' }]
    }),
    on: (type, filter, handler) => {
      if (isSubscribed) {
        throw new Error("cannot add 'presence' callbacks for realtime:workstations-presence-shop-concurrent after 'subscribe()'");
      }
      if (type === 'presence' && filter.event === 'sync') {
        presenceSyncHandler = handler;
      }
      return strictSupabaseChannel;
    },
    subscribe: (callback) => {
      isSubscribed = true;
      if (typeof callback === 'function') callback('SUBSCRIBED');
      return strictSupabaseChannel;
    },
    track: async (payload) => {
      trackCalledWith = payload;
      return 'ok';
    },
    untrack: async () => 'ok'
  };

  const client = {
    channel: () => strictSupabaseChannel,
    removeChannel: () => {}
  };
  globalThis.supabaseClient = client;

  // 1. App.jsx calls trackWorkstationPresence
  const tracked = await RealtimeService.trackWorkstationPresence('shop-concurrent', {
    device_id: 'dev_k1',
    device_name: 'Máy trạm Kho A',
    staff_name: 'Lan Kho'
  });
  assert.equal(tracked, true);
  assert.equal(trackCalledWith.device_id, 'dev_k1');

  // 2. Team.jsx calls subscribeWorkstationPresence on the SAME shop
  // This must NOT throw "cannot add 'presence' callbacks after 'subscribe()'"
  let receivedMap = null;
  const unsub = await RealtimeService.subscribeWorkstationPresence('shop-concurrent', (map) => {
    receivedMap = map;
  });

  // Verify sync triggers callback
  assert.ok(presenceSyncHandler, 'Sync handler must be registered');
  presenceSyncHandler();
  assert.equal(receivedMap.dev_k1.staff_name, 'Lan Kho');

  // Clean up
  unsub();
  await RealtimeService.untrackWorkstationPresence('shop-concurrent', 'dev_k1');
});

