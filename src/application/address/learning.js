(() => {
  const CACHE_PREFIX = 'addressLearningDB:';
  const ALIAS_CACHE_PREFIX = 'shop_address_aliases_cache:';
  const OUTBOX_PREFIX = 'addressLearningOutbox:';
  const LEGACY_CACHE_KEYS = ['addressLearningDB', 'shop_address_aliases_cache', 'shop_user_corrections'];
  const MAX_ENTRIES = 2000;
  const MAX_CORRECTIONS = 500;
  const RETRY_MAX_MS = 60000;

  const _syncTimers = new Map();
  const _retryAttempts = new Map();
  const _syncingShops = new Set();

  const SOURCE_RANK = {
    admin_verified: 500,
    human_confirmed: 400,
    human_edit: 300,
    akb_builtin: 250,
    local_pipeline: 150,
    historical: 100,
    legacy: 50
  };

  const BUILTIN_SEEDED_LEARNING = {
    'kho thuốc thú y, cầu thuận giang xã chợ mới tỉnh an giang': {
      street: 'Kho Thuốc Thú Y Cầu Thuận Giang', ward: 'Xã Chợ Mới', district: '',
      province: 'Tỉnh An Giang', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    'kho thuốc thú y cầu thuận giang xã chợ mới tỉnh an giang': {
      street: 'Kho Thuốc Thú Y Cầu Thuận Giang', ward: 'Xã Chợ Mới', district: '',
      province: 'Tỉnh An Giang', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    '172 lương thế vinh thanh xuân hà nội': {
      street: '172 Lương Thế Vinh', ward: 'Phường Thanh Xuân', district: '',
      province: 'Thành phố Hà Nội', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    '149 đường huynh cuong phường an cu ninh kieu tp. cần thơ': {
      street: '149 Đường Huỳnh Cương', ward: 'Phường An Cư', district: 'Quận Ninh Kiều',
      province: 'Thành phố Cần Thơ', confidence: 100, source: 'akb_builtin'
    },
    '149 duong huynh cuong phuong an cu ninh kieu tp can tho': {
      street: '149 Đường Huỳnh Cương', ward: 'Phường An Cư', district: 'Quận Ninh Kiều',
      province: 'Thành phố Cần Thơ', confidence: 100, source: 'akb_builtin'
    },
    '342/59 võ văn kiệt, phường cô giang, quận 1, thành phố hồ chí minh': {
      street: '342/59 Võ Văn Kiệt', ward: 'Phường Cầu Ông Lãnh', district: '',
      province: 'Thành phố Hồ Chí Minh', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    '342/59 võ văn kiệt, phường cô giang, quận 1, tp hồ chí minh': {
      street: '342/59 Võ Văn Kiệt', ward: 'Phường Cầu Ông Lãnh', district: '',
      province: 'Thành phố Hồ Chí Minh', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    '342/59 võ văn kiệt, phường cô giang, quận 1, tp. hồ chí minh': {
      street: '342/59 Võ Văn Kiệt', ward: 'Phường Cầu Ông Lãnh', district: '',
      province: 'Thành phố Hồ Chí Minh', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    '342/59 võ văn kiệt, cô giang, quận 1, hồ chí minh': {
      street: '342/59 Võ Văn Kiệt', ward: 'Phường Cầu Ông Lãnh', district: '',
      province: 'Thành phố Hồ Chí Minh', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    },
    '342/59 võ văn kiệt, phường cô giang, quận 1': {
      street: '342/59 Võ Văn Kiệt', ward: 'Phường Cầu Ông Lãnh', district: '',
      province: 'Thành phố Hồ Chí Minh', confidence: 100, source: 'akb_builtin', isTwoLevel: true
    }
  };

  const emptyDb = shopId => ({ version: 2, shopId, byPhone: {}, byRaw: {}, corrections: {} });
  const clampConfidence = value => Math.max(0, Math.min(100, Number(value) || 0));
  const sourceRank = value => SOURCE_RANK[value] || SOURCE_RANK.legacy;
  const normalizeLookupKey = value => String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ');
  const normalizePhone = value => String(value || '')
    .replace(/\D/g, '')
    .replace(/^84(?=\d{9}$)/, '0');
  const normalizeField = value => String(value || '').trim();
  const buildFullAddress = value => {
    if (typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.cleanObject === 'function') {
      const cleaned = globalThis.AddressSanitizer.cleanObject(value);
      if (cleaned?.fullAddress) return cleaned.fullAddress;
    }
    const parts = [value?.street, value?.ward, value?.district, value?.province].filter(Boolean);
    const joined = parts.join(', ');
    if (typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.deduplicate === 'function') {
      return globalThis.AddressSanitizer.deduplicate(joined);
    }
    return joined;
  };

  function fingerprint(value) {
    const input = normalizeLookupKey(value);
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${input.length}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function normalizeAddressValue(input) {
    if (!input) return null;
    const value = typeof input === 'string' ? { fullAddress: input } : { ...input };
    let fullAddress = normalizeField(value.fullAddress || value.address || buildFullAddress(value));
    if (typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.deduplicate === 'function') {
      fullAddress = globalThis.AddressSanitizer.deduplicate(fullAddress);
    }

    if (!value.street && !value.ward && !value.district && !value.province && fullAddress) {
      try {
        if (typeof globalThis.AddressParser !== 'undefined' && typeof globalThis.AddressParser.parse === 'function') {
          const normalized = typeof globalThis.AddressNormalizer !== 'undefined'
            ? globalThis.AddressNormalizer.normalize(fullAddress)
            : fullAddress;
          const parsed = globalThis.AddressParser.parse(normalized);
          if (parsed) {
            value.street = parsed.street || '';
            value.ward = parsed.ward || '';
            value.district = parsed.district || '';
            value.province = parsed.province || '';
          }
        }
      } catch (_) {}
    }

    // Historical rows can contain only fullAddress. Preserve a usable value even
    // when the administrative parser is unavailable during cache hydration.
    if (!value.street && fullAddress) value.street = fullAddress;
    value.fullAddress = fullAddress || buildFullAddress(value);
    if (typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.cleanObject === 'function') {
      return globalThis.AddressSanitizer.cleanObject(value);
    }
    return value;
  }

  function toCacheEntry(input, metadata = {}) {
    if (input?.normalizedValue) {
      return {
        normalizedValue: normalizeAddressValue(input.normalizedValue),
        confidence: clampConfidence(input.confidence),
        sourceType: input.sourceType || 'legacy',
        verified: Boolean(input.verified),
        updatedAt: input.updatedAt || Date.now()
      };
    }
    const normalizedValue = normalizeAddressValue(input);
    const sourceType = metadata.sourceType || input?.sourceType || input?.source_type || input?.source || 'legacy';
    return {
      normalizedValue,
      confidence: clampConfidence(metadata.confidence ?? input?.confidence ?? 90),
      sourceType,
      verified: Boolean(metadata.verified ?? input?.verified ?? sourceType === 'admin_verified'),
      updatedAt: metadata.updatedAt || Date.now()
    };
  }

  function shouldReplace(existingInput, incoming) {
    if (!existingInput) return true;
    const existing = toCacheEntry(existingInput);
    const oldRank = sourceRank(existing.sourceType);
    const newRank = sourceRank(incoming.sourceType);
    if (newRank !== oldRank) return newRank > oldRank;
    if (incoming.verified !== existing.verified) return incoming.verified;
    return incoming.confidence >= existing.confidence;
  }

  function trimBucket(bucket, maxSize) {
    const keys = Object.keys(bucket);
    while (keys.length > maxSize) delete bucket[keys.shift()];
  }

  function parseStored(raw, fallback) {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  async function storageGet(key) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
      return new Promise(resolve => {
        chrome.storage.local.get([key], result => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(result?.[key] ?? null);
        });
      });
    }
    if (typeof localStorage !== 'undefined') return parseStored(localStorage.getItem(key), null);
    return null;
  }

  async function storageSet(key, value) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
      await new Promise(resolve => {
        try {
          const result = chrome.storage.local.set({ [key]: value }, resolve);
          if (result?.catch) result.catch(() => resolve());
        } catch (_) { resolve(); }
      });
      return;
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  }

  async function storageRemove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
      await new Promise(resolve => {
        try {
          const result = chrome.storage.local.remove(list, resolve);
          if (result?.catch) result.catch(() => resolve());
        } catch (_) { resolve(); }
      });
      return;
    }
    if (typeof localStorage !== 'undefined') list.forEach(key => localStorage.removeItem(key));
  }

  async function readDb(shopId) {
    let raw = shopId ? await storageGet(CACHE_PREFIX + shopId) : null;
    if (!raw) {
      raw = await storageGet('addressLearningDB') || (shopId ? null : await storageGet(CACHE_PREFIX));
    }
    const db = parseStored(raw, emptyDb(shopId)) || emptyDb(shopId);
    if (shopId && db.shopId && db.shopId !== shopId) return emptyDb(shopId);
    db.version = 2;
    db.shopId = shopId || '';
    db.byPhone = db.byPhone || {};
    db.byRaw = db.byRaw || {};
    db.corrections = db.corrections || {};
    return db;
  }

  const writeDb = (shopId, db) => storageSet(CACHE_PREFIX + shopId, db);
  const readOutbox = async shopId => parseStored(await storageGet(OUTBOX_PREFIX + shopId), []) || [];
  const writeOutbox = (shopId, rows) => storageSet(OUTBOX_PREFIX + shopId, rows);
  const outboxIdentity = item => `${item.action || 'upsert'}:${item.category}:${item.raw_key}`;

  const AddressLearning = {
    async getAuthAndConfig() {
      let session = null;
      let config = null;
      try {
        if (globalThis.AuthSession?.getSession) session = await globalThis.AuthSession.getSession().catch(() => null);
        if (globalThis.SupabaseCloud?.loadConfig) config = await globalThis.SupabaseCloud.loadConfig().catch(() => null);
        if (
          (!session?.access_token || !session?.active_shop_id || !config?.url) &&
          typeof chrome !== 'undefined' && chrome.storage?.local
        ) {
          const values = await new Promise(resolve => chrome.storage.local.get(
            ['vnpost_session', 'supabase_config', 'activeShopId'], resolve
          )).catch(() => ({}));
          session = session || values?.vnpost_session || null;
          if (session && !session.active_shop_id && values?.activeShopId) session.active_shop_id = values.activeShopId;
          config = config || values?.supabase_config || null;
        }
      } catch (_) {}
      return { session, config };
    },

    async _resolveShopId(explicitShopId = null) {
      if (explicitShopId) return String(explicitShopId);
      const { session } = await this.getAuthAndConfig();
      return session?.active_shop_id ? String(session.active_shop_id) : '';
    },

    async activateShop(explicitShopId = null) {
      const shopId = await this._resolveShopId(explicitShopId);
      if (!shopId) {
        globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ = [];
        return { shopId: '', aliases: [] };
      }
      const aliases = parseStored(await storageGet(ALIAS_CACHE_PREFIX + shopId), []) || [];
      globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ = Array.isArray(aliases) ? aliases : [];
      return { shopId, aliases: globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ };
    },

    async syncFromCloud(targetShopId = null) {
      const { session, config } = await this.getAuthAndConfig();
      const shopId = String(targetShopId || session?.active_shop_id || '');
      if (!shopId || !session?.access_token || !config?.url || !config?.anonKey) {
        return { success: false, reason: 'unauthorized' };
      }
      if (_syncingShops.has(shopId)) return { success: false, reason: 'in_progress' };
      _syncingShops.add(shopId);

      try {
        await this.activateShop(shopId);
        const base = `${String(config.url).replace(/\/$/, '')}/rest/v1`;
        const headers = {
          apikey: config.anonKey,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        };
        const [snapRes, aliasRes, globalAliasRes] = await Promise.all([
          fetch(`${base}/rpc/get_shop_learning_snapshot`, {
            method: 'POST', headers, body: JSON.stringify({ p_shop_id: shopId, p_limit: 5000 })
          }).catch(() => null),
          fetch(`${base}/shop_address_aliases?shop_id=eq.${encodeURIComponent(shopId)}&order=created_at.desc&select=id,original,mapping`, { headers }).catch(() => null),
          fetch(`${base}/rpc/get_active_global_aliases`, { method: 'POST', headers, body: '{}' }).catch(() => null)
        ]);

        if (!snapRes?.ok) return { success: false, reason: 'snapshot_failed' };

        const items = await snapRes.json().catch(() => []);
        const freshDb = emptyDb(shopId);
        for (const item of Array.isArray(items) ? items : []) {
          if (!item?.raw_key || !item?.normalized_value) continue;
          const metadata = {
            confidence: item.confidence,
            sourceType: item.source_type || item.normalized_value?.sourceType || item.normalized_value?.source || 'legacy',
            verified: Boolean(item.verified_at || item.source_type === 'admin_verified'),
            updatedAt: item.updated_at || item.last_used_at || Date.now()
          };
          if (item.category === 'address_raw') {
            freshDb.byRaw[normalizeLookupKey(item.raw_key)] = toCacheEntry(item.normalized_value, metadata);
          } else if (item.category === 'customer_phone') {
            freshDb.byPhone[normalizePhone(item.raw_key)] = toCacheEntry(item.normalized_value, metadata);
          } else if (item.category === 'field_correction') {
            freshDb.corrections[String(item.raw_key)] = {
              normalizedValue: { ...item.normalized_value },
              confidence: clampConfidence(item.confidence),
              sourceType: item.source_type || 'human_edit',
              verified: Boolean(item.verified_at),
              updatedAt: item.updated_at || item.last_used_at || Date.now()
            };
          }
        }

        // Never discard locally confirmed changes that are still waiting for Cloud.
        const pending = await readOutbox(shopId);
        for (const item of pending) {
          if ((item.action || 'upsert') !== 'upsert' || !item.normalized_value) continue;
          if (item.category === 'address_raw') {
            const key = normalizeLookupKey(item.raw_key);
            const incoming = toCacheEntry(item.normalized_value, item);
            if (shouldReplace(freshDb.byRaw[key], incoming)) freshDb.byRaw[key] = incoming;
          } else if (item.category === 'customer_phone') {
            const key = normalizePhone(item.raw_key);
            const incoming = toCacheEntry(item.normalized_value, item);
            if (shouldReplace(freshDb.byPhone[key], incoming)) freshDb.byPhone[key] = incoming;
          } else if (item.category === 'field_correction') {
            freshDb.corrections[item.raw_key] = {
              normalizedValue: { ...item.normalized_value }, confidence: clampConfidence(item.confidence),
              sourceType: item.source_type || 'human_edit', verified: Boolean(item.verified), updatedAt: Date.now()
            };
          }
        }
        await writeDb(shopId, freshDb);

        if (aliasRes?.ok) {
          const aliases = await aliasRes.json().catch(() => []);
          const cleanAliases = Array.isArray(aliases) ? aliases : [];
          globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ = cleanAliases;
          await storageSet(ALIAS_CACHE_PREFIX + shopId, cleanAliases);
        }
        if (globalAliasRes?.ok) {
          const aliases = await globalAliasRes.json().catch(() => []);
          globalThis.__GLOBAL_ADDRESS_ALIASES_CACHE__ = Array.isArray(aliases) ? aliases : [];
          await storageSet('global_address_aliases_cache', globalThis.__GLOBAL_ADDRESS_ALIASES_CACHE__);
        }

        await storageRemove(LEGACY_CACHE_KEYS);
        this._scheduleCloudSync(shopId, 0);
        return { success: true, shopId, count: Object.keys(freshDb.byRaw).length + Object.keys(freshDb.byPhone).length };
      } catch (error) {
        console.warn('[AddressLearning] Lỗi đồng bộ từ Cloud:', error);
        return { success: false, error: error?.message || String(error) };
      } finally {
        _syncingShops.delete(shopId);
      }
    },

    async _enqueue(shopId, entry) {
      const outbox = await readOutbox(shopId);
      const queued = { action: 'upsert', ...entry, queued_at: Date.now() };
      const identity = outboxIdentity(queued);
      const index = outbox.findIndex(item => outboxIdentity(item) === identity);
      if (index < 0) {
        outbox.push(queued);
      } else if (queued.action === 'hit') {
        outbox[index] = { ...outbox[index], hit_delta: Number(outbox[index].hit_delta || 0) + Number(queued.hit_delta || 1), queued_at: queued.queued_at };
      } else {
        const existing = outbox[index];
        const incomingEntry = toCacheEntry(queued.normalized_value, queued);
        const existingEntry = toCacheEntry(existing.normalized_value, existing);
        if (shouldReplace(existingEntry, incomingEntry)) outbox[index] = queued;
      }
      await writeOutbox(shopId, outbox.slice(-4000));
      this._scheduleCloudSync(shopId, 2500);
      return outbox.length;
    },

    _scheduleCloudSync(shopId, delayMs = 2500) {
      if (!shopId || _syncTimers.has(shopId)) return;
      const timer = setTimeout(async () => {
        _syncTimers.delete(shopId);
        const result = await this.flushPendingCloudSync(shopId);
        if (!result.success && result.pendingCount > 0) {
          const attempt = (_retryAttempts.get(shopId) || 0) + 1;
          _retryAttempts.set(shopId, attempt);
          this._scheduleCloudSync(shopId, Math.min(RETRY_MAX_MS, 2500 * (2 ** Math.min(attempt, 5))));
        }
      }, delayMs);
      _syncTimers.set(shopId, timer);
    },

    _triggerDebouncedCloudSync(shopId = null) {
      if (shopId) this._scheduleCloudSync(String(shopId), 2500);
    },

    async flushPendingCloudSync(targetShopId = null) {
      const { session, config } = await this.getAuthAndConfig();
      const shopId = String(targetShopId || session?.active_shop_id || '');
      const outbox = shopId ? await readOutbox(shopId) : [];
      if (!shopId || outbox.length === 0) return { success: true, pendingCount: 0 };
      if (!session?.access_token || !config?.url || !config?.anonKey) {
        return { success: false, reason: 'unauthorized', pendingCount: outbox.length };
      }

      try {
        const response = await fetch(`${String(config.url).replace(/\/$/, '')}/rest/v1/rpc/sync_shop_learning_batch`, {
          method: 'POST',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ p_shop_id: shopId, p_entries: outbox })
        });
        const payload = response.ok ? await response.json().catch(() => ({ success: true })) : null;
        if (!response.ok || payload?.success === false) {
          return { success: false, reason: 'request_failed', pendingCount: outbox.length };
        }

        const sentVersions = new Set(outbox.map(item => `${outboxIdentity(item)}:${item.queued_at}`));
        const latest = await readOutbox(shopId);
        const remaining = latest.filter(item => !sentVersions.has(`${outboxIdentity(item)}:${item.queued_at}`));
        await writeOutbox(shopId, remaining);
        _retryAttempts.delete(shopId);
        return { success: true, pendingCount: remaining.length };
      } catch (error) {
        return { success: false, error: error?.message || String(error), pendingCount: outbox.length };
      }
    },

    async getSyncStatus(targetShopId = null) {
      const shopId = await this._resolveShopId(targetShopId);
      const outbox = shopId ? await readOutbox(shopId) : [];
      return { shopId, pendingCount: outbox.length, retryAttempt: _retryAttempts.get(shopId) || 0 };
    },

    async learn(rawAddress, correctAddressObj, phone = '', options = {}) {
      if (!correctAddressObj) return null;
      const shopId = await this._resolveShopId(options.shopId);
      if (!shopId) return null;
      const confidence = clampConfidence(options.confidence ?? correctAddressObj.confidence ?? 0);
      const sourceType = options.sourceType || correctAddressObj.sourceType || correctAddressObj.source || 'local_pipeline';
      const verified = Boolean(options.verified || sourceType === 'admin_verified' || sourceType === 'human_confirmed');
      if (!verified && confidence < 85) return null;

      const incoming = toCacheEntry(correctAddressObj, { confidence, sourceType, verified });
      if (typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.cleanObject === 'function' && incoming.normalizedValue) {
        incoming.normalizedValue = globalThis.AddressSanitizer.cleanObject(incoming.normalizedValue);
      }
      const rawKey = normalizeLookupKey(rawAddress);
      const phoneKey = normalizePhone(phone);
      const db = await readDb(shopId);
      const cloudEntries = [];

      if (rawKey && rawKey !== 'không tìm thấy' && shouldReplace(db.byRaw[rawKey], incoming)) {
        db.byRaw[rawKey] = incoming;
        cloudEntries.push({ category: 'address_raw', raw_key: rawKey });
      }
      if (phoneKey && shouldReplace(db.byPhone[phoneKey], incoming)) {
        db.byPhone[phoneKey] = incoming;
        cloudEntries.push({ category: 'customer_phone', raw_key: phoneKey });
      }
      trimBucket(db.byRaw, MAX_ENTRIES);
      trimBucket(db.byPhone, MAX_ENTRIES);
      await writeDb(shopId, db);

      for (const item of cloudEntries) {
        await this._enqueue(shopId, {
          ...item,
          normalized_value: incoming.normalizedValue,
          confidence: incoming.confidence,
          source_type: incoming.sourceType,
          verified: incoming.verified
        });
      }
      return { shopId, learned: cloudEntries.length };
    },

    async recordUserCorrection({ field, originalValue, correctedValue, rawText = '', phone = '', shopId = null, confirmed = false }) {
      if (!field || correctedValue === undefined || correctedValue === null) return null;
      const resolvedShopId = await this._resolveShopId(shopId);
      if (!resolvedShopId) return null;
      const original = normalizeField(originalValue);
      const corrected = normalizeField(correctedValue);
      if (!corrected || original === corrected) return null;

      const inputFingerprint = fingerprint(rawText || `${field}:${original}`);
      const rawKey = `${field}:${inputFingerprint}`;
      const sourceType = confirmed ? 'human_confirmed' : 'human_edit';
      const confidence = confirmed ? 100 : 98;
      const normalizedValue = {
        field,
        originalValue: original,
        correctedValue: corrected,
        inputFingerprint,
        phone: normalizePhone(phone),
        sourceType
      };

      const db = await readDb(resolvedShopId);
      db.corrections[rawKey] = {
        normalizedValue,
        confidence,
        sourceType,
        verified: confirmed,
        updatedAt: Date.now()
      };
      trimBucket(db.corrections, MAX_CORRECTIONS);
      await writeDb(resolvedShopId, db);
      await this._enqueue(resolvedShopId, {
        category: 'field_correction', raw_key: rawKey, normalized_value: normalizedValue,
        confidence, source_type: sourceType, verified: confirmed
      });
      return { field, originalValue: original, correctedValue: corrected, shopId: resolvedShopId };
    },

    async applyCorrections(parsedData, rawText = '', targetShopId = null) {
      if (!parsedData || typeof parsedData !== 'object') return parsedData;
      const shopId = await this._resolveShopId(targetShopId);
      if (!shopId) return { ...parsedData };
      const db = await readDb(shopId);
      const result = { ...parsedData };
      const inputFingerprint = fingerprint(rawText);
      const fields = ['name', 'phone', 'orderCode', 'codAmount', 'address', 'productItem'];

      for (const field of fields) {
        const key = `${field}:${inputFingerprint}`;
        const entry = db.corrections[key];
        const value = entry?.normalizedValue || entry;
        if (!value || normalizeField(result[field]) !== normalizeField(value.originalValue)) continue;
        result[field] = field === 'codAmount' ? Number(value.correctedValue || 0) : value.correctedValue;
        this._enqueue(shopId, { action: 'hit', category: 'field_correction', raw_key: key, hit_delta: 1 }).catch(() => {});
      }
      return result;
    },

    async lookup(rawAddress, phone = '', targetShopId = null) {
      const rawKey = normalizeLookupKey(rawAddress);
      const hasRawAddress = Boolean(rawKey && rawKey !== 'không tìm thấy');
      const shopId = await this._resolveShopId(targetShopId);
      const db = await readDb(shopId);

      if (hasRawAddress) {
        if (db.byRaw[rawKey]) {
          const entry = toCacheEntry(db.byRaw[rawKey]);
          if (entry.normalizedValue) {
            const matchVal = typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.cleanObject === 'function'
              ? globalThis.AddressSanitizer.cleanObject(entry.normalizedValue)
              : entry.normalizedValue;
            this._enqueue(shopId, { action: 'hit', category: 'address_raw', raw_key: rawKey, hit_delta: 1 }).catch(() => {});
            return { match: matchVal, confidence: entry.confidence, source: 'akb_raw', sourceType: entry.sourceType, verified: entry.verified };
          }
        }
        if (BUILTIN_SEEDED_LEARNING[rawKey]) {
          const matchVal = typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.cleanObject === 'function'
            ? globalThis.AddressSanitizer.cleanObject(BUILTIN_SEEDED_LEARNING[rawKey])
            : BUILTIN_SEEDED_LEARNING[rawKey];
          return { match: matchVal, confidence: 100, source: 'akb_builtin', sourceType: 'akb_builtin', verified: true };
        }
        return null;
      }

      const phoneKey = normalizePhone(phone);
      if (phoneKey && db.byPhone[phoneKey]) {
        const entry = toCacheEntry(db.byPhone[phoneKey]);
        if (entry.normalizedValue) {
          const matchVal = typeof globalThis.AddressSanitizer !== 'undefined' && typeof globalThis.AddressSanitizer.cleanObject === 'function'
            ? globalThis.AddressSanitizer.cleanObject(entry.normalizedValue)
            : entry.normalizedValue;
          this._enqueue(shopId, { action: 'hit', category: 'customer_phone', raw_key: phoneKey, hit_delta: 1 }).catch(() => {});
          return { match: matchVal, confidence: entry.confidence, source: 'akb_phone', sourceType: entry.sourceType, verified: entry.verified };
        }
      }
      return null;
    },

    async removeLocalEntry(category, rawKey, targetShopId = null) {
      const shopId = await this._resolveShopId(targetShopId);
      if (!shopId) return { success: false };
      const db = await readDb(shopId);
      if (category === 'address_raw') delete db.byRaw[normalizeLookupKey(rawKey)];
      if (category === 'customer_phone') delete db.byPhone[normalizePhone(rawKey)];
      if (category === 'field_correction') delete db.corrections[String(rawKey)];
      await writeDb(shopId, db);
      const outbox = await readOutbox(shopId);
      await writeOutbox(shopId, outbox.filter(item => !(item.category === category && item.raw_key === rawKey)));
      return { success: true };
    },

    async markLocalEntryVerified(category, rawKey, targetShopId = null) {
      const shopId = await this._resolveShopId(targetShopId);
      if (!shopId) return { success: false };
      const db = await readDb(shopId);
      const bucket = category === 'address_raw' ? db.byRaw : category === 'customer_phone' ? db.byPhone : db.corrections;
      const key = category === 'address_raw' ? normalizeLookupKey(rawKey) : category === 'customer_phone' ? normalizePhone(rawKey) : String(rawKey);
      if (bucket[key]) {
        const entry = category === 'field_correction' ? bucket[key] : toCacheEntry(bucket[key]);
        entry.confidence = 100;
        entry.sourceType = 'admin_verified';
        entry.verified = true;
        entry.updatedAt = Date.now();
        bucket[key] = entry;
        await writeDb(shopId, db);
      }
      return { success: true };
    },

    async clearShopCache(targetShopId = null) {
      const shopId = await this._resolveShopId(targetShopId);
      if (!shopId) return { success: false };
      await storageRemove([CACHE_PREFIX + shopId, ALIAS_CACHE_PREFIX + shopId]);
      globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ = [];
      return { success: true };
    }
  };

  // Tự động lắng nghe thay đổi Shop hoặc đăng xuất để xóa RAM cache và nạp đúng bucket của shop mới
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.activeShopId || changes.vnpost_session) {
        const newShopId = String(
          changes.activeShopId?.newValue ||
          changes.vnpost_session?.newValue?.active_shop_id ||
          ''
        );
        globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ = [];
        if (newShopId) {
          AddressLearning.activateShop(newShopId).catch(() => {});
        }
      }
    });
  }

  globalThis.AddressLearning = AddressLearning;
})();
