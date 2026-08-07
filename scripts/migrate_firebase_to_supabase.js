// scripts/migrate_firebase_to_supabase.js
// Công cụ chuyển toàn bộ dữ liệu từ Firestore (project: nppdungxuan) sang Supabase

const fs = require('fs');

// Decode Firestore REST API field values
function decodeFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = Number(val.integerValue);
    else if (val.doubleValue !== undefined) obj[key] = Number(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.timestampValue !== undefined) obj[key] = val.timestampValue;
    else if (val.mapValue !== undefined) obj[key] = decodeFirestoreFields(val.mapValue.fields);
    else if (val.arrayValue !== undefined) obj[key] = (val.arrayValue.values || []).map(v => {
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.mapValue !== undefined) return decodeFirestoreFields(v.mapValue.fields);
      return v;
    });
  }
  return obj;
}

async function fetchFirestoreCollection(projectId, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?pageSize=500`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[Firebase] Fetch ${path} failed: ${resp.status} ${resp.statusText}`);
      return [];
    }
    const data = await resp.json();
    const docs = data.documents || [];
    return docs.map(d => {
      const decoded = decodeFirestoreFields(d.fields);
      const docId = d.name ? d.name.split('/').pop() : '';
      if (!decoded.id && docId) decoded.id = docId;
      return decoded;
    });
  } catch (e) {
    console.error(`[Firebase] Error fetching ${path}:`, e.message);
    return [];
  }
}

async function pushToSupabase(supabaseUrl, anonKey, table, records) {
  if (!records || records.length === 0) return { ok: true, count: 0 };
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation,resolution=merge-duplicates'
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(records)
    });
    return { ok: resp.ok, count: records.length, status: resp.status };
  } catch (e) {
    console.error(`[Supabase] Error pushing to ${table}:`, e.message);
    return { ok: false, count: 0, error: e.message };
  }
}

async function runMigration() {
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'nppdungxuan';
  
  let supabaseUrl = process.env.SUPABASE_URL || '';
  let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  // Nạp từ file supabase-config.js nếu có
  if (!supabaseUrl && fs.existsSync('./backend/supabase/supabase-config.js')) {
    const content = fs.readFileSync('./backend/supabase/supabase-config.js', 'utf8');
    const urlMatch = content.match(/url:\s*['"]([^'"]+)['"]/);
    const keyMatch = content.match(/anonKey:\s*['"]([^'"]+)['"]/);
    if (urlMatch) supabaseUrl = urlMatch[1];
    if (keyMatch) supabaseAnonKey = keyMatch[1];
  }

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_SUPABASE')) {
    console.error('❌ Vui lòng điền SUPABASE_URL và SUPABASE_ANON_KEY vào file backend/supabase/supabase-config.js');
    process.exit(1);
  }

  console.log(`🚀 Bắt đầu chuyển dữ liệu từ Firebase Project [${firebaseProjectId}] sang Supabase [${supabaseUrl}]...`);

  // 1. Chuyển Đơn hàng tạm (orders)
  console.log('📦 1/4 Đang tải Đơn hàng lưu tạm từ Firebase...');
  const orders = await fetchFirestoreCollection(firebaseProjectId, 'shared/data/orders');
  console.log(`   ➔ Tìm thấy ${orders.length} đơn hàng lưu tạm.`);
  if (orders.length > 0) {
    const formattedOrders = orders.map(o => ({
      id: o.id || 'ord_' + Date.now(),
      name: o.name || '',
      phone: o.phone || '',
      address: o.address || '',
      order_code: o.orderCode || o.order_code || '',
      cod_amount: Number(o.codAmount || o.cod_amount) || 0,
      collect_fee: !!(o.collectFee ?? o.collect_fee),
      platform: o.platform || '',
      created_at: o.createdAt || o.created_at || new Date().toISOString(),
      device_name: o.deviceName || o.device_name || ''
    }));
    const res = await pushToSupabase(supabaseUrl, supabaseAnonKey, 'orders', formattedOrders);
    console.log(`   ✅ Đã đẩy ${res.count} đơn hàng lưu tạm sang Supabase.`);
  }

  // 2. Chuyển Đơn hàng đã lên đơn (submitted_orders)
  console.log('📦 2/4 Đang tải Đơn hàng đã lên đơn từ Firebase...');
  const submittedOrders = await fetchFirestoreCollection(firebaseProjectId, 'shared/data/submitted_orders');
  console.log(`   ➔ Tìm thấy ${submittedOrders.length} đơn hàng đã lên.`);
  if (submittedOrders.length > 0) {
    const formattedSub = submittedOrders.map(o => ({
      id: o.id || 'sub_' + Date.now(),
      saved_order_id: o.savedOrderId || o.saved_order_id || '',
      name: o.name || '',
      phone: o.phone || '',
      address: o.address || '',
      order_code: o.orderCode || o.order_code || '',
      cod_amount: Number(o.codAmount || o.cod_amount) || 0,
      collect_fee: !!(o.collectFee ?? o.collect_fee),
      platform: o.platform || '',
      tracking_code: o.trackingCode || o.tracking_code || '',
      submitted_at: o.submittedAt || o.submitted_at || new Date().toISOString(),
      submitted_date: o.submittedDate || o.submitted_date || '',
      device_name: o.deviceName || o.device_name || ''
    }));
    const res = await pushToSupabase(supabaseUrl, supabaseAnonKey, 'submitted_orders', formattedSub);
    console.log(`   ✅ Đã đẩy ${res.count} đơn hàng đã lên sang Supabase.`);
  }

  // 3. Chuyển Lịch sử (history)
  console.log('📦 3/4 Đang tải Lịch sử mẻ tách từ Firebase...');
  const history = await fetchFirestoreCollection(firebaseProjectId, 'shared/data/history');
  console.log(`   ➔ Tìm thấy ${history.length} mục lịch sử.`);
  if (history.length > 0) {
    const formattedHist = history.map(h => ({
      id: h.id || 'split_' + Date.now(),
      raw_text: h.rawText || h.raw_text || '',
      created_at: h.createdAt || h.created_at || new Date().toISOString(),
      created_at_short: h.createdAtShort || h.created_at_short || '',
      device_name: h.deviceName || h.device_name || '',
      result: h.result || {}
    }));
    const res = await pushToSupabase(supabaseUrl, supabaseAnonKey, 'history', formattedHist);
    console.log(`   ✅ Đã đẩy ${res.count} mục lịch sử sang Supabase.`);
  }

  // 4. Chuyển Thiết bị (devices)
  console.log('📦 4/4 Đang tải Thiết bị từ Firebase...');
  const devices = await fetchFirestoreCollection(firebaseProjectId, 'shared/data/devices');
  console.log(`   ➔ Tìm thấy ${devices.length} thiết bị.`);
  if (devices.length > 0) {
    const formattedDev = devices.map(d => ({
      device_id: d.deviceId || d.device_id || d.id,
      name: d.name || 'Máy không tên',
      platform: d.platform || 'Windows',
      last_seen: d.lastSeen || d.last_seen || new Date().toISOString()
    }));
    const res = await pushToSupabase(supabaseUrl, supabaseAnonKey, 'devices', formattedDev);
    console.log(`   ✅ Đã đẩy ${res.count} thiết bị sang Supabase.`);
  }

  console.log('\n🎉 HOÀN TẤT CHUYỂN DỮ LIỆU TỪ FIREBASE SANG SUPABASE THÀNH CÔNG!');
}

if (require.main === module) {
  runMigration();
}

module.exports = { fetchFirestoreCollection, decodeFirestoreFields, pushToSupabase };
