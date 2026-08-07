/**
 * gen_ward_merge.js
 * Generate ward_merger.js by merging old data + official merges.json (34 provinces)
 * Standardizes ALL province names and ward names from official data.
 */
const fs = require('fs');
const path = require('path');

// --- Normalization helpers ---
function normalizeKey(s) {
  return s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s()/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Load official merges.json
const mergesRaw = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'features', 'address', 'database', 'merges_raw.json'), 'utf-8'
));

// merges_raw.json has structure: { data: [ ... 34 provinces ... ] }
// But it might be just the array directly
let officialProvinces;
if (Array.isArray(mergesRaw)) {
  officialProvinces = mergesRaw;
} else if (mergesRaw.data && Array.isArray(mergesRaw.data)) {
  officialProvinces = mergesRaw.data;
} else {
  console.error('Unexpected merges_raw.json structure');
  process.exit(1);
}

console.log(`Official provinces: ${officialProvinces.length}`);
let totalOldMerged = 0;
let totalNewWards = 0;

// Build map: normalized(old ward name) => { ward, province } from official data
const officialMap = new Map();
const officialProvinceNames = new Map(); // level1_id => province name

for (const prov of officialProvinces) {
  const provName = prov.name;
  const provId = prov.level1_id;
  officialProvinceNames.set(provId, provName);

  for (const l2 of prov.level2s) {
    const newWardName = l2.name;
    totalNewWards++;

    for (const merge of l2.merges) {
      const oldName = merge.name;
      // Normalize old ward name as it would appear in user input
      const key = normalizeKey(oldName);
      // Use province name from context (after normalization) to disambiguate
      // We'll store by key + province context later
      if (!officialMap.has(key)) {
        officialMap.set(key, []);
      }
      officialMap.get(key).push({
        ward: newWardName,
        province: provName,
        oldName: oldName,
        type: merge.type
      });
      totalOldMerged++;
    }
  }
}

console.log(`Total old wards in merges: ${totalOldMerged}`);
console.log(`Total new wards (level2): ${totalNewWards}`);
console.log(`Unique normalized keys: ${officialMap.size}`);

// --- Load old ward_merger.js data ---
// We need to parse the existing JS file
const oldJsPath = path.join(__dirname, 'features', 'address', 'database', 'ward_merger.js');
// Read the old file (the previously generated one that might have some proper entries)
// Actually, we need to extract just the KV pairs from it
const oldContent = fs.readFileSync(oldJsPath, 'utf-8');

// Find the WARD_MERGER_MAP object
const mapStart = oldContent.indexOf('WARD_MERGER_MAP = {');
const mapEnd = oldContent.lastIndexOf('};');
if (mapStart === -1 || mapEnd === -1) {
  console.error('Could not parse WARD_MERGER_MAP from old file');
  process.exit(1);
}

const mapText = oldContent.substring(mapStart + 19, mapEnd + 1);

