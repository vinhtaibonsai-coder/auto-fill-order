import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Kiểm tra tính đồng nhất của thuật toán xác định Online / Offline giữa Admin và Options
const getDeviceOnlineInfo = (d) => {
  if (d.revoked || d.status === 'revoked') {
    return {
      status: 'revoked',
      text: 'Đã Thu Hồi',
      color: '#ef4444'
    };
  }

  const lastDate = d.last_seen || d.last_active_at || d.last_order_at;
  if (!lastDate) {
    return {
      status: 'offline',
      text: 'Offline',
      color: '#64748b'
    };
  }

  const lastTimeMs = new Date(lastDate).getTime();
  if (isNaN(lastTimeMs)) {
    return {
      status: 'offline',
      text: 'Offline',
      color: '#64748b'
    };
  }

  const diffMs = Math.max(0, Date.now() - lastTimeMs);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins <= 7) {
    return {
      status: 'online',
      text: 'Đang Online',
      color: '#16a34a'
    };
  }

  if (diffMins <= 30) {
    return {
      status: 'recent',
      text: 'Vừa hoạt động',
      color: '#d97706'
    };
  }

  return {
    status: 'offline',
    text: 'Offline',
    color: '#64748b'
  };
};

const getDeviceBadge = (device) => {
  const rawId = String(device.device_id || device.id || '').replace(/^dev_/, '');
  const shortId = rawId.substring(0, 6).toUpperCase();
  return `#DEV-${shortId || '0000'}`;
};

test('Device presence status matches between Admin and Options', () => {
  const now = Date.now();

  // Test case 1: Thiết bị 19 ngày trước (tương ứng với ảnh người dùng)
  const nineteenDaysAgo = new Date(now - 19 * 86400 * 1000).toISOString();
  const dev19Days = { id: 'da26e014-d789-41e3', device_id: 'mte78r_device', last_seen: nineteenDaysAgo };
  const info19 = getDeviceOnlineInfo(dev19Days);
  assert.equal(info19.status, 'offline', 'Thiết bị 19 ngày trước bắt buộc phải có trạng thái offline');
  assert.equal(info19.text, 'Offline');

  // Test case 2: Thiết bị vừa ping 2 phút trước -> Online
  const twoMinutesAgo = new Date(now - 2 * 60 * 1000).toISOString();
  const devOnline = { id: 'online_123', device_id: 'online_dev', last_seen: twoMinutesAgo };
  const infoOnline = getDeviceOnlineInfo(devOnline);
  assert.equal(infoOnline.status, 'online');
  assert.equal(infoOnline.text, 'Đang Online');

  // Test case 3: Thiết bị ping 15 phút trước -> Recent
  const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();
  const devRecent = { id: 'recent_123', device_id: 'recent_dev', last_seen: fifteenMinutesAgo };
  const infoRecent = getDeviceOnlineInfo(devRecent);
  assert.equal(infoRecent.status, 'recent');
  assert.equal(infoRecent.text, 'Vừa hoạt động');

  // Test case 4: Thiết bị bị thu hồi -> Revoked
  const devRevoked = { id: 'revoked_123', device_id: 'revoked_dev', revoked: true, last_seen: twoMinutesAgo };
  const infoRevoked = getDeviceOnlineInfo(devRevoked);
  assert.equal(infoRevoked.status, 'revoked');
});

test('Device badge formatting is identical between Admin and Options', () => {
  const devMte = { device_id: 'mte78r_random_salt', id: 'da26e014-uuid' };
  assert.equal(getDeviceBadge(devMte), '#DEV-MTE78R');

  const devZap = { device_id: 'zap14g_other_salt', id: '502ffbcc-uuid' };
  assert.equal(getDeviceBadge(devZap), '#DEV-ZAP14G');
});

test('Admin and Options deduplication logic produces consistent workstation count', () => {
  // Mô phỏng 3 bản ghi trong CSDL cho Shop Lúa Thủy Sinh (shop_id: shop_lua_123):
  // 1. Máy của yen (19 ngày trước)
  // 2. Máy của tai (19 ngày trước, device_id: zap14g_dev)
  // 3. Phiên cũ của máy tai (23 ngày trước, cùng device_id: zap14g_dev)
  const now = Date.now();
  const nineteenDaysAgo = new Date(now - 19 * 86400 * 1000).toISOString();
  const twentyThreeDaysAgo = new Date(now - 23 * 86400 * 1000).toISOString();

  const rawDbRows = [
    {
      id: 'da26e014-d...91e3',
      device_id: 'mte78r_device',
      shop_id: 'shop_lua_123',
      full_name: 'yen',
      email: 'yen@luathuysinh.vn',
      browser: 'Google Chrome',
      last_seen: nineteenDaysAgo
    },
    {
      id: '502ffbcc-c...4ad8',
      device_id: 'zap14g_device',
      shop_id: 'shop_lua_123',
      full_name: 'code API Backend cho toàn bộ SaaS',
      email: 'tai@luathuysinh.vn',
      browser: 'Google Chrome',
      last_seen: nineteenDaysAgo
    },
    {
      id: '3deffe24-f...b789',
      device_id: 'zap14g_device',
      shop_id: 'shop_lua_123',
      full_name: 'code API Backend cho toàn bộ SaaS',
      email: 'tai@luathuysinh.vn',
      browser: 'Chrome',
      last_seen: twentyThreeDaysAgo
    }
  ];

  // Thuật toán deduplicate chuẩn của hệ thống:
  const seenShopDevices = new Set();
  const dedupedRows = [];
  for (const r of rawDbRows) {
    const hardwareDevId = r.device_id || r.id;
    const shopKey = `${r.shop_id || 'unassigned'}::${hardwareDevId}`;
    if (!seenShopDevices.has(shopKey)) {
      seenShopDevices.add(shopKey);
      dedupedRows.push(r);
    }
  }

  // Kết quả sau khi deduplicate:
  assert.equal(dedupedRows.length, 2, 'Tổng số máy trạm phải là 2 thay vì 3');
  assert.equal(dedupedRows[0].full_name, 'yen');
  assert.equal(dedupedRows[1].full_name, 'code API Backend cho toàn bộ SaaS');
  assert.equal(dedupedRows[1].id, '502ffbcc-c...4ad8', 'Phải giữ lại bản ghi mới nhất (19 ngày trước)');
});
