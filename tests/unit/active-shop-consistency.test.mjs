import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const shopService = read('src/domain/shop/shop.service.js');
assert.match(shopService, /_sortShopsForDefault\(shops\)/, 'Shop sync must define deterministic default sorting');
assert.match(shopService, /order=created_at\.asc,id\.asc/, 'Shop owner/admin queries must request deterministic order');
assert.match(shopService, /const cloudShops = this\._sortShopsForDefault\(Array\.from\(shopMap\.values\(\)\)\)/, 'Cloud shops must be sorted before picking a default');
assert.match(shopService, /await OrderStorage\.setActiveShop\(localShops\[0\]\.id\)/, 'Cloud sync must converge local active shop to canonical default');
assert.match(shopService, /AuthSession\.updateActiveShop\(localShops\[0\]\.id\)/, 'Cloud sync must update session active_shop_id');

const storage = read('src/application/storage.js');
assert.match(storage, /AuthSession\.updateActiveShop\(String\(shopId\)\)/, 'Changing active shop must keep AuthSession aligned');

const authService = read('src/domain/auth/auth.service.js');
assert.match(authService, /shops\?owner_id=eq\.\$\{userId\}&select=\*&order=created_at\.asc,id\.asc&limit=1/, 'RBAC fallback owner shop lookup must be deterministic');
assert.match(authService, /shop_members\?user_id=eq\.\$\{userId\}&select=role,shops\(\*\)&order=created_at\.asc&limit=1/, 'RBAC fallback member shop lookup must be deterministic');

const optionsEntry = read('src/ui/options/index.jsx');
assert.match(optionsEntry, /domain\/shop\/shop\.service\.js/, 'Options entry must load ShopService before App init');

const optionsApp = read('src/ui/options/App.jsx');
assert.match(optionsApp, /globalThis\.ShopService\.syncShopsFromCloud\(\)/, 'Options init must sync cloud shops for existing sessions');

console.log('Active shop consistency contracts verified.');