// Simple parser for the JS object (handles quoted keys, {ward, province} values)
function parseOldEntries(text) {
  const entries = [];
  const regex = /"((?:[^"\\]|\\.)*)"\s*:\s*\{\s*ward:\s*"((?:[^"\\]|\\.)*)"\s*,\s*province:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    entries.push({
      key: match[1],
      ward: match[2],
      province: match[3]
    });
  }
  return entries;
}

const oldEntries = parseOldEntries(mapText);
console.log(`\nParsed old entries: ${oldEntries.length}`);

// --- Sanitize corrupted Vietnamese in old entries ---
function sanitizeVn(s) {
  // Fix common corruption patterns
  return s
    .replace(/T��y Ninh/g, 'Tây Ninh')
    .replace(/T??y Ninh/g, 'Tây Ninh');
}
let sanitizedCount = 0;
for (const entry of oldEntries) {
  const oldKey = entry.key;
  const oldWard = entry.ward;
  const oldProv = entry.province;
  entry.key = sanitizeVn(entry.key);
  entry.ward = sanitizeVn(entry.ward);
  entry.province = sanitizeVn(entry.province);
  if (entry.key !== oldKey || entry.ward !== oldWard || entry.province !== oldProv) {
    sanitizedCount++;
  }
}
if (sanitizedCount > 0) {
  console.log(`Sanitized corrupted entries: ${sanitizedCount}`);
}

// --- Build the new map ---
// Strategy:
// 1. First, add all official entries (from merges.json) - these map old wards -> new wards
// 2. Then add old entries that don't conflict with official ones
//
// Conflict detection: if same key exists in official map, skip old entry

const resultMap = new Map();

// Track which keys we've set from official data
const officialKeys = new Set();

// Add official entries first (with province context for disambiguation)
// For each official entry, we use the normalized key (which is the normalized old ward name)
// plus a disambiguation suffix based on province
for (const [key, entries] of officialMap) {
  if (entries.length === 1) {
    // Unique match - no disambiguation needed
    const entry = entries[0];
    resultMap.set(key, {
      ward: entry.ward,
      province: entry.province
    });
    officialKeys.add(key);
  } else {
    // Multiple provinces have the same old ward name
    // Use province name context for disambiguation
    for (const entry of entries) {
      // Create disambiguated key: "ward_name (province_short)"
      const provShort = normalizeKey(entry.province)
        .replace(/^(thanh pho|tinh)\s+/, '')
        .trim();
      const disKey = `${key} (${provShort})`;
      resultMap.set(disKey, {
        ward: entry.ward,
        province: entry.province
      });
      officialKeys.add(disKey);
      
      // If the raw key doesn't exist yet, add it too (as catch-all)
      // But use the first entry's ward (assuming most common)
      if (!resultMap.has(key)) {
        resultMap.set(key, {
          ward: entry.ward,
          province: entry.province
        });
        officialKeys.add(key);
      }
    }
  }
}

// Now add old entries that don't conflict
let conflictCount = 0;
let addedCount = 0;
for (const entry of oldEntries) {
  if (officialKeys.has(entry.key)) {
    conflictCount++;
    continue;
  }
  if (resultMap.has(entry.key)) {
    conflictCount++;
    continue;
  }
  resultMap.set(entry.key, {
    ward: entry.ward,
    province: entry.province
  });
  addedCount++;
}

console.log(`Official entries added: ${officialKeys.size}`);
console.log(`Old entries preserved: ${addedCount}`);
console.log(`Conflicts skipped: ${conflictCount}`);
console.log(`Total entries: ${resultMap.size}`);

// --- Build WARD_MERGER_INDEX ---
// Index: ward name normalized -> set of keys that map to it
const index = new Map();
for (const [key, val] of resultMap) {
  const wardKey = normalizeKey(val.ward);
  if (!index.has(wardKey)) {
    index.set(wardKey, new Set());
  }
  index.get(wardKey).add(key);
}

// --- Generate new JS file ---
let output = `// ward_merger.js - Bản đồ sáp nhập Phường/Xã 2025 (từ Quyết định 19/2025/QĐ-TTg)
// Nguồn chính thức: https://github.com/dvhcvn/20250701 (merges.json)
// Tích hợp dữ liệu cũ + mới, chuẩn hoá tất cả 34 tỉnh thành. Tổng: ${resultMap.size} entries
(() => {
  const WARD_MERGER_MAP = {\n`;

// Sort keys for deterministic output
const sortedKeys = [...resultMap.keys()].sort();

for (const key of sortedKeys) {
  const val = resultMap.get(key);
  // Escape any special characters in key/values for JS string
  const escKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escWard = val.ward.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escProv = val.province.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  output += `    "${escKey}": { ward: "${escWard}", province: "${escProv}" },\n`;
}

output += `  };\n\n`;

// Build the index
output += `  const WARD_MERGER_INDEX = {\n`;
const sortedIndexKeys = [...index.keys()].sort();
for (const wardKey of sortedIndexKeys) {
  const refs = [...index.get(wardKey)].sort();
  output += `    "${wardKey}": [`;
  for (let i = 0; i < refs.length; i++) {
    const escRef = refs[i].replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    if (i > 0) output += ', ';
    output += `"${escRef}"`;
  }
  output += `],\n`;
}
output += `  };\n\n`;

output += `  globalThis.WARD_MERGER_MAP = WARD_MERGER_MAP;\n`;
output += `  globalThis.WARD_MERGER_INDEX = WARD_MERGER_INDEX;\n`;
output += `})();\n`;

// Write output
const outPath = path.join(__dirname, 'features', 'address', 'database', 'ward_merger.js');
fs.writeFileSync(outPath, output, 'utf-8');

console.log(`\nWritten to: ${outPath}`);
console.log(`File size: ${fs.statSync(outPath).size} bytes`);

// Verify encoding
const verify = fs.readFileSync(outPath, 'utf-8');
console.log(`Verify - has 'Phường': ${verify.includes('Phường')}`);
console.log(`Verify - has 'Tỉnh': ${verify.includes('Tỉnh')}`);
console.log(`Verify - has 'Thành phố': ${verify.includes('Thành phố')}`);
console.log(`Verify - has 'Đà Lạt': ${verify.includes('Đà Lạt')}`);
