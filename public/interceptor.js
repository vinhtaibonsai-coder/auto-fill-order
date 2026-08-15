(function() {
  if (window.__AF_INTERCEPTOR_LOADED__) return;
  window.__AF_INTERCEPTOR_LOADED__ = true;

  console.log('[Auto Fill] Interceptor loaded into MAIN world.');

  function extractTrackingCode(body) {
    if (!body) return null;
    let code = body.orderId || body.orderCode || body.trackingCode || body.maVanDon || body.shipmentNumber || body.itemCode || body.barcode || body.code || body.id || null;
    if (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) {
      return String(code);
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

  function handleInterceptedResponse(url, method, status, bodyText) {
    try {
      if (status >= 200 && status < 300 && method === 'POST') {
        const u = url.toLowerCase();
        // Check if this is an order creation endpoint
        if (u.includes('order') || u.includes('shipment') || u.includes('delivery') || u.includes('create')) {
          let body = null;
          try { body = JSON.parse(bodyText); } catch(e) {}

          // Check if response indicates error
          if (!body || body.success === false || body.code === 400 || body.code === 500 || body.error || body.errorMessage) {
            return;
          }

          const trackingCode = extractTrackingCode(body);
          
          // Even if trackingCode is null, we notify the content script to scrape the DOM,
          // because sometimes the tracking code is not in the JSON but rendered in the DOM shortly after.
          window.postMessage({
            type: 'AF_ORDER_CREATED',
            trackingCode: trackingCode,
            url: url
          }, '*');
        }
      }
    } catch (err) {
      console.warn('[Auto Fill] Interceptor error:', err);
    }
  }

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await origFetch.apply(this, args);
    try {
      const clone = response.clone();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      const method = (args[1] && args[1].method ? args[1].method : 'GET').toUpperCase();
      
      clone.text().then(bodyText => {
        handleInterceptedResponse(url, method, response.status, bodyText);
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
    this.addEventListener('load', function() {
      try {
        const status = this.status;
        const responseText = this.responseText;
        handleInterceptedResponse(this._afUrl, this._afMethod, status, responseText);
      } catch(e) {}
    });
    return origXhrSend.apply(this, args);
  };
})();
