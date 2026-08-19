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

    window.NEW_ADM_DB = {
      provinces: Object.values(provincesMap).sort((a, b) => a.name.localeCompare(b.name)),
      wards: wardsMap,
    };
    window._NEW_ADM_READY = true;
  }

  // Try to load data-new.json synchronously via XHR (works in extension pages)
  const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('backend/features/address/database/data-new.json')
    : '../../backend/features/address/database/data-new.json';

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.overrideMimeType('application/json; charset=utf-8');
    xhr.send(null);
    if (xhr.status === 200 || xhr.status === 0) {
      build(JSON.parse(xhr.responseText));
    } else {
      console.error('[NEW_ADM] XHR failed:', xhr.status, xhr.statusText);
    }
  } catch (e) {
    console.error('[NEW_ADM] XHR error:', e);
    // Fallback: try fetch async
    fetch(url)
      .then(r => r.json())
      .then(build)
      .catch(err => console.error('[NEW_ADM] fallback fetch failed:', err));
  }
})();
