import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const app = readSource('src/ui/options/App.jsx');
const submitted = readSource('src/ui/options/pages/Orders/SubmittedOrders.jsx');
const overview = readSource('src/ui/options/pages/Overview/Overview.jsx');
const ai = readSource('src/ui/options/pages/AISettings/AISettings.jsx');

assert.match(app, /SubmittedOrders/, 'Options app must import submitted orders view');
assert.match(app, /activeTab === 'submitted-orders'/, 'Options sidebar must expose submitted orders route');
assert.match(app, /return <SubmittedOrders \/>/, 'Submitted orders route must render the view');

assert.match(submitted, /OrderStorage\.getSubmittedOrders/, 'Submitted orders view must load via local-first storage');
assert.doesNotMatch(submitted, /deleteSubmittedOrder|handleDelete|Xóa/, 'Submitted orders view must be read-only in Options');
assert.match(submitted, /trackingCode|tracking_code/, 'Submitted orders view must show tracking codes');
assert.match(submitted, /Làm mới/, 'Submitted orders view must expose refresh');
assert.match(submitted, /normalize\('NFD'\)/, 'Submitted orders search must support Vietnamese text with or without diacritics');
assert.match(submitted, /datePreset/, 'Submitted orders view must expose date range presets');
assert.match(submitted, /carrierFilter/, 'Submitted orders view must filter by carrier');
assert.match(submitted, /feeFilter/, 'Submitted orders view must filter by shipping fee payer');
assert.match(submitted, /statusFilter/, 'Submitted orders view must filter by tracking status');
assert.match(submitted, /carrierAccount.*carrier_account/, 'Submitted orders view must support carrier account schema variants');
assert.match(submitted, /shipping_fee_payer.*collect_fee/, 'Submitted orders view must support fee payer schema variants');
assert.match(submitted, /navigator\.clipboard\.writeText/, 'Submitted orders view must support one-click copy');
assert.match(submitted, /jtexpress\.vn.*tracking.*billcode/, 'Submitted orders view must expose J&T direct tracking');
assert.match(submitted, /vnpost\.vn.*dinh-vi.*key=/, 'Submitted orders view must expose VNPost direct tracking');
assert.match(submitted, /text\/csv;charset=utf-8/, 'Submitted orders view must export UTF-8 CSV');
assert.match(submitted, /isCloud/, 'Submitted orders view must use storage provenance instead of guessing sync state');
assert.match(submitted, /Đã lên Cloud/, 'Submitted orders view must label cloud-synced orders');
assert.match(submitted, /Chỉ lưu Local/, 'Submitted orders view must label device-only orders');
assert.match(submitted, /Nguồn lưu trữ/, 'Submitted orders CSV must include storage provenance');

assert.match(overview, /submitted_at=gte/, 'Overview must filter submitted_orders by submitted_at, not created_at');
assert.match(overview, /fetchRowsAny/, 'Overview recent rows must support schema fallback');
assert.match(overview, /select=id,order_code,name,phone,address,cod_amount,platform,status,created_at/, 'Overview must support baseline orders.name schema');
assert.match(overview, /select=id,order_code,tracking_code,name,phone,address,cod_amount,platform,status,submitted_at/, 'Overview must support baseline submitted_orders.name schema');
assert.match(overview, /r\.name \|\| r\.customer_name/, 'Overview must render either name or customer_name');

assert.match(ai, /const getActiveShopId = async/, 'AI Settings must normalize active shop object/string before URL usage');
assert.match(ai, /String\(activeShop\.id \|\| activeShop\)/, 'AI Settings must avoid shop_id=eq.[object Object]');

console.log('Options submitted orders tests passed.');
