/**
 * VNPost Web Session Service
 * Đồng bộ & tra cứu đơn hàng trực tiếp qua phiên Web MyVNPost (https://my.vnpost.vn)
 * Ưu điểm:
 * - 100% Không bị tường lửa IP Whitelist chặn (sử dụng cùng endpoint với giao diện MyVNPost Web).
 * - Sử dụng access token từ phiên đăng nhập thực tế của người dùng.
 * - Hỗ trợ cả tài khoản cá nhân, shop nhỏ và doanh nghiệp.
 */

import { normalizeVNPostStatus } from './vnpost-sync.engine.js';

export const VNPOST_WEB_API_BASE = 'https://api-pre-my.vnpost.vn/myvnp-web';

/**
 * 1. Kiểm tra và lấy thông tin phiên MyVNPost từ localStorage của trình duyệt
 * @returns {{ hasSession: boolean, token?: string, userPhone?: string, userName?: string }}
 */
export function getVNPostWebSession() {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return { hasSession: false, error: 'Chỉ hoạt động trong ngữ cảnh trình duyệt tab my.vnpost.vn' };
    }

    const token = localStorage.getItem('accessToken') || '';
    const userPhone = localStorage.getItem('USER_PHONE') || '';
    const userName = localStorage.getItem('USER_NAME') || '';

    if (!token || token.trim().length < 10) {
      return {
        hasSession: false,
        error: 'Chưa tìm thấy Access Token đăng nhập trên tab MyVNPost. Vui lòng đăng nhập vào my.vnpost.vn.'
      };
    }

    return {
      hasSession: true,
      token: token.trim(),
      userPhone: userPhone.trim(),
      userName: userName.trim()
    };
  } catch (err) {
    return {
      hasSession: false,
      error: `Lỗi đọc phiên MyVNPost: ${err.message}`
    };
  }
}

/**
 * 2. Gọi API MyVNPost Web để lấy danh sách đơn hàng
 * @param {Object} params
 * @param {string} params.token - JWT Access Token từ localStorage
 * @param {number} [params.page=0] - Trang (bắt đầu từ 0)
 * @param {number} [params.size=50] - Số lượng đơn mỗi trang
 * @param {string} [params.fromDate] - YYYY-MM-DD
 * @param {string} [params.toDate] - YYYY-MM-DD
 * @param {Array<number>} [params.lstStatus] - Danh sách mã trạng thái cần lọc (hoặc để trống)
 * @returns {Promise<{ success: boolean, orders?: Array, total?: number, error?: string }>}
 */
