import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAsyncResultGate } from '../../src/ui/panel/async-result-gate.js';

const gate = createAsyncResultGate();

const firstOrderRequest = gate.begin();
assert.equal(gate.isCurrent(firstOrderRequest), true, 'AI result is valid while its order is active');

gate.invalidate(); // order was submitted and a tracking code was received
assert.equal(gate.isCurrent(firstOrderRequest), false,
  'Late AI result must be rejected after the submitted order clears the panel');

const secondOrderRequest = gate.begin();
assert.equal(gate.isCurrent(secondOrderRequest), true, 'A new order gets a new active request token');
assert.equal(gate.isCurrent(firstOrderRequest), false, 'The previous order can never become current again');

const panelSource = readFileSync(new URL('../../src/ui/panel/App.jsx', import.meta.url), 'utf8');
assert.match(panelSource, /handleClearOrderEvent[\s\S]{0,180}asyncResultGate\.current\.invalidate\(\)/,
  'Submitting/clearing an order must invalidate its pending AI result');
assert.match(panelSource, /async \(response\) => \{\s*if \(!asyncResultGate\.current\.isCurrent\(requestToken\)\) return;/,
  'AI callback must reject a response that belongs to an inactive order');
assert.match(panelSource, /handleParseImage[\s\S]*?const requestToken = asyncResultGate\.current\.begin\(\)/,
  'Image AI must use the same late-result guard');

console.log('Panel late AI result regression test passed.');
