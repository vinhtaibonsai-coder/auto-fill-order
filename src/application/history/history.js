(() => {
  const SplitHistory = {
    _key: 'splitHistory',

    async _getAll() {
      return new Promise(resolve => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([this._key], r => resolve(r[this._key] || []));
          } else {
            const s = localStorage.getItem(this._key);
            resolve(s ? JSON.parse(s) : []);
          }
        } catch (e) { resolve([]); }
      });
    },

    async _save(list) {
      return new Promise(resolve => {
        try {
          // Giới hạn lịch sử lưu trữ cục bộ tối đa 500 mục gần nhất
          let limitedList = Array.isArray(list) ? list : [];
          if (limitedList.length > 500) {
            limitedList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            limitedList = limitedList.slice(0, 500);
          }
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [this._key]: limitedList }, resolve);
          } else {
            localStorage.setItem(this._key, JSON.stringify(limitedList));
            resolve();
          }
        } catch (e) { resolve(); }
      });
    },

    async getAll() {
      return this._getAll();
    },

    async add(rawText, result, platform) {
      const list = await this._getAll();
      const r = result || {};
      const name = (r.name || '').trim().toLowerCase();
      const phone = (r.phone || '').replace(/\D/g, '');
      const cod = Number(r.codAmount) || 0;
      const rawTrim = (rawText || '').trim();

      const duplicate = list.find(o => {
        if (rawTrim && o.rawText && o.rawText.trim() === rawTrim) return true;
        const or = o.result || {};
        const oName = (or.name || '').trim().toLowerCase();
        const oPhone = (or.phone || '').replace(/\D/g, '');
        const oCod = Number(or.codAmount) || 0;
        return name && phone && name === oName && phone === oPhone && cod === oCod;
      });

      if (duplicate) {
        duplicate.createdAtShort = (() => {
          const d = new Date();
          return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
        })();
        duplicate.createdAt = new Date().toISOString();
        const idx = list.findIndex(e => e.id === duplicate.id);
        if (idx !== -1) { list[idx] = duplicate; }
        await this._save(list);
        return { entry: duplicate, isDuplicate: true };
      }

      let deviceName = typeof FirebaseCloud !== 'undefined' ? FirebaseCloud.deviceName : '';
      if (!deviceName || deviceName === 'Máy không tên' || deviceName.startsWith('dev_')) {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const r = await new Promise(res => chrome.storage.local.get(['fbDeviceName'], res));
            if (r.fbDeviceName && r.fbDeviceName !== 'Máy không tên' && !r.fbDeviceName.startsWith('dev_')) deviceName = r.fbDeviceName;
          }
        } catch(_) {}
      }
      const entry = {
        id: 'split_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8),
        rawText: rawTrim,
        deviceName,
        result: {
          name: (r.name) || '',
          phone: (r.phone) || '',
          address: (r.address) || '',
          orderCode: (r.orderCode) || '',
          codAmount: cod,
          collectFee: !!(r.collectFee),
          platform: platform || (r.platform) || ''
        },
        createdAt: new Date().toISOString(),
        createdAtShort: (() => {
          const d = new Date();
          return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
        })()
      };
      list.unshift(entry);
      if (list.length > 300) list.length = 300;
      await this._save(list);
      
      // Tự động đẩy lịch sử lên cloud
      this._pushHistoryToCloud(entry);
      
      return { entry, isDuplicate: false };
    },

    async delete(id) {
      const list = await this._getAll();
      await this._save(list.filter(e => e.id !== id));
    },

    async clear() {
      await this._save([]);
    },

    async _pushHistoryToCloud(entry) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pushHistory', entries: [entry] });
        } else {
          const c = typeof FirebaseCloud !== 'undefined' ? FirebaseCloud : null;
          if (c && c.isConnected) await c.pushHistory([entry]);
        }
      } catch (e) { console.warn('Lỗi push lịch sử lên cloud:', e); }
    },

    async syncToCloud() {
      const entries = await this._getAll();
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'syncHistoryToCloud', entries }, resolve);
          });
        } else {
          const c = typeof FirebaseCloud !== 'undefined' ? FirebaseCloud : null;
          if (!c || !c.isConnected) return { ok: false, reason: 'Chưa kết nối cloud' };
          await c.pushHistory(entries);
          return { ok: true, count: entries.length };
        }
      } catch (e) {
        return { ok: false, reason: e.message };
      }
    },

    async syncFromCloud() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'syncHistoryFromCloud' }, async (response) => {
              if (!response) {
                resolve({ ok: true, count: 0 });
                return;
              }
              if (!response.ok) {
                resolve({ ok: false, reason: response?.reason || response?.error || 'Lỗi đồng bộ' });
                return;
              }
              const cloudEntries = response.entries || [];
              const localEntries = await this._getAll();
              const localMap = new Map(localEntries.filter(Boolean).map(e => [e.id, e]));
              cloudEntries.filter(Boolean).forEach(e => localMap.set(e.id, e));
              const merged = Array.from(localMap.values());
              merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

              await this._save(merged);
              resolve({ ok: true, count: merged.length - localEntries.length });
            });
          });
        } else {
          const c = typeof FirebaseCloud !== 'undefined' ? FirebaseCloud : null;
          if (!c || !c.isConnected) return { ok: false, reason: 'Chưa kết nối cloud' };
          const cloudEntries = await c.fetchHistory();
          if (!Array.isArray(cloudEntries) || cloudEntries.length === 0) return { ok: true, count: 0 };

          const localEntries = await this._getAll();
          const localMap = new Map(localEntries.filter(Boolean).map(e => [e.id, e]));
          cloudEntries.filter(Boolean).forEach(e => localMap.set(e.id, e));
          const merged = Array.from(localMap.values());
          merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

          await this._save(merged);
          return { ok: true, count: merged.length - localEntries.length };
        }
      } catch (e) {
        return { ok: false, reason: e.message };
      }
    }
  };

  globalThis.SplitHistory = SplitHistory;
})();
