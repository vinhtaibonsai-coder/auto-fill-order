import assert from 'node:assert/strict';
import {
  TIME_PRESETS,
  getOrderDate,
  isOrderInTimePreset,
  filterOrdersByTimePreset,
  calculateOrdersKPI
} from '../../src/ui/options/utils/timeFilter.js';

// Base reference date: 2026-09-05T12:00:00Z
const refDate = new Date('2026-09-05T12:00:00Z');

const sampleOrders = [
  // Today's orders
  {
    id: 'ord-1',
    submitted_at: '2026-09-05T08:30:00Z',
    cod_amount: 500000,
    tracking_code: 'VN123456789VN',
    platform: 'VNPost',
    source_device_id: 'dev-1'
  },
  {
    id: 'ord-2',
    submitted_at: '2026-09-05T10:15:00Z',
    cod_amount: 350000,
    tracking_code: '', // no tracking yet
    platform: 'J&T Express',
    source_device_id: 'dev-1'
  },
  // Yesterday's order
  {
    id: 'ord-3',
    submitted_at: '2026-09-04T15:00:00Z',
    cod_amount: 400000,
    tracking_code: 'JT987654321',
    platform: 'JT',
    source_device_id: 'dev-2'
  },
  // 4 days ago order (within last 7 days & this month)
  {
    id: 'ord-4',
    submitted_at: '2026-09-01T09:00:00Z',
    cod_amount: 250000,
    tracking_code: 'VN999888777VN',
    platform: 'VNPost',
    source_device_id: 'dev-2'
  },
  // Previous month order (2026-08-20)
  {
    id: 'ord-5',
    submitted_at: '2026-08-20T11:00:00Z',
    cod_amount: 600000,
    tracking_code: 'VN111222333VN',
    platform: 'VNPost',
    source_device_id: 'dev-1'
  }
];

// Test 1: TIME_PRESETS structure
assert.equal(TIME_PRESETS.length, 5);
assert.equal(TIME_PRESETS[0].id, 'ALL');
assert.equal(TIME_PRESETS[1].id, 'TODAY');
assert.equal(TIME_PRESETS[2].id, 'YESTERDAY');
assert.equal(TIME_PRESETS[3].id, 'LAST_7_DAYS');
assert.equal(TIME_PRESETS[4].id, 'THIS_MONTH');

// Test 2: ALL preset returns all orders
const allFiltered = filterOrdersByTimePreset(sampleOrders, 'ALL', refDate);
assert.equal(allFiltered.length, 5);
const allKPI = calculateOrdersKPI(allFiltered);
assert.equal(allKPI.count, 5);
assert.equal(allKPI.totalCod, 2100000);
assert.equal(allKPI.trackingCount, 4);
assert.equal(allKPI.vnpostCount, 3);
assert.equal(allKPI.jtCount, 2);
assert.equal(allKPI.hasFullTracking, false); // 1 order missing tracking

// Test 3: TODAY preset
const todayFiltered = filterOrdersByTimePreset(sampleOrders, 'TODAY', refDate);
assert.equal(todayFiltered.length, 2);
assert.deepEqual(todayFiltered.map(o => o.id), ['ord-1', 'ord-2']);
const todayKPI = calculateOrdersKPI(todayFiltered);
assert.equal(todayKPI.count, 2);
assert.equal(todayKPI.totalCod, 850000);
assert.equal(todayKPI.trackingCount, 1);
assert.equal(todayKPI.vnpostCount, 1);
assert.equal(todayKPI.jtCount, 1);

// Test 4: YESTERDAY preset
const yestFiltered = filterOrdersByTimePreset(sampleOrders, 'YESTERDAY', refDate);
assert.equal(yestFiltered.length, 1);
assert.equal(yestFiltered[0].id, 'ord-3');
const yestKPI = calculateOrdersKPI(yestFiltered);
assert.equal(yestKPI.count, 1);
assert.equal(yestKPI.totalCod, 400000);
assert.equal(yestKPI.trackingCount, 1);
assert.equal(yestKPI.hasFullTracking, true);

// Test 5: LAST_7_DAYS preset
const weekFiltered = filterOrdersByTimePreset(sampleOrders, 'LAST_7_DAYS', refDate);
assert.equal(weekFiltered.length, 4); // ord-1, ord-2, ord-3, ord-4
assert.deepEqual(weekFiltered.map(o => o.id), ['ord-1', 'ord-2', 'ord-3', 'ord-4']);

// Test 6: THIS_MONTH preset
const monthFiltered = filterOrdersByTimePreset(sampleOrders, 'THIS_MONTH', refDate);
assert.equal(monthFiltered.length, 4); // ord-1, ord-2, ord-3, ord-4 (ord-5 is in August)

console.log('✅ team-kpi-time-filter.test.mjs passed successfully!');
