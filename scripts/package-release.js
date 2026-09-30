#!/usr/bin/env node

/**
 * ============================================================================
 * COMMERCIAL RELEASE PACKAGER (1-Click Đóng Gói Bản Thương Mại)
 * ============================================================================
 * - Tự động bump version (patch/minor/major)
 * - Kiểm tra chất lượng (chạy toàn bộ test suites)
 * - Build production bundle sạch sẽ vào extension/
 * - Nén thành file ZIP thương mại tại dist-release/AutoFillOrder-v{version}.zip
 * - In mã SHA-256 và hướng dẫn phát hành lên Admin Portal
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');
const EXTENSION_DIR = path.join(ROOT_DIR, 'extension');
const RELEASE_DIR = path.join(ROOT_DIR, 'dist-release');

// Helper đọc và lưu JSON định dạng đẹp
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2] += 1;
  }
  return parts.join('.');
}

// 1. Phân tích CLI arguments
const args = process.argv.slice(2);
let bumpType = null;
let explicitVersion = null;
let skipTest = false;

for (const arg of args) {
  if (arg.startsWith('--bump=')) {
    bumpType = arg.split('=')[1].toLowerCase();
  } else if (arg.startsWith('--version=')) {
    explicitVersion = arg.split('=')[1].trim();
  } else if (arg === '--skip-test') {
    skipTest = true;
  }
}

console.log('\n======================================================');
console.log('🚀 BẮT ĐẦU ĐÓNG GÓI BẢN THƯƠNG MẠI (COMMERCIAL RELEASE)');
console.log('======================================================\n');

// 2. Xác định & Cập nhật Version
const manifest = readJson(MANIFEST_PATH);
const pkg = readJson(PACKAGE_PATH);
let currentVersion = manifest.version || pkg.version || '1.0.0';
let newVersion = currentVersion;

if (explicitVersion) {
  newVersion = explicitVersion;
} else if (bumpType) {
  newVersion = bumpVersion(currentVersion, bumpType);
}

if (newVersion !== currentVersion) {
  console.log(`📦 Tăng phiên bản: v${currentVersion} ➔ v${newVersion}`);
  manifest.version = newVersion;
  pkg.version = newVersion;
  writeJson(MANIFEST_PATH, manifest);
  writeJson(PACKAGE_PATH, pkg);
} else {
  console.log(`📦 Giữ nguyên phiên bản hiện tại: v${newVersion}`);
}

// 3. Chạy kiểm thử tự động
if (!skipTest) {
  console.log('\n🧪 Đang chạy toàn bộ kiểm thử bảo mật & hợp đồng (npm test)...');
  try {
    execSync('npm test', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ Toàn bộ bài kiểm thử đã PASS thành công!\n');
  } catch (err) {
    console.error('\n❌ Kiểm thử THẤT BẠI! Hủy quá trình đóng gói để bảo vệ chất lượng.');
    process.exit(1);
  }
} else {
  console.log('⚠️ Bỏ qua kiểm thử theo yêu cầu (--skip-test).');
}

// 4. Build Production Bundle
console.log('🔨 Đang biên dịch Production Bundle (npm run build)...');
try {
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('✅ Đã build và đồng bộ thành công vào thư mục extension/\n');
} catch (err) {
  console.error('❌ Quá trình build thất bại:', err.message);
  process.exit(1);
}

// 5. Kiểm tra tính toàn vẹn thư mục extension/
const requiredFiles = ['manifest.json', 'options.html', 'index.html', 'admin.html', 'privacy.html', 'terms.html', 'assets'];
for (const f of requiredFiles) {
  const p = path.join(EXTENSION_DIR, f);
  if (!fs.existsSync(p)) {
    console.error(`❌ Thiếu file bắt buộc trong extension/: ${f}`);
    process.exit(1);
  }
}

// Dọn dẹp các file rác hệ điều hành
function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const lower = entry.name.toLowerCase();
    if (lower === 'desktop.ini' || lower === 'thumbs.db' || lower === '.ds_store') {
      try { fs.unlinkSync(full); } catch (_) {}
    } else if (entry.isDirectory()) {
      cleanDir(full);
    }
  }
}
cleanDir(EXTENSION_DIR);

// 6. Tạo thư mục dist-release/ và nén file ZIP
if (!fs.existsSync(RELEASE_DIR)) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
}

const zipFileName = `AutoFillOrder-v${newVersion}.zip`;
const zipFilePath = path.join(RELEASE_DIR, zipFileName);

if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

const zlib = require('zlib');

// Fallback CRC32 nếu zlib.crc32 không có (hỗ trợ mọi phiên bản Node.js)
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function calculateCrc32(buf) {
  if (typeof zlib.crc32 === 'function') {
    return zlib.crc32(buf);
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Hàm đóng gói ZIP chuẩn PKZIP / RFC 1951, đảm bảo 100% path separator là '/' (không bao giờ dùng '\' của Windows)
function zipDirectory(sourceDir, outPath) {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  walk(sourceDir);

  const localHeaders = [];
  const cdHeaders = [];
  let offset = 0;

  for (const file of files) {
    // BẮT BUỘC: Chuẩn hóa mọi dấu gạch chéo thành '/' để tương thích hoàn hảo Chromium / CentBrowser / Linux / macOS
    const rel = path.relative(sourceDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file);
    const crc = calculateCrc32(content);
    const deflated = zlib.deflateRawSync(content);
    const useCompressed = deflated.length < content.length;
    const method = useCompressed ? 8 : 0;
    const data = useCompressed ? deflated : content;
    const nameBuf = Buffer.from(rel, 'utf8');

    // Local Header (30 bytes + name length)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Signature
    lh.writeUInt16LE(20, 4);         // Version needed: 2.0
    lh.writeUInt16LE(0x0800, 6);     // Bit 11 = UTF-8 filename
    lh.writeUInt16LE(method, 8);     // Compression method (0 = Stored, 8 = Deflated)
    lh.writeUInt16LE(0, 10);        // Last mod file time
    lh.writeUInt16LE(0, 12);        // Last mod file date
    lh.writeUInt32LE(crc, 14);       // CRC-32
    lh.writeUInt32LE(data.length, 18);   // Compressed size
    lh.writeUInt32LE(content.length, 22);// Uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);// Filename length
    lh.writeUInt16LE(0, 28);        // Extra field length
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, data);

    // Central Directory Header (46 bytes + name length)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // Signature
    cd.writeUInt16LE(20, 4);         // Version made by: 2.0
    cd.writeUInt16LE(20, 6);         // Version needed: 2.0
    cd.writeUInt16LE(0x0800, 8);     // Bit 11 = UTF-8 filename
    cd.writeUInt16LE(method, 10);    // Compression method
    cd.writeUInt16LE(0, 12);        // Last mod file time
    cd.writeUInt16LE(0, 14);        // Last mod file date
    cd.writeUInt32LE(crc, 16);       // CRC-32
    cd.writeUInt32LE(data.length, 20);   // Compressed size
    cd.writeUInt32LE(content.length, 24);// Uncompressed size
    cd.writeUInt16LE(nameBuf.length, 28);// Filename length
    cd.writeUInt16LE(0, 30);        // Extra field length
    cd.writeUInt16LE(0, 32);        // File comment length
    cd.writeUInt16LE(0, 34);        // Disk number start
    cd.writeUInt16LE(0, 36);        // Internal file attributes
    cd.writeUInt32LE(0, 38);        // External file attributes
    cd.writeUInt32LE(offset, 42);    // Relative offset of local header
    nameBuf.copy(cd, 46);

    cdHeaders.push(cd);
    offset += lh.length + data.length;
  }

  const cdStart = offset;
  const cdBuf = Buffer.concat(cdHeaders);
  const cdSize = cdBuf.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Disk with CD
  eocd.writeUInt16LE(files.length, 8); // Number of entries on this disk
  eocd.writeUInt16LE(files.length, 10);// Total number of entries
  eocd.writeUInt32LE(cdSize, 12);     // Size of central directory
  eocd.writeUInt32LE(cdStart, 16);    // Offset of start of central directory
  eocd.writeUInt16LE(0, 20);         // Comment length

  const finalZip = Buffer.concat([...localHeaders, cdBuf, eocd]);
  fs.writeFileSync(outPath, finalZip);
}

try {
  zipDirectory(EXTENSION_DIR, zipFilePath);
  console.log(`✅ Nén thành công file zip với chuẩn đường dẫn POSIX '/' tương thích mọi trình duyệt.`);
} catch (zipErr) {
  console.error('❌ Lỗi khi nén file zip:', zipErr.message);
  process.exit(1);
}

if (!fs.existsSync(zipFilePath)) {
  console.error('❌ Không tìm thấy file zip sau khi nén.');
  process.exit(1);
}

// 7. Tính toán kích thước & Checksum SHA-256
const stats = fs.statSync(zipFilePath);
const sizeKb = (stats.size / 1024).toFixed(2);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

const fileBuffer = fs.readFileSync(zipFilePath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log('\n======================================================');
console.log('🎉 ĐÓNG GÓI THƯƠNG MẠI THÀNH CÔNG!');
console.log('======================================================');
console.log(`📁 File ZIP hoàn thiện : ${zipFilePath}`);
console.log(`🏷️ Phiên bản         : v${newVersion}`);
console.log(`📊 Dung lượng          : ${sizeKb} KB (${sizeMb} MB)`);
console.log(`🔒 SHA-256 Checksum    : ${sha256}`);
console.log('======================================================\n');

console.log('📋 CÁC BƯỚC PHÁT HÀNH TIẾP THEO:');
console.log('1. Upload file ZIP này lên Google Drive (chế độ công khai) hoặc Supabase Storage.');
console.log('2. Mở Master Admin (/admin.html) ➔ Vào mục [Trung Tâm Phát Hành] (Release Center).');
console.log('3. Bấm [Phát hành phiên bản mới]:');
console.log(`   - Phiên bản: ${newVersion}`);
console.log(`   - Link tải : [Dán link tải file ZIP vừa upload]`);
console.log(`   - Bật "Bắt buộc cập nhật ngay" nếu đây là bản vá lỗi quan trọng.`);
console.log('\nToàn bộ máy khách hàng sẽ tự động nhận diện và cập nhật ngay lập tức! ✨\n');
