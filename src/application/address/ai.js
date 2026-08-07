(() => {
  // Kiểm tra extension context còn hợp lệ không
  function isContextValid() {
    try {
      return (
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        !!chrome.runtime.id && // throws nếu context bị invalidated
        typeof chrome.runtime.sendMessage === 'function'
      );
    } catch (_e) {
      return false;
    }
  }

  const AddressAI = {
    async resolve(rawAddress) {
      if (!rawAddress || rawAddress === "không tìm thấy") return null;
      if (!isContextValid()) return null;

      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ action: 'runGroqAddressOnly', addressText: rawAddress }, (response) => {
            try {
              const lastErr = chrome.runtime.lastError;
              if (lastErr) {
                resolve(null);
                return;
              }
            } catch (_ctxErr) {
              // Extension context bị vô hiệu trong khi đợi callback
              resolve(null);
              return;
            }

            if (response && response.ok && response.result) {
              const res = response.result;
              resolve({
                street: res.street || "",
                ward: res.ward || "",
                district: res.district || "",
                province: res.province || "",
                confidence: 90
              });
            } else {
              console.warn("AI Address Resolver error:", response?.error);
              resolve(null);
            }
          });
        } catch (e) {
          // chrome.runtime.sendMessage ném lỗi khi context đã bị vô hiệu
          console.warn("AI Address Resolver exception:", e);
          resolve(null);
        }
      });
    }
  };

  globalThis.AddressAI = AddressAI;
})();
