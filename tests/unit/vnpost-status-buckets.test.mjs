import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVNPostStatus,
  syncVNPostOrdersToDatabase
} from '../../src/application/carriers/vnpost-sync.engine.js';

test('1. Bucket "Tạo đơn" maps to created/submitted and is separated from "Chờ lấy hàng"', () => {
  const t1 = normalizeVNPostStatus('0', 'Tạo đơn');
  assert.ok(['created', 'submitted'].includes(t1.status), 'Tạo đơn must map to created or submitted');
  assert.equal(t1.statusName, 'Tạo đơn');
  assert.notEqual(t1.status, 'pending_pickup', 'Tạo đơn must be separate from Chờ lấy hàng');

  const t2 = normalizeVNPostStatus('created', 'Đã tạo đơn');
  assert.ok(['created', 'submitted'].includes(t2.status));

  const t3 = normalizeVNPostStatus('submitted', 'Mới tạo');
  assert.ok(['created', 'submitted'].includes(t3.status));
});

test('2. Bucket "Chờ lấy hàng" maps to pending_pickup', () => {
  const p1 = normalizeVNPostStatus('1', 'Chờ lấy hàng');
  assert.equal(p1.status, 'pending_pickup');
  assert.equal(p1.statusName, 'Chờ lấy hàng');

  const p2 = normalizeVNPostStatus('pending_pickup', 'Chờ thu gom');
  assert.equal(p2.status, 'pending_pickup');
});

test('3. Bucket "Nhận hàng" maps to accepted/processing', () => {
  const a1 = normalizeVNPostStatus('50', 'Nhận hàng');
  assert.ok(['accepted', 'processing'].includes(a1.status), 'Nhận hàng must map to accepted or processing');
  assert.equal(a1.statusName, 'Nhận hàng');

  const a2 = normalizeVNPostStatus('accepted', 'Đã nhận hàng');
  assert.ok(['accepted', 'processing'].includes(a2.status));

  const a3 = normalizeVNPostStatus('50', 'Đã nhập bưu cục');
  assert.ok(['accepted', 'processing'].includes(a3.status));
});

test('4. Bucket "Đang vận chuyển" maps to delivering', () => {
  const d1 = normalizeVNPostStatus('70', 'Đang vận chuyển');
  assert.equal(d1.status, 'delivering');
  assert.equal(d1.statusName, 'Đang vận chuyển');

  const d2 = normalizeVNPostStatus('70', 'Đang giao hàng');
  assert.equal(d2.status, 'delivering');

  const d3 = normalizeVNPostStatus('80', 'Đang chuyển phát');
  assert.equal(d3.status, 'delivering');
});

test('5. Bucket "Đang phát hàng" maps to out_for_delivery', () => {
  const o1 = normalizeVNPostStatus('80', 'Đang phát hàng');
  assert.equal(o1.status, 'out_for_delivery');
  assert.equal(o1.statusName, 'Đang phát hàng');

  const o2 = normalizeVNPostStatus('out_for_delivery', 'Đi phát hàng');
  assert.equal(o2.status, 'out_for_delivery');
});

test('6. Bucket "Phát hàng thành công" maps to delivered', () => {
  const s1 = normalizeVNPostStatus('90', 'Phát hàng thành công');
  assert.equal(s1.status, 'delivered');
  assert.equal(s1.statusName, 'Phát hàng thành công');

  const s2 = normalizeVNPostStatus('90', 'Giao hàng thành công');
  assert.equal(s2.status, 'delivered');
});

test('7. Bucket "Phát không thành công" maps to delivery_failed and does not match delivered', () => {
  const f1 = normalizeVNPostStatus('failed', 'Phát không thành công');
  assert.equal(f1.status, 'delivery_failed');
  assert.notEqual(f1.status, 'delivered', 'Must not confuse with delivered');
  assert.equal(f1.statusName, 'Phát không thành công');

  const f2 = normalizeVNPostStatus('delivery_failed', 'Giao không thành công');
  assert.equal(f2.status, 'delivery_failed');

  const f3 = normalizeVNPostStatus('', 'Phát thất bại');
  assert.equal(f3.status, 'delivery_failed');
});

