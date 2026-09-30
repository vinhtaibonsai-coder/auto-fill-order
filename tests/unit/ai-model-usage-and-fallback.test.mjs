import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('1. Migration v105 defines model column and get_ai_models_usage_stats RPC', () => {
  const v105Path = path.join(repoRoot, 'database', 'migrations', 'v105_ai_model_usage_and_fallback.sql');
  assert.ok(fs.existsSync(v105Path), 'v105_ai_model_usage_and_fallback.sql must exist');
  const sql = fs.readFileSync(v105Path, 'utf8');

  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS model TEXT;/, 'Must add model column to ai_usage_log');
  assert.match(sql, /idx_ai_usage_model_created/, 'Must create index on model and created_at');
  assert.match(sql, /FUNCTION public\.get_ai_models_usage_stats/, 'Must create get_ai_models_usage_stats RPC');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_ai_models_usage_stats/, 'Must grant execute permission on RPC');

  const runAllPath = path.join(repoRoot, 'database', 'migrations', 'RUN_ALL_MIGRATIONS.sql');
  const runAllSql = fs.readFileSync(runAllPath, 'utf8');
  assert.match(runAllSql, /v105_ai_model_usage_and_fallback\.sql/, 'RUN_ALL_MIGRATIONS must include v105');
});

test('2. AI Gateway edge function logs model and implements cross-provider fallback', () => {
  const edgeFuncPath = path.join(repoRoot, 'supabase', 'functions', 'ai-gateway', 'index.ts');
  assert.ok(fs.existsSync(edgeFuncPath), 'ai-gateway/index.ts must exist');
  const code = fs.readFileSync(edgeFuncPath, 'utf8');

  // Kiểm tra lưu model vào ai_usage_log
  assert.match(code, /model:\s*actualModel/, 'AI Gateway must record actualModel in ai_usage_log');

  // Kiểm tra cơ chế Smart Fallback
  assert.match(code, /fallbackModel/, 'AI Gateway must define fallbackModel');
  assert.match(code, /fallback_used:\s*usedFallback/, 'AI Gateway must report fallback_used');
  assert.match(code, /gemini-3\.6-flash/, 'AI Gateway must support gemini-3.6-flash');
  assert.match(code, /llama-3\.1-8b-instant/, 'AI Gateway must support llama-3.1-8b-instant fallback');
});

test('3. AdminRepository exposes getAiModelsUsageStats with resilience fallback', () => {
  const repoPath = path.join(repoRoot, 'src', 'domain', 'admin', 'admin.repository.js');
  const code = fs.readFileSync(repoPath, 'utf8');

  assert.match(code, /static async getAiModelsUsageStats\(shopId = null\)/, 'AdminRepository must define getAiModelsUsageStats');
  assert.match(code, /get_ai_models_usage_stats/, 'Must call get_ai_models_usage_stats RPC');
  assert.match(code, /ai_usage_log\?select=model,input_tokens,output_tokens,created_at/, 'Must have direct fallback query to ai_usage_log');
});

test('4. Quotas.jsx supports full API key toggle, usage stats, default model selector, and fallback banner', () => {
  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const code = fs.readFileSync(quotasPath, 'utf8');

  // Hiển thị toàn bộ Apikey hoặc Mask toggle
  assert.match(code, /showFullKeys/, 'Quotas.jsx must have showFullKeys state');
  assert.match(code, /Hiển Thị Toàn Bộ API Key/, 'Quotas.jsx must offer toggle to unmask full keys');
  assert.match(code, /Che Bớt Key \(Mask\)/, 'Quotas.jsx must offer toggle to mask keys');
  assert.match(code, /copyKeyToClipboard/, 'Quotas.jsx must have copyKeyToClipboard function');

  // Báo số lượng đã dùng
  assert.match(code, /modelUsageStats/, 'Quotas.jsx must have modelUsageStats state');
  assert.match(code, /getUsageForModelOrProvider/, 'Quotas.jsx must calculate usage for each model');
  assert.match(code, /Số Lần Đã Dùng/, 'Quotas.jsx must display usage count column');

  // Chọn model làm mặc định
  assert.match(code, /handleSetDefaultModel/, 'Quotas.jsx must allow setting default model');
  assert.match(code, /⭐ Đặt Mặc Định/, 'Quotas.jsx must have set default button');
  assert.match(code, /🥇 Mặc Định Hệ Thống/, 'Quotas.jsx must display primary default badge');

  // Chuỗi dự phòng thông minh (Fallback banner)
  assert.match(code, /Smart Cross-Provider Fallback/, 'Quotas.jsx must explain smart cross-provider fallback');
  assert.match(code, /DỰ PHÒNG 1/, 'Quotas.jsx must show fallback 1 in chain');
  assert.match(code, /DỰ PHÒNG 2/, 'Quotas.jsx must show fallback 2 in chain');
});

test('5. VNPost default weight resolution does not force 500g and respects carrier defaults', () => {
  const profilePath = path.join(repoRoot, 'src', 'ui', 'options', 'pages', 'General', 'ShopProfile.jsx');
  const profileCode = fs.readFileSync(profilePath, 'utf8');
  assert.doesNotMatch(profileCode, /default_package_weight:\s*Number\(row\.default_package_weight\s*\|\|\s*500\)/, 'ShopProfile must not hardcode 500g fallback');

  const vnpostPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'vnpost', 'autofill.js');
  const vnpostCode = fs.readFileSync(vnpostPath, 'utf8');
  // Order default settings must be checked before pkgStored
  const storedIdx = vnpostCode.indexOf("chrome.storage.local.get(['order_default_settings'");
  const pkgIdx = vnpostCode.indexOf("chrome.storage.local.get(['default_package_weight'");
  assert.ok(storedIdx !== -1 && pkgIdx !== -1 && storedIdx < pkgIdx, 'VNPost autofill must prioritize order_default_settings over pkgStored');
});
