import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

console.log('🧪 Running Panel Image Paste & Gemini Integration Tests...');

// 1. Kiểm tra panel.js
const panelJs = read('frontend/panel/panel.js');
assert.ok(panelJs.includes('id="panel-image-paste-preview"'), 'panel.js must contain panel-image-paste-preview container');
assert.ok(panelJs.includes('id="panel-pasted-img"'), 'panel.js must contain panel-pasted-img element');
assert.ok(panelJs.includes('id="btn-remove-pasted-img"'), 'panel.js must contain btn-remove-pasted-img button');
assert.ok(panelJs.includes("txtArea.addEventListener('paste'"), 'panel.js must handle paste event on txtArea');
assert.ok(panelJs.includes("txtArea.addEventListener(name"), 'panel.js must handle drag-and-drop events on txtArea');
assert.ok(panelJs.includes("action: 'runGeminiVision'"), 'panel.js must invoke runGeminiVision upon image paste');
assert.ok(panelJs.includes('clearPastedImagePreview();'), 'panel.js must clear image preview when resetting or clearing order');

// 2. Kiểm tra styles.js
const stylesJs = read('frontend/panel/styling/styles.js');
assert.ok(stylesJs.includes('.panel-image-paste-preview'), 'styles.js must contain .panel-image-paste-preview styles');
assert.ok(stylesJs.includes('#rawOrderText.is-dragover'), 'styles.js must contain .is-dragover styling for drag-and-drop');
assert.ok(stylesJs.includes('.btn-remove-pasted-img'), 'styles.js must contain .btn-remove-pasted-img button styling');
assert.ok(stylesJs.includes('#panel-pasted-img'), 'styles.js must style thumbnail #panel-pasted-img');

// 3. Kiểm tra Edge Function AI Gateway
const aiGatewayTs = read('supabase/functions/ai-gateway/index.ts');
assert.ok(aiGatewayTs.includes('gemini-2.0-flash'), 'ai-gateway must support gemini-2.0-flash');
assert.ok(aiGatewayTs.includes('gemini-1.5-flash'), 'ai-gateway must support gemini-1.5-flash');
assert.ok(aiGatewayTs.includes('isGeminiText'), 'ai-gateway must support Gemini text generation in Task 3');
assert.ok(aiGatewayTs.includes('responseMimeType: \'application/json\''), 'ai-gateway must request JSON response format from Gemini');

// 4. Kiểm tra Admin Dashboard Quotas.jsx
const quotasJsx = read('src/ui/admin-dashboard/pages/AIPlatform/Quotas.jsx');
assert.ok(quotasJsx.includes('gemini-2.0-flash'), 'Quotas.jsx must offer gemini-2.0-flash');
assert.ok(quotasJsx.includes('https://aistudio.google.com/app/apikey'), 'Quotas.jsx must link to Google AI Studio for free Gemini key');
assert.ok(quotasJsx.includes('gemini_api_key'), 'Quotas.jsx must sync gemini_api_key config');

// 5. Kiểm tra Options AISettings.jsx
const aiSettingsJsx = read('src/ui/options/pages/AISettings/AISettings.jsx');
assert.ok(aiSettingsJsx.includes('Google Gemini 2.0 / 1.5 Flash'), 'AISettings.jsx must display Gemini 2.0 / 1.5 Flash banner');
assert.ok(aiSettingsJsx.includes('admin.html#/ai-platform'), 'AISettings.jsx must guide user to admin dashboard for full shop key configuration');
assert.ok(aiSettingsJsx.includes('https://aistudio.google.com/app/apikey'), 'AISettings.jsx must link to Google AI Studio for API key');

console.log('✅ ALL PANEL IMAGE PASTE & GEMINI INTEGRATION TESTS PASSED 100%!');
