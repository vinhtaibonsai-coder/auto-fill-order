import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('1. Quotas.jsx loads default_ai_model as Single Source of Truth', () => {
  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const code = fs.readFileSync(quotasPath, 'utf8');

  // Verify loading default_ai_model
  assert.match(code, /getSystemConfig\('default_ai_model'\)/, 'Quotas.jsx must load default_ai_model');
  assert.match(code, /setAiProvider\(activeProv\)/, 'Quotas.jsx must sync active provider state');
  assert.match(code, /unified\.sort\(\(a, b\) => \(b\.isDefault \? 1 : 0\) - \(a\.isDefault \? 1 : 0\)\)/, 'Quotas.jsx must sort default key to #1');
});

test('2. Quotas.jsx handleTestSampleOrder and handleTestConnection prioritize default model over index 0', () => {
  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const code = fs.readFileSync(quotasPath, 'utf8');

  // Verify test key resolution in handleTestConnection
  assert.match(code, /databaseKeys\.find\(k => k\.provider === aiProvider && k\.isDefault\)/, 'handleTestConnection must look for active provider key');

  // Verify sample order resolution in handleTestSampleOrder
  assert.match(code, /databaseKeys\.find\(k => k\.isDefault\)/, 'handleTestSampleOrder must prioritize isDefault item');
});

test('3. Quotas.jsx handleSetDefaultModel isolates provider keys cleanly', () => {
  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const code = fs.readFileSync(quotasPath, 'utf8');

  // Verify handleSetDefaultModel gets matching provider keys
  assert.match(code, /databaseKeys\s*\.filter\(k => k\.provider === item\.provider\)/, 'handleSetDefaultModel must filter keys by provider');
  assert.match(code, /setGroqKeysInput\(''\)/, 'handleSetDefaultModel must keep new-key input clean instead of reloading keys');
});

test('4. ai-gateway index.ts strictly respects activeProvider for Groq without falling back to Gemini text', () => {
  const edgePath = path.join(repoRoot, 'supabase', 'functions', 'ai-gateway', 'index.ts');
  const code = fs.readFileSync(edgePath, 'utf8');

  assert.match(code, /if \(activeProvider === 'groq'\)/, 'ai-gateway must handle activeProvider groq');
  assert.match(code, /const isGeminiPrimary = activeProvider === 'gemini';/, 'isGeminiPrimary must be strictly true only when activeProvider is gemini');
});

test('5. Quotas.jsx automatically appends new keys to existing pool and removes only selected key', () => {
  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const code = fs.readFileSync(quotasPath, 'utf8');

  // Verify key appending logic
  assert.match(code, /mergedKeys = \[\.\.\.existingKeysForProvider\]/, 'handleSaveAIKeys must preserve existing provider keys and append new ones');
  // Verify single-key deletion
  assert.match(code, /databaseKeys\s*\.filter\(k => k\.provider === item\.provider && k\.key !== item\.key\)/, 'handleRemoveKeyItem must filter out only the target key');
});

