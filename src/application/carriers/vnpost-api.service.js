/**
 * VNPost Connect API Service
 * Tích hợp hệ thống MyVNPost Connect (https://connect-my.vnpost.vn)
 * Hỗ trợ:
 * - Lấy Access Token xác thực (POST /GetAccessToken)
 * - Tra cứu danh sách đơn hàng theo dải ngày (GET /GetListOrder)
 * - Tra cứu chi tiết & trạng thái 1 đơn hàng (GET /getOrder)
 */

export const VNPOST_ENVIRONMENTS = {
  PRODUCTION: 'https://connect-my.vnpost.vn',
  UAT: 'https://my-uat.vnpost.vn/MYVNP_API'
};

/**
 * Chuẩn hóa URL endpoint VNPost
 */
export function getBaseUrl(env = 'PRODUCTION', customUrl = '') {
  if (env === 'CUSTOM' && customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  if (typeof env === 'string' && env.startsWith('http')) {
    return env.replace(/\/+$/, '');
  }
  return VNPOST_ENVIRONMENTS[env] || VNPOST_ENVIRONMENTS.PRODUCTION;
}

/**
 * 1. Lấy mã Access Token từ VNPost Connect API
 * @param {Object} params
 * @param {string} params.username - Tên đăng nhập My VNPost
 * @param {string} params.password - Mật khẩu My VNPost
 * @param {string} params.customerCode - Mã KH CMS (Ví dụ: T000180585)
 * @param {string} [params.env='PRODUCTION'] - Môi trường (PRODUCTION, UAT hoặc CUSTOM)
 * @param {string} [params.customUrl=''] - URL tùy chỉnh nếu chọn CUSTOM
 * @returns {Promise<{ success: boolean, token?: string, error?: string }>}
 */
export async function vnpostGetAccessToken({ username, password, customerCode, env = 'PRODUCTION', customUrl = '' }) {
  const baseUrl = getBaseUrl(env, customUrl);
  const endpoint = `${baseUrl}/GetAccessToken`;

  if (!username || !password || !customerCode) {
    return {
      success: false,
      error: 'Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Mã khách hàng CMS.'
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: String(username).trim(),
        password: String(password).trim(),
        customerCode: String(customerCode).trim()
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 403) {
        return { success: false, error: 'Lỗi xác thực (HTTP 403): Tên đăng nhập hoặc mật khẩu/mã KH không đúng.' };
      }
      if (res.status === 400) {
        return { success: false, error: 'Tham số không hợp lệ (HTTP 400): Vui lòng kiểm tra lại định dạng thông tin.' };
      }
      return { success: false, error: `Máy chủ VNPost phản hồi lỗi HTTP ${res.status}: ${errText.slice(0, 150)}` };
    }

    const data = await res.json().catch(() => ({}));
    if (data && data.success && data.token) {
      return {
        success: true,
        token: data.token
      };
    }

    return {
      success: false,
      error: data?.errorMessage || 'Không lấy được Token từ VNPost. Vui lòng kiểm tra lại thông tin tài khoản.'
    };
  } catch (err) {
    const isConnReset = err.message.includes('ECONNRESET') || err.message.includes('Failed to fetch') || err.message.includes('fetch failed');
    return {
      success: false,
      error: isConnReset
        ? `Không thể kết nối tới máy chủ VNPost (${endpoint}). Cổng connect-my.vnpost.vn thường bị tường lửa VNPost chặn nếu chưa đăng ký Whitelist IP tĩnh, hoặc SSL trên cổng API hết hạn. Bạn có thể chọn môi trường UAT hoặc nhập địa chỉ API riêng của Shop.`
        : `Lỗi kết nối tới VNPost (${endpoint}): ${err.message}`
    };
  }
}

/**
 * 2. Tra cứu danh sách đơn hàng đã tạo trong khoảng thời gian (tối đa 31 ngày)
 * @param {Object} params
 * @param {string} params.token - Token lấy từ vnpostGetAccessToken
 * @param {string} params.lastUpdateFrom - Ngày bắt đầu DD-MM-YYYY
 * @param {string} params.lastUpdateTo - Ngày kết thúc DD-MM-YYYY
 * @param {number} [params.page=0] - Trang (bắt đầu từ 0)
 * @param {number} [params.size=200] - Số lượng đơn mỗi trang (tối đa 500)
 * @param {string} [params.type='GUI'] - 'GUI' (đơn gửi) hoặc 'NHAN' (đơn nhận)
 * @param {boolean} [params.isInternational=false] - Quốc tế hay trong nước
 * @param {string} [params.env='PRODUCTION']
 * @returns {Promise<{ success: boolean, orders?: Array, total?: number, error?: string }>}
 */