export async function fetchVNPostWebOrders({
  token,
  page = 0,
  size = 50,
  fromDate = null,
  toDate = null,
  lstStatus = []
}) {
  if (!token) {
    const session = getVNPostWebSession();
    if (!session.hasSession || !session.token) {
      return { success: false, error: session.error || 'Thiếu Access Token MyVNPost Web.' };
    }
    token = session.token;
  }

  const endpoint = `${VNPOST_WEB_API_BASE}/v1/OrderHdr/searchAllByParam?page=${page}&size=${Math.min(size, 100)}`;

  const bodyPayload = {};
  if (fromDate) bodyPayload.createTimeFrom = fromDate;
  if (toDate) bodyPayload.createTimeTo = toDate;
  if (Array.isArray(lstStatus) && lstStatus.length > 0) {
    bodyPayload.lstStatus = lstStatus;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          error: 'Phiên đăng nhập MyVNPost đã hết hạn hoặc không hợp lệ. Vui lòng tải lại trang my.vnpost.vn và đăng nhập lại.',
          isExpired: true
        };
      }
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Máy chủ MyVNPost phản hồi lỗi HTTP ${res.status}: ${errText.slice(0, 150)}` };
    }

    const data = await res.json().catch(() => null);
    let orders = [];
    if (Array.isArray(data)) {
      orders = data;
    } else if (Array.isArray(data?.data)) {
      orders = data.data;
    } else if (Array.isArray(data?.content)) {
      orders = data.content;
    }

    const totalHeader = res.headers?.get('x-total-count');
    const total = totalHeader ? parseInt(totalHeader, 10) : orders.length;

    return {
      success: true,
      orders: orders.map(normalizeVNPostWebOrder),
      rawCount: orders.length,
      total
    };
  } catch (err) {
    return {
      success: false,
      error: `Lỗi kết nối tra cứu đơn Web MyVNPost: ${err.message}`
    };
  }
}

/**
 * 3. Tra cứu thông tin tức thì của 1 đơn hàng qua mã vận đơn hoặc mã đơn shop
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.code - Mã vận đơn (ItemCode) hoặc Mã đơn Shop (OrderCode)
 * @returns {Promise<{ success: boolean, order?: Object, error?: string }>}
 */
export async function lookupVNPostWebOrder({ token, code }) {
  if (!code || !String(code).trim()) {
    return { success: false, error: 'Vui lòng nhập mã vận đơn hoặc mã đơn hàng cần tra cứu.' };
  }

  if (!token) {
    const session = getVNPostWebSession();
    if (!session.hasSession || !session.token) {
      return { success: false, error: session.error || 'Thiếu Access Token MyVNPost Web.' };
    }
    token = session.token;
  }

  const cleanCode = String(code).trim();
  const endpoint = `${VNPOST_WEB_API_BASE}/v1/OrderHdr/searchByOrderCodeOrItemCode`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ searchValue: cleanCode })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { success: false, error: 'Phiên đăng nhập MyVNPost đã hết hạn. Vui lòng đăng nhập lại.', isExpired: true };
      }
      return { success: false, error: `Lỗi tra cứu đơn (HTTP ${res.status})` };
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      return { success: false, error: `Không tìm thấy đơn hàng "${cleanCode}" trên MyVNPost.` };
    }

    const rawOrder = Array.isArray(data) ? data[0] : (data.data || data);
    if (!rawOrder || (!rawOrder.orderHdrId && !rawOrder.itemCode && !rawOrder.orderCode)) {
      return { success: false, error: `Không tìm thấy thông tin đơn hàng "${cleanCode}".` };
    }

    const normalized = normalizeVNPostWebOrder(rawOrder);
    return {
      success: true,
      order: normalized,
      raw: rawOrder
    };
  } catch (err) {
    return {
      success: false,
      error: `Lỗi kết nối tra cứu đơn Web MyVNPost: ${err.message}`
    };
  }
}

/**
 * 4. Chuẩn hóa bản ghi đơn hàng từ giao diện Web MyVNPost sang cấu trúc thống nhất
 * @param {Object} raw
 * @returns {Object}
 */
export function normalizeVNPostWebOrder(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const orderCode = String(raw.orderCode || raw.saleOrderCode || raw.code || raw.batchCode || '').trim();
  const itemCode = String(raw.itemCode || raw.trackingCode || raw.postOfficeCode || raw.ItemCode || raw.originalItemCode || '').trim();
  const statusCode = String(raw.orderStatus ?? raw.status ?? raw.statusCode ?? raw.StatusCode ?? raw.status_code ?? '').trim();
  const statusName = String(raw.orderStatusName || raw.statusName || raw.StatusName || raw.statusDescription || '').trim();

  const normStatus = normalizeVNPostStatus(statusCode, statusName);

  const totalFee = Number(
    raw.totalFee ??
    raw.fee ??
    raw.mainFee ??
    raw.totalFeeSender ??
    raw.totalFreight ??
    raw.shipping_fee ??
    raw.billing?.totalFee ??
    raw.orderBilling?.totalFee ??
    raw.orderBillingDto?.totalFee ??
    0
  );

  const totalWeight = Number(
    raw.weight ??
    raw.grossWeight ??
    raw.priceWeight ??
    raw.dimWeight ??
    raw.actual_weight ??
    raw.billing?.priceWeight ??
    0
  );

  const totalCod = Number(
    raw.cod ??
    raw.totalCod ??
    raw.collectionAmount ??
    raw.codAmount ??
    raw.cod_amount ??
    0
  );

  return {
    order_code: orderCode,
    sale_order_code: orderCode,
    item_code: itemCode,
    tracking_code: itemCode,
    order_hdr_id: raw.orderHdrId || raw.id || null,
    status: statusCode,
    status_code: statusCode,
    status_name: statusName || normStatus.statusName,
    carrier_status: normStatus.status,
    carrier_status_code: normStatus.status,
    customer_name: raw.receiverName || raw.customerName || raw.receiverContactName || '',
    customer_phone: raw.receiverPhone || raw.phone || raw.receiverMobile || '',
    full_address: raw.receiverAddress || raw.address || raw.receiverFullAddress || '',
    cod_amount: totalCod,
    shipping_fee: totalFee,
    weight: totalWeight,
    actual_weight: totalWeight,
    created_at: raw.createDate || raw.createTime || raw.createdDate || raw.orderDate || new Date().toISOString(),
    updated_at: raw.updateDate || raw.updateTime || new Date().toISOString(),
    carrier_name: 'VNPOST'
  };
}
