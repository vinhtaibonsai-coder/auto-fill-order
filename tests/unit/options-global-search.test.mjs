import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const app = readSource('src/ui/options/App.jsx');
const topHeader = readSource('src/ui/options/components/TopHeader.jsx');
const submitted = readSource('src/ui/options/pages/Orders/SubmittedOrders.jsx');
const customerHub = readSource('src/ui/options/pages/Customers/CustomerHub.jsx');
const orderList = readSource('src/ui/options/pages/Workspace/OrderList.jsx');
const shopList = readSource('src/ui/admin-dashboard/pages/Shops/ShopList.jsx');
const styles = readSource('src/ui/options/options-styles.css');

// 1. App.jsx global search wiring
assert.match(app, /globalSearch/, 'App.jsx must manage globalSearch state');
assert.match(app, /handleGlobalSearch/, 'App.jsx must define handleGlobalSearch');
assert.match(app, /handleNavigateWithSearch/, 'App.jsx must define handleNavigateWithSearch');
assert.match(app, /options:search/, 'App.jsx must dispatch options:search event');
assert.match(app, /onNavigate={handleNavigateWithSearch}/, 'App.jsx must wire onNavigate to TopHeader');
assert.match(app, /onSearch={handleGlobalSearch}/, 'App.jsx must wire onSearch to TopHeader');

// 2. TopHeader.jsx interactive dropdown & tone normalization
assert.match(topHeader, /removeVietnameseTones/, 'TopHeader must include removeVietnameseTones for accent-insensitive search');
assert.match(topHeader, /search-dropdown-menu/, 'TopHeader must render interactive live search dropdown popover');
assert.match(topHeader, /handleSelectOrder/, 'TopHeader must handle clicking an individual order from results');
assert.match(topHeader, /handleSelectCustomer/, 'TopHeader must handle clicking an individual customer from results');
assert.match(topHeader, /onKeyDown/, 'TopHeader must handle Enter/Escape keyboard navigation');
assert.match(topHeader, /OrderStorage/, 'TopHeader must query local orders via OrderStorage');

// 3. Child views reactive search synchronization & Vietnamese diacritics
assert.match(submitted, /window\.__af_global_search/, 'SubmittedOrders must initialize from window.__af_global_search');
assert.match(submitted, /options:search/, 'SubmittedOrders must react to options:search event');

assert.match(customerHub, /window\.__af_global_search/, 'CustomerHub must initialize from window.__af_global_search');
assert.match(customerHub, /removeVietnameseTones/, 'CustomerHub must support accent-insensitive search');
assert.match(customerHub, /options:search/, 'CustomerHub must react to options:search event');

assert.match(orderList, /window\.__af_global_search/, 'OrderList must initialize from window.__af_global_search');
assert.match(orderList, /removeVietnameseTones/, 'OrderList must support accent-insensitive search');
assert.match(orderList, /options:search/, 'OrderList must react to options:search event');

assert.match(shopList, /removeVietnameseTones/, 'Admin ShopList must support accent-insensitive shop search');

// 4. CSS styling
assert.match(styles, /\.search-dropdown-menu/, 'options-styles.css must contain .search-dropdown-menu rules');
assert.match(styles, /\.search-result-item/, 'options-styles.css must contain .search-result-item rules');

console.log('✅ All Options & Admin global search tests passed successfully!');