export async function vnpostGetListOrder({
  token,
  lastUpdateFrom,
  lastUpdateTo,
  page = 0,
  size = 200,
  type = 'GUI',
  isInternational = false,
  env = 'PRODUCTION',
  customUrl = ''
}) {
  if (!token) {
    return { success: false, error: 'Thiếu Token xác thực VNPost.' };
  }
  if (!lastUpdateFrom || !lastUpdateTo) {
    return { success: false, error: 'Vui lòng cung cấp đầy đủ ngày bắt đầu và ngày kết thúc (DD-MM-YYYY).' };
  }

  const baseUrl = getBaseUrl(env, customUrl);
  const queryParams = new URLSearchParams({
    lastUpdateFrom,
    lastUpdateTo,
    type,
    page: String(page),
    size: String(Math.min(size, 500)),
    isInternational: String(isInternational)
  });

  const endpoint = `${baseUrl}/GetListOrder?${queryParams.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'token': token,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 403) {
        return { success: false, error: 'Token đã hết hạn hoặc không hợp lệ (HTTP 403). Vui lòng đăng nhập lại.', isExpired: true };
      }
      return { success: false, error: `Lỗi tải danh sách đơn (HTTP ${res.status}): ${errText.slice(0, 150)}` };
    }

    const data = await res.json().catch(() => ({}));
    let orders = [];

    if (Array.isArray(data)) {
      orders = data;
    } else if (Array.isArray(data?.results)) {
      orders = data.results;
    } else if (data?.results?.[0]?.results && Array.isArray(data.results[0].results)) {
      orders = data.results[0].results;
    }

    return {
      success: true,
      orders,
      total: orders.length
    };
  } catch (err) {
    return {
      success: false,
      error: `Lỗi kết nối tra cứu danh sách đơn VNPost: ${err.message}`
    };
  }
}

/**
 * 3. Tra cứu thông tin chi tiết & trạng thái tức thì của 1 đơn hàng
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.code - Mã vận đơn hoặc mã đơn hàng của shop
 * @param {number} [params.type=1] - 1: Số hiệu bưu gửi (ItemCode), 2: Mã đơn shop (SaleOrderCode), 3: ID gốc
 * @param {string} [params.env='PRODUCTION']
 * @returns {Promise<{ success: boolean, order?: Object, error?: string }>}
 */
export async function vnpostGetOrder({
  token,
  code,
  type = 1,
  env = 'PRODUCTION',
  customUrl = ''
}) {
  if (!token) {
    return { success: false, error: 'Thiếu Token xác thực VNPost.' };
  }
  if (!code) {
    return { success: false, error: 'Thiếu mã cần tra cứu.' };
  }

  const baseUrl = getBaseUrl(env, customUrl);
  const queryParams = new URLSearchParams({
    type: String(type),
    code: String(code).trim()
  });

  const endpoint = `${baseUrl}/getOrder?${queryParams.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'token': token,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 403) {
        return { success: false, error: 'Token đã hết hạn hoặc không hợp lệ (HTTP 403).', isExpired: true };
      }
      return { success: false, error: `Lỗi tra cứu đơn (HTTP ${res.status})` };
    }

    const data = await res.json().catch(() => null);
    let orderDetail = null;

    if (Array.isArray(data)) {
      if (data[0]?.results && Array.isArray(data[0].results)) {
        orderDetail = data[0].results[0] || null;
      } else {
        orderDetail = data[0] || null;
      }
    } else if (data?.results && Array.isArray(data.results)) {
      orderDetail = data.results[0] || null;
    } else if (data && typeof data === 'object') {
      orderDetail = data;
    }

    if (!orderDetail) {
      return { success: false, error: `Không tìm thấy thông tin đơn hàng với mã '${code}' trên VNPost.` };
    }

    return {
      success: true,
      order: orderDetail
    };
  } catch (err) {
    return {
      success: false,
      error: `Lỗi kết nối tra cứu đơn VNPost: ${err.message}`
    };
  }
}
