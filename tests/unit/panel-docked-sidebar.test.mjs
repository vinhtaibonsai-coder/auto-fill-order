import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const panelJs = readSource('frontend/panel/panel.js');
const panelCss = readSource('frontend/panel/styling/styles.js');
const runtime = readSource('src/runtime/content/index.js');

for (const key of ['panel_display_mode', 'panel_dock_collapsed', 'panel_float_position']) {
  assert.match(panelJs, new RegExp(key), `Panel must persist ${key} in local storage`);
}

for (const id of ['vnpost-btn-dock-toggle', 'vnpost-dock-toggle-tab']) {
  assert.match(panelJs, new RegExp(id), `Panel JS must create/control ${id}`);
  assert.match(panelCss, new RegExp(`#${id}`), `Panel CSS must style ${id}`);
}

assert.match(panelJs, /dock:\s*`<svg/, 'Panel icons must include a dock icon');
assert.match(panelJs, /float:\s*`<svg/, 'Panel icons must include a floating icon');
assert.match(panelJs, /const PANEL_DOCK_WIDTH_PX = 340/, 'Docked panel width must stay compact enough for carrier pages');
assert.match(panelJs, /function applyPanelDisplayMode/, 'Panel must centralize dock/floating state updates');
assert.match(panelJs, /function setPageDockOffset/, 'Docked panel must offset the host page instead of covering carrier forms');
assert.match(panelJs, /body\.style\.paddingRight/, 'Docked panel must reserve page space using body padding');
assert.match(panelJs, /panel\.classList\.contains\('panel-floating'\)/, 'Drag behavior must be limited to floating mode');
assert.match(panelJs, /panel\.classList\.contains\('panel-docked'\)/, 'Minimize behavior must detect docked mode');
assert.match(panelJs, /panelStorage\.set\(\{\s*panel_float_position/s, 'Drag end must save floating panel position');

for (const selector of ['#vnpost-autofill-panel.panel-docked', '#vnpost-autofill-panel.panel-docked.collapsed', '#vnpost-autofill-panel.panel-floating']) {
  assert.match(panelCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Panel CSS must include ${selector}`);
}

assert.match(panelCss, /translateX\(100%\)/, 'Collapsed docked panel must slide fully to the right');
assert.match(panelCss, /width:\s*340px !important/, 'Docked panel CSS width must match the reserved page offset');
assert.match(panelCss, /cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/, 'Docked transitions must use smooth easing');
assert.match(panelCss, /#vnpost-btn-minimize,\s*#vnpost-btn-settings,\s*#vnpost-btn-theme,\s*#vnpost-btn-dock-toggle/, 'Dock toggle button must share header button styling');

assert.match(panelJs, /Gợi ý tham khảo để đối chiếu/, 'Address card must show a compact reference section');
assert.match(panelJs, /id="rev-suggest-clean"/, 'Address card must show the full 3-level suggestion');
assert.match(panelJs, /id="rev-suggest-2level"/, 'Address card must show the new 2-level suggestion');
assert.doesNotMatch(panelJs, /id="rev-suggest-(?:clean|2level)" style="display:none;"/, 'Address suggestions must remain visible for verification');
assert.match(panelCss, /\.address-reference-option/, 'Address reference options must have compact interactive styling');
assert.match(runtime, /refreshAddressSuggestion\(value, globalThis\.parsedDataStore\.phone\)/, 'Editing an address must re-run address normalization');
assert.match(runtime, /Đang bóc tách\.\.\./, 'Address reprocessing must expose its loading state');
assert.match(runtime, /Đã bóc tách lại/, 'Address reprocessing must expose its completed state');

for (const id of ['panel-shop-name', 'panel-user-account', 'panel-carrier-account']) {
  assert.match(panelJs, new RegExp(`id="${id}"`), `System header must render ${id}`);
}
assert.doesNotMatch(panelJs, /id="panel-carrier-name"/, 'System header must not duplicate the carrier already shown in the main title');
assert.match(panelJs, /Chưa chọn Shop/, 'System header must keep a visible Shop fallback');
assert.match(panelJs, /Chưa xác định tài khoản/, 'System header must keep a visible signed-in account fallback');
assert.match(panelJs, /Tài khoản đang đăng nhập Extension/, 'System header must use the signed-in Extension account');
assert.match(panelJs, /Tài khoản bưu điện đang đăng nhập trên trang hãng/, 'System header must retain the carrier-site account');
assert.match(panelCss, /\.panel-context-strip/, 'System header context strip must have compact responsive styling');
assert.match(panelCss, /\.panel-context-row/, 'System header must use readable key-value rows');
assert.doesNotMatch(panelCss, /\.panel-context-pill/, 'System header must not use cramped context cards/pills');

for (const id of ['source-order-card', 'source-expanded-content', 'source-collapsed-preview', 'btn-edit-source', 'source-dirty-message']) {
  assert.match(panelJs, new RegExp(`id="${id}"`), `Source order card must render ${id}`);
}
assert.match(panelJs, /aria-expanded="true"/, 'Source order card must expose its initial expanded state');
assert.match(panelJs, /const collapseSourceCard/, 'Panel must centralize source-card collapse behavior');
assert.match(panelJs, /const expandSourceCard/, 'Panel must centralize source-card expansion behavior');
assert.match(panelJs, /sourceHasParsedData\) setSourceDirty\(true\)/, 'Editing parsed source text must mark results as stale');
assert.match(panelJs, /Bóc tách lại/, 'Dirty source state must offer re-parsing');
assert.match(panelJs, /document\.addEventListener\('pointerdown'/, 'Clicking outside an expanded source card must be handled');
assert.match(panelJs, /if \(!sourceIsDirty\) \{\s*collapseSourceCard\(lastSourcePreviewData\)/s, 'Unchanged source must collapse without re-parsing');
assert.match(panelJs, /await onParseHandler\(\)/, 'Edited source must automatically re-parse when clicking outside');
assert.match(runtime, /globalThis\.collapseSourceOrderCard\(globalThis\.parsedDataStore \|\| localResult\)/, 'Successful parsing must collapse the source card');
assert.match(runtime, /globalThis\.resetSourceOrderCard\(\)/, 'Clearing an order must reset and expand the source card');
assert.match(panelCss, /\.source-collapsed-preview/, 'Collapsed source preview must have interactive styling');

console.log('Panel docked sidebar tests passed.');
