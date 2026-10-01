(function() {
  if (window.__AF_INTERCEPTOR_LOADED__) return;
  window.__AF_INTERCEPTOR_LOADED__ = true;

  console.log('[Auto Fill] Interceptor loaded into MAIN world.');

  function isCarrierTrackingCode(code) {
    if (!code) return false;
    const s = String(code).trim();
    if (s.toUpperCase().startsWith('DH')) return false;
    
    // VNPost tracking code patterns
    const vnpostRegex = /^[A-Z]{2}\d{9,13}VN$/i;
    const vnpostRegex2 = /^C\d{9,13}VN$/i;
    const vnpostRegex3 = /^MP\d{8,12}VN$/i;
    
    // J&T tracking code patterns
    const jtRegex = /^8\d{11,14}$/i;
    const jtRegex2 = /^jt\d{10,14}$/i;
    
    return vnpostRegex.test(s) || vnpostRegex2.test(s) || vnpostRegex3.test(s) || jtRegex.test(s) || jtRegex2.test(s);
  }

  function extractTrackingCode(body) {
    if (!body) return null;
    
    const d = body.data || body.result || body;
    const firstItem = (Array.isArray(d) && d.length > 0) ? d[0] : ((Array.isArray(body.data) && body.data.length > 0) ? body.data[0] : null);

    // Check specific fields first (both top-level and nested in data/result)
    let candidates = [
      body.trackingCode,
      body.maVanDon,
      body.shipmentNumber,
      body.itemCode,
      body.barcode,
      body.orderId,
      body.orderCode,
      body.code,
      body.id,
      d?.trackingCode,
      d?.maVanDon,
      d?.shipmentNumber,
      d?.itemCode,
      d?.barcode,
      d?.orderId,
      d?.orderCode,
      d?.code,
      d?.id,
      d?.waybillNo,
      d?.billCode,
      firstItem?.itemCode,
      firstItem?.trackingCode,
      firstItem?.maVanDon,
      firstItem?.shipmentNumber,
      firstItem?.orderCode,
      firstItem?.waybillNo,
      firstItem?.billCode
    ];
    
    for (let c of candidates) {
      if (c && isCarrierTrackingCode(String(c))) {
        return String(c).trim();
      }
    }
    
    // Deep search in nested objects for VNPost / J&T specific structures
    try {
      const str = typeof body === 'string' ? body : JSON.stringify(body);
      const codeMatch = str.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i);
      if (codeMatch && codeMatch[1]) {
        return codeMatch[1].trim();
      }
    } catch(e) {}
    
    return null;
  }

  function handleInterceptedResponse(url, method, status, bodyText, reqBody) {
    try {
      if (status >= 200 && status < 300 && method === 'POST') {
        const u = url.toLowerCase();
        // Check if this is an order creation endpoint
        if (u.includes('order') || u.includes('shipment') || u.includes('delivery') || u.includes('create')) {
          // Bỏ qua các endpoint danh sách, truy vấn, in ấn, lịch sử, chi tiết, tính cước, báo giá, nháp, kiểm tra
          if (
            u.includes('list') || u.includes('query') || u.includes('search') || 
            u.includes('page') || u.includes('history') || u.includes('detail') || 
            u.includes('export') || u.includes('print') || u.includes('check') ||
            u.includes('track') || u.includes('verify') || u.includes('fee') ||
            u.includes('price') || u.includes('cost') || u.includes('cuoc') ||
            u.includes('rate') || u.includes('estimate') || u.includes('calc') ||
            u.includes('validate') || u.includes('draft') || u.includes('quote') ||
            u.includes('tariff')
          ) {
            return;
          }

          let body = null;
          try { body = JSON.parse(bodyText); } catch(e) {}

          // Check if response indicates error
          if (!body || body.success === false || body.code === 400 || body.code === 500 || body.error || body.errorMessage) {
            return;
          }

          const trackingCode = extractTrackingCode(body);
          
          // TUYỆT ĐỐI CHỈ GỬI SỰ KIỆN KHI ĐÃ CÓ MÃ VẬN ĐƠN HỢP LỆ TỪ SERVER HÃNG TRẢ VỀ
          // Tránh các request ngầm (tính cước, kiểm tra địa chỉ, tải dữ liệu nền) tự động lưu đơn khống vào đơn đã gửi!
          if (!trackingCode || !isCarrierTrackingCode(trackingCode)) {
            return;
          }

          // Trích xuất chi tiết người nhận trực tiếp từ payload gửi đi của Web bưu điện (chống form reset làm mất địa chỉ)
          const payloadDetails = extractOrderDetailsFromRequest(reqBody);

          // Chống gửi trùng lặp nhiều sự kiện trong thời gian ngắn (5 giây)
          const eventKey = 'track_' + trackingCode;
          const now = Date.now();
          if (!window.__AF_LAST_EVENTS__) window.__AF_LAST_EVENTS__ = new Map();
          for (const [k, time] of window.__AF_LAST_EVENTS__.entries()) {
            if (now - time > 15000) window.__AF_LAST_EVENTS__.delete(k);
          }
          if (window.__AF_LAST_EVENTS__.has(eventKey) && (now - window.__AF_LAST_EVENTS__.get(eventKey) < 5000)) {
            return;
          }
          window.__AF_LAST_EVENTS__.set(eventKey, now);

          window.postMessage({
            type: 'AF_ORDER_CREATED',
            trackingCode: trackingCode,
            url: url,
            payloadDetails: payloadDetails
          }, '*');
        }
      }
    } catch (err) {
      console.warn('[Auto Fill] Interceptor error:', err);
    }
  }

  function extractOrderDetailsFromRequest(reqBody) {
    if (!reqBody) return null;
    let obj = null;
    if (typeof reqBody === 'string') {
      try { obj = JSON.parse(reqBody); } catch(e) {}
    } else if (typeof reqBody === 'object') {
      obj = reqBody;
    }
    if (!obj) return null;

    const item = Array.isArray(obj) ? obj[0] : (obj.order || obj.data || obj.model || obj);
    if (!item || typeof item !== 'object') return null;

    const receiverName = item.ReceiverName || item.receiverName || item.CustomerName || item.customerName || item.name || '';
    const receiverPhone = item.ReceiverPhone || item.receiverPhone || item.CustomerPhone || item.customerPhone || item.phone || '';
    
    let receiverAddress = item.ReceiverAddress || item.receiverAddress || item.Address || item.address || item.FullAddress || item.fullAddress || item.receiverAddressDetail || '';
    const ward = item.ReceiverWardName || item.receiverWardName || item.WardName || item.wardName || '';
    const district = item.ReceiverDistrictName || item.receiverDistrictName || item.DistrictName || item.districtName || '';
    const province = item.ReceiverProvinceName || item.receiverProvinceName || item.ProvinceName || item.provinceName || '';

    const parts = [receiverAddress, ward, district, province].filter(Boolean);
    if (parts.length > 1 && !receiverAddress.includes(province)) {
      receiverAddress = parts.join(', ');
    }

    const orderCode = item.CustomerOrderCode || item.customerOrderCode || item.OrderCode || item.orderCode || item.ClientOrderCode || item.clientOrderCode || '';
    const codAmount = item.CodAmount || item.codAmount || item.Cod || item.cod || item.MoneyCollect || item.moneyCollect || 0;

    // Trích xuất thông tin người gửi (Tài khoản VNPost được lên đơn)
    const senderName = item.SenderName || item.senderName || item.FromCustomerName || item.fromCustomerName || item.SenderShopName || item.senderShopName || item.SenderNameDetail || '';
    const senderPhone = item.SenderPhone || item.senderPhone || item.FromCustomerPhone || item.fromCustomerPhone || item.SenderTel || item.senderTel || '';
    let senderAddress = item.SenderAddress || item.senderAddress || item.FromAddress || item.fromAddress || item.SenderAddressDetail || item.senderAddressDetail || '';
    const sWard = item.SenderWardName || item.senderWardName || '';
    const sDistrict = item.SenderDistrictName || item.senderDistrictName || '';
    const sProvince = item.SenderProvinceName || item.senderProvinceName || '';
    const sParts = [senderAddress, sWard, sDistrict, sProvince].filter(Boolean);
    if (sParts.length > 1 && !senderAddress.includes(sProvince)) {
      senderAddress = sParts.join(', ');
    }

    return {
      receiverName: String(receiverName || '').trim(),
      receiverPhone: String(receiverPhone || '').trim(),
      receiverAddress: String(receiverAddress || '').trim(),
      orderCode: String(orderCode || '').trim(),
      codAmount: Number(codAmount) || 0,
      senderName: String(senderName || '').trim(),
      senderPhone: String(senderPhone || '').trim().replace(/[^\d]/g, ''),
      senderAddress: String(senderAddress || '').trim()
    };
  }

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);
    try {
      const clone = response.clone();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      const method = (args[1] && args[1].method ? args[1].method : 'GET').toUpperCase();
      const reqBody = (args[1] && args[1].body) ? args[1].body : null;
      
      clone.text().then(bodyText => {
        handleInterceptedResponse(url, method, response.status, bodyText, reqBody);
      }).catch(() => {});
    } catch (e) {}
    return response;
  };

  // Intercept XMLHttpRequest
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._afMethod = (method || '').toUpperCase();
    this._afUrl = url || '';
    return origXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const reqBody = args[0] || null;
    this.addEventListener('load', function() {
      try {
        const status = this.status;
        const responseText = this.responseText;
        handleInterceptedResponse(this._afUrl, this._afMethod, status, responseText, reqBody);
      } catch(e) {}
    });
    return origXhrSend.apply(this, args);
  };
})();
