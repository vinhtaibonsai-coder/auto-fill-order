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

assert.match(overview, /submitted_at=gte/, 'Overview must filter submitted_orders by submitted_at, not created_at');
assert.match(overview, /fetchRowsAny/, 'Overview recent rows must support schema fallback');
assert.match(overview, /select=id,order_code,name,phone,address,cod_amount,platform,status,created_at/, 'Overview must support baseline orders.name schema');
assert.match(overview, /select=id,order_code,tracking_code,name,phone,address,cod_amount,platform,status,submitted_at/, 'Overview must support baseline submitted_orders.name schema');
assert.match(overview, /r\.name \|\| r\.customer_name/, 'Overview must render either name or customer_name');

assert.match(ai, /const getActiveShopId = async/, 'AI Settings must normalize active shop object/string before URL usage');
assert.match(ai, /String\(activeShop\.id \|\| activeShop\)/, 'AI Settings must avoid shop_id=eq.[object Object]');

console.log('Options submitted orders tests passed.');
