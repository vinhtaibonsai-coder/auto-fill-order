import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Chrome Extension Content Scripts Syntax & ES Module Invariant', async (t) => {
  const manifestPath = path.join(rootDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const contentScripts = manifest.content_scripts?.[0]?.js || [];
  assert.ok(contentScripts.length > 0, 'content_scripts.js list must not be empty');

  const exportViolations = [];
  const cjsViolations = [];

  for (const relativePath of contentScripts) {
    const fullPath = path.join(rootDir, relativePath);
    assert.ok(fs.existsSync(fullPath), `Content script file must exist: ${relativePath}`);
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      // 1. Look for top-level export or import syntax
      if (/^\s*(export\s+|export\s+default\s+|export\s*\{|import\s+[^('"])/.test(line)) {
        exportViolations.push({
          file: relativePath,
          line: idx + 1,
          code: trimmed
        });
      }
      // 2. Look for module.exports which triggers Rollup commonjs wrapper
      // and causes @crxjs to wrap "export default" inside (function(){ ... })()
      if (trimmed.includes('module.exports')) {
        cjsViolations.push({
          file: relativePath,
          line: idx + 1,
          code: trimmed
        });
      }
    });
  }

  assert.deepEqual(
    exportViolations,
    [],
    `Found top-level export/import in content scripts that will crash Chrome extension runtime: ${JSON.stringify(exportViolations, null, 2)}`
  );

  assert.deepEqual(
    cjsViolations,
    [],
    `Found module.exports in content scripts that triggers broken export-in-function wrapper: ${JSON.stringify(cjsViolations, null, 2)}`
  );
});

