/**
 * VNPost Sync Engine
 * Chịu trách nhiệm:
 * 1. Chuẩn hóa mã trạng thái từ VNPost sang định dạng chuẩn nội bộ.
 * 2. Đối chiếu và đồng bộ danh sách đơn hàng vào cơ sở dữ liệu submitted_orders.
 * 3. Tuân thủ tuyệt đối quy tắc bất biến danh tính đơn hàng (Order Identity Invariant).
 */

/**
 * Bảng ánh xạ mã trạng thái VNPost
 */
export function normalizeVNPostStatus(statusCode, statusName = '') {
  const codeStr = String(statusCode ?? '').trim();
  const nameStr = String(statusName ?? '').toLowerCase().trim();

  // 1. Phát không thành công (CẦN KIỂM TRA TRƯỚC PHÁT THÀNH CÔNG để không bị dính chữ 'thành công')
  if (
    codeStr === 'delivery_failed' ||
    codeStr === 'failed' ||
    nameStr.includes('phát không thành công') ||
    nameStr.includes('phat khong thanh cong') ||
    nameStr.includes('không thành công') ||
    nameStr.includes('khong thanh cong') ||
    nameStr.includes('phát thất bại') ||
    nameStr.includes('giao không thành công') ||
    nameStr.includes('thất bại') ||
    nameStr.includes('không phát được') ||
    nameStr.includes('delivery_failed')
  ) {
    return {
      status: 'delivery_failed',
      statusCode: codeStr || 'delivery_failed',
      statusName: statusName || 'Phát không thành công',
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#ffedd5'
    };
  }

  // 2. Phát hàng thành công
  if (
    codeStr === '90' ||
    codeStr === 'delivered' ||
    nameStr.includes('phát hàng thành công') ||
    nameStr.includes('phat hang thanh cong') ||
    nameStr.includes('phát thành công') ||
    nameStr.includes('giao hàng thành công') ||
    nameStr.includes('giao thành công') ||
    nameStr.includes('đã phát thành công') ||
    nameStr.includes('đã phát') ||
    nameStr.includes('delivered') ||
    (!nameStr.includes('không') && !nameStr.includes('thất bại') && nameStr.includes('thành công'))
  ) {
    return {
      status: 'delivered',
      statusCode: '90',
      statusName: statusName || 'Phát hàng thành công',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0'
    };
  }

  // 3. Đang chuyển hoàn / Đã chuyển hoàn
  if (
    codeStr === '100' ||
    codeStr === 'returned' ||
    nameStr.includes('chuyển hoàn') ||
    nameStr.includes('chuyen hoan') ||
    nameStr.includes('trả lại') ||
    nameStr.includes('hoàn gốc') ||
    nameStr.includes('hoàn hàng') ||
    nameStr.includes('returned')
  ) {
    return {
      status: 'returned',
      statusCode: '100',
      statusName: statusName || 'Chuyển hoàn',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca'
    };
  }

  // 4. Hủy / Đã hủy
  if (
    codeStr === 'cancelled' ||
    codeStr === 'canceled' ||
    codeStr === 'cancel' ||
    nameStr.includes('hủy') ||
    nameStr.includes('huỷ') ||
    nameStr.includes('huy don') ||
    nameStr.includes('cancelled') ||
    nameStr.includes('canceled')
  ) {
    return {
      status: 'cancelled',
      statusCode: codeStr || 'cancelled',
      statusName: statusName || 'Đã hủy',
      color: '#94a3b8',
      bg: '#f1f5f9',
      border: '#cbd5e1'
    };
  }

  // 5. Đối soát
  if (
    codeStr === 'reconciled' ||
    nameStr.includes('đối soát') ||
    nameStr.includes('doi soat') ||
    nameStr.includes('reconciled')
  ) {
    return {
      status: 'reconciled',
      statusCode: codeStr || 'reconciled',
      statusName: statusName || 'Đối soát',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd'
    };
  }

  // 6. Đang phát hàng (tách biệt khỏi Đang vận chuyển)
  if (
    codeStr === 'out_for_delivery' ||
    nameStr.includes('đang phát hàng') ||
    nameStr.includes('dang phat hang') ||
    nameStr.includes('đang phát') ||
    nameStr.includes('dang phat') ||
    nameStr.includes('đi phát') ||
    nameStr.includes('out_for_delivery')
  ) {
    return {
      status: 'out_for_delivery',
      statusCode: codeStr || '80',
      statusName: statusName || 'Đang phát hàng',
      color: '#3b82f6',
      bg: '#eff6ff',
      border: '#bfdbfe'
    };
  }

  // 7. Đang vận chuyển
  if (
    codeStr === '70' ||
    codeStr === '80' ||
    codeStr === 'delivering' ||
    nameStr.includes('đang vận chuyển') ||
    nameStr.includes('dang van chuyen') ||
    nameStr.includes('vận chuyển') ||
    nameStr.includes('van chuyen') ||
    nameStr.includes('trung chuyển') ||
    nameStr.includes('đang chuyển phát') ||
    nameStr.includes('chuyển phát') ||
    nameStr.includes('đang giao hàng') ||
    nameStr.includes('đang giao') ||
    nameStr.includes('delivering')
  ) {
    return {
      status: 'delivering',
      statusCode: codeStr || '70',
      statusName: statusName || 'Đang vận chuyển',
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe'
    };
  }

  // 8. Nhận hàng -> accepted/processing
  if (
    codeStr === '50' ||
    codeStr === 'accepted' ||
    codeStr === 'processing' ||
    nameStr.includes('nhận hàng') ||
    nameStr.includes('nhan hang') ||
    nameStr.includes('đã nhận hàng') ||
    nameStr.includes('đã lấy hàng') ||
    nameStr.includes('lấy hàng thành công') ||
    nameStr.includes('đang gom') ||
    nameStr.includes('chấp nhận') ||
    nameStr.includes('nhập bưu cục') ||
    nameStr.includes('chia chọn') ||
    nameStr.includes('accepted') ||
    nameStr.includes('processing')
  ) {
    return {
      status: codeStr === 'accepted' || nameStr.includes('accepted') ? 'accepted' : 'processing',
      statusCode: codeStr || '50',
      statusName: statusName || 'Nhận hàng',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a'
    };
  }

  // 9. Tạo đơn -> created/submitted (TÁCH BIỆT KHỎI CHỜ LẤY HÀNG)
  if (
    codeStr === '0' ||
    codeStr === 'created' ||
    codeStr === 'submitted' ||
    codeStr === 'draft' ||
    nameStr.includes('tạo đơn') ||
    nameStr.includes('tao don') ||
    nameStr.includes('đã tạo đơn') ||
    nameStr.includes('mới tạo') ||
    nameStr.includes('moi tao') ||
    nameStr.includes('chưa duyệt') ||
    nameStr.includes('chua duyet') ||
    nameStr.includes('created') ||
    nameStr.includes('submitted')
  ) {
    return {
      status: codeStr === 'submitted' || nameStr.includes('submitted') ? 'submitted' : 'created',
      statusCode: codeStr || '0',
      statusName: statusName || 'Tạo đơn',
      color: '#8b5cf6',
      bg: '#f5f3ff',
      border: '#ddd6fe'
    };
  }

  // 10. Chờ lấy hàng -> pending_pickup
  if (
    codeStr === '1' ||
    codeStr === 'pending_pickup' ||
    codeStr === 'pending' ||
    nameStr.includes('chờ lấy hàng') ||
    nameStr.includes('cho lay hang') ||
    nameStr.includes('chờ lấy') ||
    nameStr.includes('cho lay') ||
    nameStr.includes('chờ thu gom') ||
    nameStr.includes('chờ gom') ||
    nameStr.includes('pending_pickup')
  ) {
    return {
      status: 'pending_pickup',
      statusCode: codeStr || '1',
      statusName: statusName || 'Chờ lấy hàng',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0'
    };
  }

  // 11. KHÔNG fallback unknown/missing status thành pending/Chờ lấy hàng
  return {
    status: null,
    statusCode: codeStr,
    statusName: statusName || '',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    isUnknown: true
  };
}

