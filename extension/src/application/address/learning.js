(() => {
  const AddressLearning = {
    /**
     * Học máy địa chỉ: Lưu ánh xạ SĐT -> Địa chỉ chuẩn và Địa chỉ thô -> Địa chỉ chuẩn
     */
    async learn(rawAddress, correctAddressObj, phone = "") {
      if (!correctAddressObj) return;
      // Chỉ học khi độ tin cậy >= 85
      if ((correctAddressObj.confidence || 0) < 85) return;
      
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['addressLearningDB'], (res) => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) return;
            const db = res.addressLearningDB || { byPhone: {}, byRaw: {} };
            
            // Giới hạn kích thước DB (LRU đơn giản, giữ 1000 records)
            const MAX_ENTRIES = 1000;
            
            if (phone) {
              const keys = Object.keys(db.byPhone);
              if (keys.length > MAX_ENTRIES) delete db.byPhone[keys[0]];
              db.byPhone[phone] = correctAddressObj;
            }
            if (rawAddress) {
              const cleanRaw = rawAddress.trim().toLowerCase();
              const keys = Object.keys(db.byRaw);
              if (keys.length > MAX_ENTRIES) delete db.byRaw[keys[0]];
              db.byRaw[cleanRaw] = correctAddressObj;
            }
            
            chrome.storage.local.set({ addressLearningDB: db }).catch(() => {});
          });
          } else {
            const data = localStorage.getItem('addressLearningDB');
            const db = data ? JSON.parse(data) : { byPhone: {}, byRaw: {} };
            const MAX_ENTRIES = 1000;
            
            if (phone) {
              const keys = Object.keys(db.byPhone);
              if (keys.length > MAX_ENTRIES) delete db.byPhone[keys[0]];
              db.byPhone[phone] = correctAddressObj;
            }
            if (rawAddress) {
              const cleanRaw = rawAddress.trim().toLowerCase();
              const keys = Object.keys(db.byRaw);
              if (keys.length > MAX_ENTRIES) delete db.byRaw[keys[0]];
              db.byRaw[cleanRaw] = correctAddressObj;
            }
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
