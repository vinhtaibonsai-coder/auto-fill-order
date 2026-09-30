(function () {
  function _sanitise(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/\uFFFD/g, '').replace(/\s+/g, ' ').trim();
  }

  function _cleanPlaceType(raw, shortName) {
    const s = _sanitise(raw);
    if (s.includes('Tỉnh') || s.includes('Tinh') || s.includes('Tnh')) return 'Tỉnh';
    if (s.includes('Thành phố') || s.includes('Thanh pho') || s.includes('Thnh ph')) return 'Thành phố Trung Ương';
    return shortName && shortName.startsWith('Thành phố') ? 'Thành phố Trung Ương' : 'Tỉnh';
  }

  function _fullProvinceName(shortName, placeType) {
    if (placeType === 'Tỉnh') return 'Tỉnh ' + shortName;
    return shortName;
  }

  function build(data) {
    const provincesMap = {};
    const wardsMap = {};

    for (const entry of data) {
      const shortName = entry.province_short_name || entry.province_name;
      const cleanShort = _sanitise(shortName);
      if (!cleanShort) continue;

      const placeType = _cleanPlaceType(entry.place_type, cleanShort);
      const fullName = _fullProvinceName(cleanShort, placeType);

      if (!provincesMap[fullName]) {
        provincesMap[fullName] = {
          name: fullName,
          short_name: cleanShort,
          place_type: placeType,
          is_merged: !!entry.province_is_merged,
          merged_with: entry.province_merged_with || [],
        };
      }

      if (!wardsMap[fullName]) wardsMap[fullName] = [];
      wardsMap[fullName].push({
        name: _sanitise(entry.ward_name || ''),
        code: entry.ward_code || '',
        old_units: entry.old_units || [],
        province_merged_with: entry.province_merged_with || [],
        administrative_center: entry.administrative_center || '',
      });
    }

    const db = {
      provinces: Object.values(provincesMap).sort((a, b) => a.name.localeCompare(b.name)),
      wards: wardsMap,
    };
    if (typeof window !== 'undefined') {
      window.NEW_ADM_DB = db;
      window._NEW_ADM_READY = true;
    }
    if (typeof globalThis !== 'undefined') {
      globalThis.NEW_ADM_DB = db;
      globalThis._NEW_ADM_READY = true;
    }
  }

  // Non-blocking async fetch for data-new.json
  const url = (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function')
    ? chrome.runtime.getURL('src/application/address/database/data-new.json')
    : './src/application/address/database/data-new.json';

  let _loadPromise = null;
  async function loadNewAdmDb() {
    if (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) return globalThis.NEW_ADM_DB;
    if (typeof window !== 'undefined' && window.NEW_ADM_DB) return window.NEW_ADM_DB;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
      try {
        if (typeof process !== 'undefined' && process.versions?.node) {
          try {
            const fsMod = 'node:' + 'fs';
            const pathMod = 'node:' + 'path';
            const { readFileSync, existsSync } = await import(/* @vite-ignore */ fsMod);
            const { resolve } = await import(/* @vite-ignore */ pathMod);
            const p = resolve('src/application/address/database/data-new.json');
            if (existsSync(p)) {
              const json = JSON.parse(readFileSync(p, 'utf8'));
              build(json);
              return (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) || (typeof window !== 'undefined' && window.NEW_ADM_DB);
            }
          } catch (_) {}
        }
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          build(json);
          return (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) || (typeof window !== 'undefined' && window.NEW_ADM_DB);
        }
      } catch (err) {
        // Silent graceful fallback
      }
      return null;
    })();
    return _loadPromise;
  }

  // Auto trigger non-blocking load
  loadNewAdmDb();

  if (typeof globalThis !== 'undefined') globalThis.loadNewAdmDb = loadNewAdmDb;
  if (typeof window !== 'undefined') window.loadNewAdmDb = loadNewAdmDb;
})();
