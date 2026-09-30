import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVNPostStatus,
  formatToVNPostDate,
  syncVNPostOrdersToDatabase
} from '../../src/application/carriers/vnpost-sync.engine.js';
import {
  getBaseUrl,
  VNPOST_ENVIRONMENTS
} from '../../src/application/carriers/vnpost-api.service.js';

test('VNPost Connect API Service URL Resolution', () => {
  assert.equal(getBaseUrl('PRODUCTION'), 'https://connect-my.vnpost.vn');
  assert.equal(getBaseUrl('UAT'), 'https://my-uat.vnpost.vn/MYVNP_API');
  assert.equal(getBaseUrl('https://custom.vnpost.vn/'), 'https://custom.vnpost.vn');
});

test('VNPost Status Normalizer accurately maps status codes and labels', () => {
  // Delivered 90
  const d1 = normalizeVNPostStatus('90', 'Phát thành công');
  assert.equal(d1.status, 'delivered');
  assert.equal(d1.statusCode, '90');

  // Returned 100
  const r1 = normalizeVNPostStatus('100', 'Chuyển hoàn');
  assert.equal(r1.status, 'returned');

  // Delivering 70 / 80
  const dl1 = normalizeVNPostStatus('70', 'Đang giao hàng');
  assert.equal(dl1.status, 'delivering');
  const dl2 = normalizeVNPostStatus('80', 'Đang chuyển phát');
  assert.equal(dl2.status, 'delivering');

  // Processing 50
  const p1 = normalizeVNPostStatus('50', 'Đã nhập bưu cục');
  assert.equal(p1.status, 'processing');

  // Pending pickup 1
  const pen1 = normalizeVNPostStatus('1', 'Chờ lấy hàng');
  assert.equal(pen1.status, 'pending_pickup');
});

test('Date formatting for VNPost DD-MM-YYYY', () => {
  const d = new Date(2026, 7, 15); // 15-08-2026
  assert.equal(formatToVNPostDate(d), '15-08-2026');
});

test('syncVNPostOrdersToDatabase respects Order Identity Invariants', async () => {
  const shopId = 'c201e6bc-8986-4f91-b900-e319865d1907';

  // Mock Supabase DB state
  const mockDatabase = [
    {
      id: 'order-1',
      shop_id: shopId,
      order_code: 'DH001',
      tracking_code: 'EM111111111VN',
      status: 'pending',
      customer_name: 'Khách A',
      phone: '0901234567'
    },
    {
      id: 'order-2',
      shop_id: shopId,
      order_code: 'DH002',
      tracking_code: 'EM222222222VN',
      status: 'delivering',
      customer_name: 'Khách B',
      phone: '0907654321'
    }
  ];

  const updateCalls = [];

  const mockSupabase = {
    from: (table) => {
      assert.equal(table, 'submitted_orders');
      return {
        select: () => ({
          eq: () => ({
            is: () => Promise.resolve({ data: mockDatabase, error: null })
          })
        }),
        update: (payload) => ({
          eq: (f1, v1) => ({
            eq: (f2, v2) => {
              updateCalls.push({ payload, id: v1, shopId: v2 });
              return Promise.resolve({ error: null });
            }
          })
        })
      };
    }
  };

  const vnpOrders = [
    // Matches order-1 by tracking_code
    {
      itemCode: 'EM111111111VN',
      saleOrderCode: 'DH001',
      status: '90',
      statusName: 'Phát thành công'
    },
    // Same status as order-2 -> should be skipped
    {
      itemCode: 'EM222222222VN',
      saleOrderCode: 'DH002',
      status: '70',
      statusName: 'Đang giao hàng'
    },
    // Unmatched order (not in database)
    {
      itemCode: 'EM999999999VN',
      saleOrderCode: 'DH999',
      status: '90',
      statusName: 'Phát thành công',
      receiverName: 'Khách Mới'
    }
  ];

  const stats = await syncVNPostOrdersToDatabase({
    vnpostOrders: vnpOrders,
    shopId,
    supabaseClient: mockSupabase
  });

  assert.equal(stats.total, 3);
  assert.equal(stats.matched, 2);
  assert.equal(stats.updated, 1);
  assert.equal(stats.skipped, 1);
  assert.equal(stats.unmatched, 1);

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].id, 'order-1');
  assert.equal(updateCalls[0].payload.status, 'delivered');
});
