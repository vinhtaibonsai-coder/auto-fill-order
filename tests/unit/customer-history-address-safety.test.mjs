import assert from 'node:assert/strict'; import fs from 'node:fs';
const panel=fs.readFileSync('frontend/panel/panel.js','utf8'); const start=panel.indexOf('cloud.addresses.forEach'); const block=panel.slice(start,start+1600); assert.ok(start>0); assert.match(block,/addEventListener\('click'/); assert.match(block,/parsedDataStore\.address = value/);
console.log('Customer history address safety contracts passed.');
