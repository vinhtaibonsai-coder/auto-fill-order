import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const optionsConfigFiles = [
  'frontend/options/options-config.js',
  'admin-dashboard/options-config.js'
];

for (const relPath of optionsConfigFiles) {
  const content = read(relPath);
  const checkStatusBody = content.match(/async function checkAiGatewayStatus\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(checkStatusBody.length > 0, `${relPath} must define checkAiGatewayStatus`);
  assert.match(checkStatusBody, /action:\s*'checkAiGatewayHealth'/, `${relPath} status check must use fast checkAiGatewayHealth`);
  assert.doesNotMatch(checkStatusBody, /action:\s*'runGroq'/, `${relPath} status check must NOT call runGroq/model path`);
}

const serviceWorker = read('src/runtime/service-worker/service-worker.js');
const aiGateway = read('supabase/functions/ai-gateway/index.ts');

assert.match(serviceWorker, /message\.action === 'checkAiGatewayHealth'/, 'Service worker must handle AI health-check action');
assert.match(serviceWorker, /_callAiGateway\('health'/, 'Service worker health-check must call the AI Gateway health task');

assert.match(aiGateway, /new Set\(\['health', 'parse'/, 'AI Gateway must allow the health task');
assert.ok(
  aiGateway.indexOf("if (task === 'health')") > 0 &&
    aiGateway.indexOf("if (task === 'health')") < aiGateway.indexOf("rpc('check_ai_rate_limit'"),
  'AI Gateway health task must return before rate-limit/quota/provider path',
);
assert.ok(
  aiGateway.indexOf("if (task === 'health')") < aiGateway.indexOf("rpc('consume_ai_quota'"),
  'AI Gateway health task must not consume AI quota',
);

console.log('AI Gateway health-check fast path contract OK (both frontend & admin-dashboard verified)');
