(() => {
  const AddressLearning = {
    /**
     * Học máy địa chỉ: Lưu ánh xạ SĐT -> Địa chỉ chuẩn và Địa chỉ thô -> Địa chỉ chuẩn
     */
    async learn(rawAddress, correctAddressObj, phone = "") {
      if (!correctAddressObj) return;
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['addressLearningDB'], (res) => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) return;
            const db = res.addressLearningDB || { byPhone: {}, byRaw: {} };
            
            if (phone) {
              db.byPhone[phone] = correctAddressObj;
            }
            if (rawAddress) {
              const cleanRaw = rawAddress.trim().toLowerCase();
              db.byRaw[cleanRaw] = correctAddressObj;
            }
            
            chrome.storage.local.set({ addressLearningDB: db });
          });
        } else {
          const data = localStorage.getItem('addressLearningDB');
          const db = data ? JSON.parse(data) : { byPhone: {}, byRaw: {} };
          if (phone) db.byPhone[phone] = correctAddressObj;
          if (rawAddress) db.byRaw[rawAddress.trim().toLowerCase()] = correctAddressObj;
          localStorage.setItem('addressLearningDB', JSON.stringify(db));
        }
      } catch (e) {
        console.warn("Lỗi Learning Engine:", e);
      }
    },

    /**
     * Tra cứu địa chỉ trong AKB bằng SĐT hoặc Địa chỉ thô
     */
    async lookup(rawAddress, phone = "") {
      return new Promise((resolve) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['addressLearningDB'], (res) => {
              const lastErr = chrome.runtime.lastError;
              if (lastErr) {
                resolve(null);
                return;
              }
              const db = res.addressLearningDB || { byPhone: {}, byRaw: {} };
              if (phone && db.byPhone[phone]) {
                resolve({ match: db.byPhone[phone], confidence: 100, source: "akb_phone" });
                return;
              }
              if (rawAddress) {
                const cleanRaw = rawAddress.trim().toLowerCase();
                if (db.byRaw[cleanRaw]) {
                  resolve({ match: db.byRaw[cleanRaw], confidence: 100, source: "akb_raw" });
                  return;
                }
              }
              resolve(null);
            });
          } else {
            const data = localStorage.getItem('addressLearningDB');
            if (data) {
              const db = JSON.parse(data);
              if (phone && db.byPhone[phone]) {
                resolve({ match: db.byPhone[phone], confidence: 100, source: "akb_phone" });
                return;
              }
              if (rawAddress) {
                const cleanRaw = rawAddress.trim().toLowerCase();
                if (db.byRaw[cleanRaw]) {
                  resolve({ match: db.byRaw[cleanRaw], confidence: 100, source: "akb_raw" });
                  return;
                }
              }
            }
            resolve(null);
          }
        } catch (e) {
          console.warn("Lỗi tra cứu AKB:", e);
          resolve(null);
        }
      });
    }
  };

  globalThis.AddressLearning = AddressLearning;
})();
