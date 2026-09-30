import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Test Suite: G014 Vietnamese Mojibake Cleanup ---');

// Known Vietnamese mojibake patterns:
// 1. Box drawing / dashes corrupted: â”€, â• , â€“
// 2. Corrupted ellipsis / punctuation: â€¦, â€™, â€œ, â€
// 3. UTF-8 multi-byte characters decoded as Windows-1252:
//    - CÃ i, Ä‘áº·t, há»‡, thá»‘ng, hiá»ƒn, táº¥t, cáº£, xáº¿p, dá»
//    - Ä‘áº§u, tiÃªn, bá», vÃ¬, Ä‘Ã£, cÃ³, dÃ¹ng, Ä‘á»‹a, chá»‰
//    - phÃ¢n, háº¡ng, nhÃ , váº­n, chuyá»ƒn, NhÃ£n, cáº£nh, bÃ¡o, nÃºt, máº¡ng, xÃ£, há»™i
//    - General regex: â”€|â• |â€“|â€¦|â€™|â€œ|â€|Ã[¡-¿]|Ä‘|Äƒ|Æ°|Æ¡|áº|á»
const MOJIBAKE_PATTERN = /(â”€|â• |â€“|â€¦|â€™|â€œ|â€|Ã[¡-¿]|Ä‘|Äƒ|Æ°|Æ¡|áº|á»)/;

function findMojibakeInDirectory(dirPath, violations = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'extension', 'brain', 'scripts'].includes(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      findMojibakeInDirectory(fullPath, violations);
    } else if (/\.(js|jsx|css|html|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        if (MOJIBAKE_PATTERN.test(line)) {
          violations.push({
            file: fullPath.replace(/\\/g, '/'),
            line: lineNum + 1,
            snippet: line.trim()
          });
        }
      }
    }
  }
  return violations;
}

// Scan primary source directories: src, frontend, admin-dashboard, public
const scanDirs = ['src', 'frontend', 'admin-dashboard', 'public'];
let allViolations = [];

for (const d of scanDirs) {
  if (fs.existsSync(d)) {
    findMojibakeInDirectory(d, allViolations);
  }
}

if (allViolations.length > 0) {
  console.error(`Found ${allViolations.length} Vietnamese mojibake occurrence(s):`);
  allViolations.slice(0, 10).forEach(v => {
    console.error(`  ${v.file}:${v.line} -> ${v.snippet}`);
  });
}

assert.equal(
  allViolations.length,
  0,
  `Source code must not contain any Vietnamese mojibake patterns. Found ${allViolations.length} violation(s).`
);

console.log('✔ All UI and source files verified completely clean of Vietnamese mojibake');
console.log('All G014 Vietnamese Mojibake Cleanup contracts verified successfully.');
