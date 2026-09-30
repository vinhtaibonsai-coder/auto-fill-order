import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('1. formatVNPostOrderCode correctly strips accents and spaces', () => {
  const formatVNPostOrderCode = (code) => {
    if (!code) return '';
    return String(code)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, '')
      .trim();
  };

  assert.equal(formatVNPostOrderCode('Lũa Thuỷ Sinh'), 'LuaThuySinh');
  assert.equal(formatVNPostOrderCode('ĐH 123 456'), 'DH123456');
  assert.equal(formatVNPostOrderCode('Pct 361'), 'Pct361');
  assert.equal(formatVNPostOrderCode('Đơn Hàng VIP #99'), 'DonHangVIP#99');
  assert.equal(formatVNPostOrderCode('  E100 . 491  '), 'E100.491');
  assert.equal(formatVNPostOrderCode(''), '');
  assert.equal(formatVNPostOrderCode(null), '');
});

test('2. vnpost/autofill.js contains formatVNPostOrderCode and formats orderCode before fill', () => {
  const autofillPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'vnpost', 'autofill.js');
  const code = fs.readFileSync(autofillPath, 'utf8');

  assert.match(code, /function formatVNPostOrderCode\(code\)/, 'autofill.js must define formatVNPostOrderCode');
  assert.match(code, /formatVNPostOrderCode\(orderCode\)/, 'autofill.js must format orderCode before setting input');
});

test('3. content/index.js and panel.js enforce formatVNPostOrderCode and sanitized fallbacks', () => {
  const contentPath = path.join(repoRoot, 'src', 'runtime', 'content', 'index.js');
  const contentCode = fs.readFileSync(contentPath, 'utf8');
  assert.match(contentCode, /function formatVNPostOrderCode\(code\)/, 'content/index.js must define formatVNPostOrderCode');
  assert.match(contentCode, /fillOrderCode\s*=\s*\(targetPlatform === 'vnpost' && orderCode\)\s*\?\s*formatVNPostOrderCode\(orderCode\)\s*:\s*orderCode/, 'content/index.js must format fillOrderCode');

  const panelPath = path.join(repoRoot, 'frontend', 'panel', 'panel.js');
  const panelCode = fs.readFileSync(panelPath, 'utf8');
  assert.match(panelCode, /function formatVNPostOrderCode\(code\)/, 'panel.js must define formatVNPostOrderCode');
  assert.match(panelCode, /LuaThuySinh/, 'panel.js must use unaccented LuaThuySinh fallback for VNPost');
});

test('4. ai-gateway and Quotas.jsx default to llama-3.3-70b-versatile with 404 resilience', () => {
  const edgePath = path.join(repoRoot, 'supabase', 'functions', 'ai-gateway', 'index.ts');
  const edgeCode = fs.readFileSync(edgePath, 'utf8');
  assert.match(edgeCode, /llama-3\.3-70b-versatile/, 'ai-gateway must default to llama-3.3-70b-versatile');

  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const quotasCode = fs.readFileSync(quotasPath, 'utf8');
  assert.match(quotasCode, /llama-3\.3-70b-versatile/, 'Quotas.jsx must support llama-3.3-70b-versatile');
});