/**
 * Định dạng ngày giờ hiển thị
 */
export function formatSyncDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (_) {
    return String(dateStr);
  }
}

/**
 * Chuyển đổi Date sang DD-MM-YYYY cho API VNPost
 */
export function formatToVNPostDate(d = new Date()) {
  const dateObj = (d instanceof Date) ? d : new Date(d);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Đồng bộ danh sách đơn từ VNPost vào submitted_orders
 * @param {Object} options
 * @param {Array} options.vnpostOrders - Mảng đơn hàng trả về từ VNPost Connect
 * @param {string} options.shopId - ID Shop đang thao tác
 * @param {Object} options.supabaseClient - Client Supabase kết nối
 * @returns {Promise<{ total: number, matched: number, updated: number, skipped: number, unmatched: number, details: Array }>}
 */
export async function syncVNPostOrdersToDatabase({
  vnpostOrders = [],
  shopId,
  supabaseClient,
  autoInsertUnmatched = false
}) {
  const stats = {
    total: vnpostOrders.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    unmatched: 0,
    details: []
  };

  if (!Array.isArray(vnpostOrders) || vnpostOrders.length === 0) {
    return stats;
  }

  if (!shopId || !supabaseClient) {
    throw new Error('Thiếu shopId hoặc Supabase client khi đồng bộ.');
  }

  // 1. Tải danh sách đơn hiện có trong shop để đối chiếu
  const { data: existingOrders, error: fetchErr } = await supabaseClient
    .from('submitted_orders')
    .select('id, order_code, tracking_code, status, customer_name, phone, cod_amount, shipping_fee, actual_weight, webhook_logs, address, platform')
    .eq('shop_id', shopId)
    .is('deleted_at', null);

  if (fetchErr) {
    console.warn('Lỗi tải danh sách submitted_orders hiện có:', fetchErr);
  }

  const existingByTracking = new Map();
  const existingByOrderCode = new Map();

  if (Array.isArray(existingOrders)) {
    existingOrders.forEach(o => {
      if (o.tracking_code && String(o.tracking_code).trim()) {
        existingByTracking.set(String(o.tracking_code).trim().toUpperCase(), o);
      }
      if (o.order_code && String(o.order_code).trim()) {
        existingByOrderCode.set(String(o.order_code).trim().toUpperCase(), o);
      }
    });
  }

  // 2. Lặp qua từng đơn VNPost và cập nhật
  for (const vnp of vnpostOrders) {
    const itemCode = String(vnp.itemCode || vnp.ItemCode || vnp.item_code || vnp.tracking_code || vnp.trackingCode || vnp.originalItemCode || '').trim();
    const saleOrderCode = String(vnp.saleOrderCode || vnp.OrderCode || vnp.orderCode || vnp.order_code || vnp.sale_order_code || '').trim();
    const rawStatus = vnp.status ?? vnp.StatusCode ?? vnp.statusCode ?? vnp.status_code ?? null;
    const statusName = vnp.statusName || vnp.StatusName || vnp.status_name || '';
    const norm = normalizeVNPostStatus(rawStatus, statusName);

    const fee = Number(
      vnp.shipping_fee ??
      vnp.totalFee ??
      vnp.fee ??
      vnp.mainFee ??
      vnp.totalFeeSender ??
      vnp.totalFreight ??
      vnp.billing?.totalFee ??
      vnp.orderBilling?.totalFee ??
      0
    );

    const weight = Number(
      vnp.weight ??
      vnp.actual_weight ??
      vnp.grossWeight ??
      vnp.priceWeight ??
      vnp.dimWeight ??
      vnp.billing?.priceWeight ??
      0
    );

    const cod = Number(
      vnp.cod_amount ??
      vnp.cod ??
      vnp.totalCod ??
      vnp.collectionAmount ??
      vnp.codAmount ??
      0
    );

    // Đối chiếu theo tracking_code hoặc order_code
    let matchedOrder = null;
    if (itemCode && existingByTracking.has(itemCode.toUpperCase())) {
      matchedOrder = existingByTracking.get(itemCode.toUpperCase());
    } else if (saleOrderCode && existingByOrderCode.has(saleOrderCode.toUpperCase())) {
      matchedOrder = existingByOrderCode.get(saleOrderCode.toUpperCase());
    }

    if (matchedOrder) {
      stats.matched++;

      let existingLogs = [];
      if (Array.isArray(matchedOrder.webhook_logs)) {
        existingLogs = [...matchedOrder.webhook_logs];
      } else if (typeof matchedOrder.webhook_logs === 'string') {
        try { existingLogs = JSON.parse(matchedOrder.webhook_logs || '[]'); } catch (_) {}
      }

      const hasFeeUpdate = fee > 0 && (!matchedOrder.shipping_fee || Number(matchedOrder.shipping_fee) !== fee);
      const hasWeightUpdate = weight > 0 && (!matchedOrder.actual_weight || Number(matchedOrder.actual_weight) !== weight);
      const hasTrackingUpdate = Boolean(itemCode && !matchedOrder.tracking_code);
      const hasStatusChange = Boolean(norm.status && matchedOrder.status !== norm.status);

      // Kiểm tra nếu tất cả thông tin đã giống hệt và không thiếu cước/khối lượng/hành trình
      const isUpToDate = !hasStatusChange && !hasTrackingUpdate && !hasFeeUpdate && !hasWeightUpdate;
      if (isUpToDate) {
        stats.skipped++;
        stats.details.push({
          trackingCode: itemCode,
          orderCode: saleOrderCode || matchedOrder.order_code,
          customerName: matchedOrder.customer_name,
          status: matchedOrder.status,
          statusName: norm.statusName || matchedOrder.status,
          rawStatus: rawStatus ?? null,
          rawStatusName: statusName || null,
          action: 'skipped'
        });
        continue;
      }

      // Xây dựng payload cập nhật
      const updatePayload = {
        updated_at: new Date().toISOString()
      };

      // Chỉ cập nhật status nếu đọc được status hợp lệ từ VNPost, ngược lại GIỮ NGUYÊN status cũ trong DB
      if (norm.status) {
        updatePayload.status = norm.status;
      }

      if (itemCode && !matchedOrder.tracking_code) {
        updatePayload.tracking_code = itemCode;
      }
      if (fee > 0) {
        updatePayload.shipping_fee = fee;
      }
      if (weight > 0) {
        updatePayload.actual_weight = weight;
      }
      if (cod > 0 && (!matchedOrder.cod_amount || Number(matchedOrder.cod_amount) === 0)) {
        updatePayload.cod_amount = cod;
      }

      // Lưu raw VNPost status vào webhook_logs để debug
      const hasLogForStatus = existingLogs.some(l => 
        (norm.statusCode && String(l.statusCode) === String(norm.statusCode)) ||
        (norm.statusName && l.statusName === norm.statusName) ||
        (l.rawStatus !== undefined && l.rawStatus !== null && String(l.rawStatus) === String(rawStatus))
      );

      if (!hasLogForStatus || existingLogs.length === 0) {
        existingLogs.push({
          statusCode: norm.statusCode || String(rawStatus ?? ''),
          statusName: norm.statusName || statusName || (norm.status || 'Cập nhật trạng thái VNPost'),
          rawStatus: rawStatus ?? null,
          rawStatusName: statusName || null,
          statusDate: vnp.updated_at || vnp.updateDate || vnp.created_at || vnp.createDate || new Date().toISOString(),
          weight: weight > 0 ? weight : (matchedOrder.actual_weight || 0),
          totalFee: fee > 0 ? fee : (matchedOrder.shipping_fee || 0),
          source: 'vnpost_sync',
          receivedAt: new Date().toISOString()
        });
        updatePayload.webhook_logs = existingLogs;
      }

      const { error: updateErr } = await supabaseClient
        .from('submitted_orders')
        .update(updatePayload)
        .eq('id', matchedOrder.id)
        .eq('shop_id', shopId);

      if (!updateErr) {
        stats.updated++;
        // Cập nhật lại đối tượng trong bộ nhớ đệm
        Object.assign(matchedOrder, updatePayload);
        stats.details.push({
          trackingCode: itemCode,
          orderCode: saleOrderCode || matchedOrder.order_code,
          customerName: matchedOrder.customer_name,
          oldStatus: matchedOrder.status,
          newStatus: norm.status || matchedOrder.status,
          statusName: norm.statusName || matchedOrder.status,
          rawStatus: rawStatus ?? null,
          rawStatusName: statusName || null,
          shippingFee: fee,
          actualWeight: weight,
          action: 'updated'
        });
      } else {
        console.warn(`Lỗi cập nhật đơn ${matchedOrder.id}:`, updateErr);
      }
    } else {
      // Đơn hàng chưa có trong hệ thống shop
      if (autoInsertUnmatched && (itemCode || saleOrderCode) && typeof supabaseClient.from('submitted_orders').insert === 'function') {
        const newOrderPayload = {
          shop_id: shopId,
          order_code: saleOrderCode || itemCode,
          tracking_code: itemCode || null,
          customer_name: vnp.customer_name || vnp.receiverName || 'Khách hàng VNPost',
          name: vnp.customer_name || vnp.receiverName || 'Khách hàng VNPost',
          phone: vnp.customer_phone || vnp.receiverPhone || vnp.phone || '',
          address: vnp.full_address || vnp.receiverAddress || vnp.address || '',
          cod_amount: cod,
          shipping_fee: fee,
          actual_weight: weight,
          status: norm.status || 'created',
          source: 'VNPOST_SYNC',
          platform: 'vnpost',
          carrier_name: 'VNPOST',
          submitted_at: vnp.created_at || vnp.createDate || new Date().toISOString(),
          created_at: vnp.created_at || vnp.createDate || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          webhook_logs: [
            {
              statusCode: norm.statusCode || String(rawStatus ?? ''),
              statusName: norm.statusName || statusName || (norm.status || 'Đã tạo đơn VNPost'),
              rawStatus: rawStatus ?? null,
              rawStatusName: statusName || null,
              statusDate: vnp.created_at || vnp.createDate || new Date().toISOString(),
              weight: weight,
              totalFee: fee,
              source: 'vnpost_sync',
              receivedAt: new Date().toISOString()
            }
          ]
        };

        const { error: insertErr } = await supabaseClient
          .from('submitted_orders')
          .insert(newOrderPayload);

        if (!insertErr) {
          stats.updated++;
          stats.details.push({
            trackingCode: itemCode,
            orderCode: saleOrderCode || itemCode,
            customerName: newOrderPayload.customer_name,
            oldStatus: null,
            newStatus: norm.status || 'created',
            statusName: norm.statusName,
            rawStatus: rawStatus ?? null,
            rawStatusName: statusName || null,
            action: 'inserted'
          });
          continue;
        } else {
          console.warn('Lỗi thêm đơn chưa khớp từ VNPost:', insertErr);
        }
      }

      stats.unmatched++;
      stats.details.push({
        trackingCode: itemCode,
        orderCode: saleOrderCode,
        customerName: vnp.receiverName || vnp.customer_name || '',
        status: norm.status,
        statusName: norm.statusName,
        rawStatus: rawStatus ?? null,
        rawStatusName: statusName || null,
        action: 'unmatched'
      });
    }
  }

  return stats;
}