test('8. Bucket "Hủy" maps to cancelled', () => {
  const c1 = normalizeVNPostStatus('cancel', 'Hủy đơn');
  assert.equal(c1.status, 'cancelled');
  assert.equal(c1.statusName, 'Hủy đơn');

  const c2 = normalizeVNPostStatus('cancelled', 'Đã huỷ');
  assert.equal(c2.status, 'cancelled');
});

test('9. Bucket "Đối soát" maps to reconciled', () => {
  const r1 = normalizeVNPostStatus('reconciled', 'Đối soát');
  assert.equal(r1.status, 'reconciled');
  assert.equal(r1.statusName, 'Đối soát');

  const r2 = normalizeVNPostStatus('', 'Đã đối soát');
  assert.equal(r2.status, 'reconciled');
});

test('10. Unknown or missing status does NOT fallback to pending or Chờ lấy hàng', () => {
  const u1 = normalizeVNPostStatus('', '');
  assert.equal(u1.status, null, 'Empty status must return null status, not pending');
  assert.equal(u1.isUnknown, true);
  assert.notEqual(u1.statusName, 'Chờ lấy hàng');

  const u2 = normalizeVNPostStatus(null, null);
  assert.equal(u2.status, null);
  assert.equal(u2.isUnknown, true);

  const u3 = normalizeVNPostStatus('MYSTERIOUS_STATUS_99', 'Trạng thái lạ');
  assert.equal(u3.status, null);
  assert.equal(u3.isUnknown, true);
  assert.notEqual(u3.status, 'pending');
  assert.notEqual(u3.statusName, 'Chờ lấy hàng');
});

test('11. syncVNPostOrdersToDatabase: preserves existing DB status on unknown status and logs raw status to webhook_logs', async () => {
  const shopId = 'shop-resilience-123';
  const mockDb = [
    {
      id: 'ord-existing-delivering',
      shop_id: shopId,
      order_code: 'DH_DELIV',
      tracking_code: 'VN_DELIV_01',
      status: 'delivering',
      customer_name: 'Khách Test',
      webhook_logs: []
    }
  ];

  let updatePayloadCapture = null;
  const mockSupabase = {
    from: (table) => {
      assert.equal(table, 'submitted_orders');
      return {
        select: () => ({
          eq: () => ({
            is: () => Promise.resolve({ data: mockDb, error: null })
          })
        }),
        update: (payload) => {
          updatePayloadCapture = payload;
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null })
            })
          };
        }
      };
    }
  };

  // Sync order with unknown status
  const stats = await syncVNPostOrdersToDatabase({
    vnpostOrders: [
      {
        itemCode: 'VN_DELIV_01',
        saleOrderCode: 'DH_DELIV',
        status: 'UNKNOWN_CODE_XYZ',
        statusName: 'Hành trình chưa định danh',
        weight: 250 // Has weight update to trigger save
      }
    ],
    shopId,
    supabaseClient: mockSupabase
  });

  assert.equal(stats.total, 1);
  assert.equal(stats.updated, 1);
  assert.ok(updatePayloadCapture, 'Update payload must be generated');

  // Requirement 4: Preserves existing status in DB
  assert.equal(updatePayloadCapture.status, undefined, 'Must NOT overwrite existing status with null or pending');
  assert.equal(mockDb[0].status, 'delivering', 'DB record must keep its previous delivering status');

  // Requirement 5: Stores raw status and raw status name in webhook_logs for debugging
  assert.ok(Array.isArray(updatePayloadCapture.webhook_logs), 'Must update webhook_logs');
  assert.equal(updatePayloadCapture.webhook_logs.length, 1);
  const log = updatePayloadCapture.webhook_logs[0];
  assert.equal(log.rawStatus, 'UNKNOWN_CODE_XYZ', 'Must record rawStatus in webhook_logs');
  assert.equal(log.rawStatusName, 'Hành trình chưa định danh', 'Must record rawStatusName in webhook_logs');
});
