import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'src/ui/index/App.jsx'), 'utf8');
assert.match(source, /const num = new Intl\.NumberFormat\('vi-VN'\)/, 'Workspace must define the Vietnamese number formatter');
assert.doesNotMatch(source, /\{num\(/, 'Intl.NumberFormat is an object and must not be invoked as a function');
assert.match(source, /num\.format\(orderStats\.orders_today\)/, 'Workspace KPI must format the order count through NumberFormat.format');
console.log('Workspace number formatter regression test passed.');
