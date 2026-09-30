import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVNPostWebOrder,
  VNPOST_WEB_API_BASE
} from '../../src/application/carriers/vnpost-web-session.service.js';
import { syncVNPostOrdersToDatabase } from '../../src/application/carriers/vnpost-sync.engine.js';

test('VNPost Web Session Base URL is set to official web API', () => {
  assert.equal(VNPOST_WEB_API_BASE, 'https://api-pre-my.vnpost.vn/myvnp-web');
});

test('normalizeVNPostWebOrder maps raw MyVNPost web order fields correctly', () => {
  const rawWebOrder = {
    orderHdrId: 987654,
    orderCode: 'SHOP_TEST_001',
    itemCode: 'EH123456789VN',
    orderStatus: '90',
    orderStatusName: 'Phát thành công',
    receiverName: 'Trần Văn A',
    receiverPhone: '0988776655',
    receiverAddress: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    cod: 350000,
    totalFee: 22000,
    weight: 300,
    createDate: '2026-09-10T10:00:00Z'
  };

  const norm = normalizeVNPostWebOrder(rawWebOrder);

  assert.equal(norm.order_code, 'SHOP_TEST_001');
  assert.equal(norm.item_code, 'EH123456789VN');
  assert.equal(norm.tracking_code, 'EH123456789VN');
  assert.equal(norm.status_code, '90');
  assert.equal(norm.carrier_status, 'delivered');
  assert.equal(norm.status_name, 'Phát thành công');
  assert.equal(norm.customer_name, 'Trần Văn A');
  assert.equal(norm.customer_phone, '0988776655');
  assert.equal(norm.cod_amount, 350000);
  assert.equal(norm.shipping_fee, 22000);
  assert.equal(norm.carrier_name, 'VNPOST');
});

test('normalizeVNPostWebOrder handles alternate field names gracefully', () => {
  const rawAltOrder = {
    id: 112233,
    saleOrderCode: 'ORD_ALT_99',
    trackingCode: 'CV998877665VN',
    status: '70',
    statusName: 'Đang giao hàng',
    customerName: 'Lê Thị B',
    phone: '0912345678',
    address: '456 Lê Lợi, Đà Nẵng',
    totalCod: 150000,
    fee: 18000
  };

  const norm = normalizeVNPostWebOrder(rawAltOrder);

  assert.equal(norm.order_code, 'ORD_ALT_99');
  assert.equal(norm.item_code, 'CV998877665VN');
  assert.equal(norm.status_code, '70');
  assert.equal(norm.carrier_status, 'delivering');
  assert.equal(norm.customer_name, 'Lê Thị B');
  assert.equal(norm.customer_phone, '0912345678');
  assert.equal(norm.cod_amount, 150000);
});

test('syncVNPostOrdersToDatabase handles normalized web orders without breaking Order Identity Invariant', async () => {
  const webOrders = [
    normalizeVNPostWebOrder({
      orderCode: 'REPEAT_CUST_1',
      itemCode: 'VN101',
      orderStatus: '90',
      orderStatusName: 'Phát thành công',
      receiverName: 'Khách Hàng Quen',
      receiverPhone: '0901234567'
    }),
    normalizeVNPostWebOrder({
      orderCode: 'REPEAT_CUST_2',
      itemCode: 'VN102',
      orderStatus: '70',
      orderStatusName: 'Đang giao hàng',
      receiverName: 'Khách Hàng Quen', // Same customer, DIFFERENT order code
      receiverPhone: '0901234567'
    })
  ];

  let updatedRecords = [];
  const mockSupabase = {
    from: (table) => {
      assert.equal(table, 'submitted_orders');
      return {
        select: () => ({
          eq: (field, shopIdVal) => ({
            is: (delField, delVal) => {
              return Promise.resolve({
                data: [
                  {
                    id: 'sub_1',
                    order_code: 'REPEAT_CUST_1',
                    tracking_code: 'VN101',
                    status: 'processing',
                    customer_name: 'Khách Hàng Quen'
                  }
                ],
                error: null
              });
            }
          })
        }),
        update: (payload) => {
          let updatedId = null;
          const chain = {
            eq: (field, val) => {
              if (field === 'id') updatedId = val;
              return chain;
            },
            then: (resolve) => {
              updatedRecords.push({ id: updatedId, payload });
              return resolve({ data: [], error: null });
            }
          };
          return chain;
        }
      };
    }
  };

  const stats = await syncVNPostOrdersToDatabase({
    vnpostOrders: webOrders,
    shopId: 'test_shop_123',
    supabaseClient: mockSupabase
  });

  assert.equal(stats.total, 2);
  assert.equal(stats.matched, 1);
  assert.equal(stats.updated, 1);
  assert.equal(stats.unmatched, 1);
  assert.equal(updatedRecords.length, 1);
  assert.equal(updatedRecords[0].payload.status, 'delivered');
});
