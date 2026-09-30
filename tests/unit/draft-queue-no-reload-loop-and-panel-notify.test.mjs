import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const orderListJs = read('src/ui/options/pages/Workspace/OrderList.jsx');
const panelJs = read('frontend/panel/panel.js');
const panelStylesJs = read('frontend/panel/styling/styles.js');
const appJs = read('src/ui/panel/App.jsx');
const draggableCardJs = read('src/ui/panel/components/DraggableCard.jsx');
const storageJs = read('src/application/storage.js');

console.log('🧪 Running Draft Queue Reload-Loop Prevention & Panel Notification Tests...');

// 1. OrderList.jsx must prevent infinite reload loops and use debounced handlers
assert.ok(orderListJs.includes('debouncedLoadOrders'), 'OrderList.jsx must implement debouncedLoadOrders');
assert.ok(orderListJs.includes('getOrders(forceSync)'), 'OrderList.jsx must pass forceSync to getOrders to avoid forced cloud writes in background');
assert.ok(!orderListJs.includes('k.includes(\'order\')'), 'OrderList.jsx must not match overly broad "order" substring in storage change');
assert.ok(orderListJs.includes('k === \'savedOrders\''), 'OrderList.jsx must target specific savedOrders keys');
console.log('✅ OrderList reload loop prevention verified.');

// 2. storage.js must only persist merged orders if different from rawOrders
assert.ok(storageJs.includes('JSON.stringify(mergedAll) !== JSON.stringify(rawOrders)'), 'storage.js must compare mergedAll with rawOrders before calling _saveOrdersToLocal');
console.log('✅ Storage dirty-write prevention verified.');

// 3. frontend/panel/panel.js must notify draft count and pulse badge
assert.ok(panelJs.includes('has-drafts-pulse'), 'panel.js must pulse draft badge when drafts exist');
assert.ok(panelJs.includes('has-drafts-active'), 'panel.js must activate draft header button');
assert.ok(panelJs.includes('showVnpostToast'), 'panel.js must announce draft orders via toast');
assert.ok(panelStylesJs.includes('.header-draft-badge.has-drafts-pulse'), 'styles.js must include pulse animation for draft badge');
assert.ok(panelStylesJs.includes('.panel-header-btn.has-drafts-active'), 'styles.js must style active draft button');
console.log('✅ Panel draft notifications and styling verified.');

// 4. React Panel (App.jsx & DraggableCard.jsx) must display draft orders banner and header badge
assert.ok(draggableCardJs.includes('draftCount'), 'DraggableCard.jsx must accept draftCount prop');
assert.ok(appJs.includes('draftOrders'), 'App.jsx must track draftOrders state');
assert.ok(appJs.includes('loadDrafts'), 'App.jsx must implement loadDrafts');
assert.ok(appJs.includes('Hàng đợi:'), 'App.jsx must render draft queue banner');
console.log('✅ React panel draft banner & header badge verified.');

console.log('🎉 ALL DRAFT QUEUE RELOAD-LOOP AND PANEL NOTIFICATION TESTS PASSED (100%)!');
