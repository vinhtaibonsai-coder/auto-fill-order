#!/usr/bin/env node
// P0-5 audit: chặn innerHTML chưa escape
// Fail nếu tìm thấy "innerHTML =" mà 2 dòng trước không có escapeHTML / DOMPurify / textContent fallback
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scanDirs = ['src', 'frontend', 'extension/src', 'extension/frontend', 'admin-dashboard'];
const allowedHelpers = ['escapeHTML', 'escapeHtml', 'DOMPurify', 'textContent', 'innerText', 'esc(', 'escape('];

function getFiles(dir, exts = ['.js', '.jsx', '.ts', '.tsx']) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist' || e.name === 'assets') continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...getFiles(fp, exts));
    else if (exts.some(ext => e.name.endsWith(ext))) out.push(fp);
  }
  return out;
}

let violations = [];

// P0-5 focus: chỉ chặn user-controlled fields (extraNote, productNote, content, message) render qua innerHTML chưa escape
const userFields = ['extraNote', 'productNote', 'product_note', 'content', 'message', 'note', 'description', 'address', 'name', 'phone', 'orderCode'];
function isUserFieldInterpolation(line) {
  return userFields.some(f => line.includes(f));
}

for (const d of scanDirs) {
  const full = path.join(root, d);
  const files = getFiles(full);
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const hasInner = line.includes('innerHTML') && line.includes('=');
      const hasAdjacent = line.includes('insertAdjacentHTML') || (line.includes('outerHTML') && line.includes('='));
      if (hasInner || hasAdjacent) {
        const window = lines.slice(Math.max(0, idx - 2), idx + 3).join('\n');
        // whitelist nếu có escape helper trong cùng dòng hoặc 2 dòng lân cận
        const hasEscape = allowedHelpers.some(h => window.includes(h)) || line.includes('esc(') || line.includes('escape');
        // Bỏ qua clear hoặc static icon (PANEL_ICONS, skeleton, spinner)
        const isStaticIcon = /PANEL_ICONS|skeleton|spinner|animate-spin|ph ph-/.test(line);
        const isClear = /innerHTML\s*=\s*['"]\s*['"]/.test(line) && !line.includes('${');
        if (isClear || isStaticIcon) return;
        if (hasEscape) return;
        // Chỉ fail khi có interpolation user field và chưa escape
        const hasInterpolation = line.includes('${') || line.includes('+');
        const hasUserField = isUserFieldInterpolation(line) || isUserFieldInterpolation(window);
        if (hasInterpolation && hasUserField) {
          violations.push({ file: path.relative(root, f), line: idx + 1, code: line.trim().slice(0,140) });
        } else if (hasAdjacent) {
          violations.push({ file: path.relative(root, f), line: idx + 1, code: line.trim().slice(0,140) });
        }
      }
    });
  }
}

// Cho phép whitelist: các file đã audit kỹ sẽ được thêm vào ignore nếu thực sự an toàn
// Hiện tại P0-5 yêu cầu 0 violation sau khi đã fix extraNote bằng textContent/escapeHTML

if (violations.length > 0) {
  console.error(`❌ P0-5 FAIL: Phát hiện ${violations.length} vị trí innerHTML chưa có escape:`);
  violations.forEach(v => console.error(`  ${v.file}:${v.line} -> ${v.code}`));
  console.error('\nGợi ý fix: dùng el.textContent = value hoặc el.innerHTML = escapeHTML(value) hoặc DOMPurify.sanitize(value)');
  process.exit(1);
} else {
  console.log('✅ P0-5 PASS: Không phát hiện innerHTML chưa escape');
}
