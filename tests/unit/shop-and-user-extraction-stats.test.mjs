import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('1. Migration v106 defines shop & user order stats and get_shop_360_stats RPC', () => {
  const v106Path = path.join(repoRoot, 'database', 'migrations', 'v106_shop_and_user_order_stats.sql');
  assert.ok(fs.existsSync(v106Path), 'v106_shop_and_user_order_stats.sql must exist');
  const sql = fs.readFileSync(v106Path, 'utf8');

  assert.match(sql, /FUNCTION public\.get_ai_models_usage_stats/, 'Must update get_ai_models_usage_stats RPC');
  assert.match(sql, /'total_calls', total_count/, 'Must return total_calls');
  assert.match(sql, /'total_requests', total_count/, 'Must return total_requests');
  assert.match(sql, /FUNCTION public\.get_admin_shops_list/, 'Must update get_admin_shops_list RPC');
  assert.match(sql, /ai_used_today/, 'Must return ai_used_today in shops list');
  assert.match(sql, /orders_count/, 'Must return orders_count in shops list');
  assert.match(sql, /FUNCTION public\.get_admin_users_list/, 'Must update get_admin_users_list RPC');
  assert.match(sql, /FUNCTION public\.get_shop_360_stats/, 'Must create get_shop_360_stats RPC');
});

test('2. AdminRepository & AdminService support usage stats & Shop 360 data', () => {
  const repoPath = path.join(repoRoot, 'src', 'domain', 'admin', 'admin.repository.js');
  const repoCode = fs.readFileSync(repoPath, 'utf8');

  assert.match(repoCode, /static async getShop360Data\(shopId\)/, 'AdminRepository must define getShop360Data');
  assert.match(repoCode, /static async getUsersExtractionStats\(\)/, 'AdminRepository must define getUsersExtractionStats');
  assert.match(repoCode, /total_calls:\s*Number\(r\.total_calls\s*\?\?\s*r\.total_requests/, 'getAiModelsUsageStats must map both total_calls and total_requests');

  const svcPath = path.join(repoRoot, 'src', 'domain', 'admin', 'admin.service.js');
  const svcCode = fs.readFileSync(svcPath, 'utf8');
  assert.match(svcCode, /static async getShop360Data\(shopId\)/, 'AdminService must expose getShop360Data');
});

test('3. Quotas.jsx usage stats calculation is robust against key variations', () => {
  const quotasPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'AIPlatform', 'Quotas.jsx');
  const code = fs.readFileSync(quotasPath, 'utf8');

  assert.match(code, /calls:\s*Number\(s\.total_calls\s*\?\?\s*s\.total_requests\s*\?\?\s*s\.calls\s*\?\?\s*0\)/, 'getUsageForModelOrProvider must check both total_calls and total_requests');
  assert.match(code, /📊 Số Lần Đã Dùng/, 'Must have table column header for Số Lần Đã Dùng');
  assert.match(code, /usage\.calls\.toLocaleString\(\)/, 'Must render calls count in table');
});

test('4. Users.jsx displays employee order extraction & AI usage statistics', () => {
  const usersPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'Users', 'Users.jsx');
  const code = fs.readFileSync(usersPath, 'utf8');

  assert.match(code, /📊 Đã Bóc Tách \(Đơn \/ AI\)/, 'Users.jsx table header must have extraction & AI column');
  assert.match(code, /u\.orders_count/, 'Users.jsx must display orders_count for each user');
  assert.match(code, /u\.ai_usage_count/, 'Users.jsx must display ai_usage_count for each user');
  assert.match(code, /TỔNG ĐƠN BÓC TÁCH/, 'Users.jsx must have total orders extracted stat card');
});

test('5. Shop360Modal & ShopList display actual AI quota used and extracted orders count', () => {
  const modalPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'modals', 'Shop360Modal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.match(modalCode, /AdminService\.getShop360Data\(shop\.id\)/, 'Shop360Modal must load data via AdminService.getShop360Data');
  assert.doesNotMatch(modalCode, /apikey:\s*configRes\.anonKey/, 'Shop360Modal must not use raw unauthenticated anonKey to fetch orders');
  assert.match(modalCode, /aiQuota\.used/, 'Shop360Modal must display real aiQuota.used');

  const listPath = path.join(repoRoot, 'src', 'ui', 'admin-dashboard', 'pages', 'Shops', 'ShopList.jsx');
  const listCode = fs.readFileSync(listPath, 'utf8');
  assert.match(listCode, /⚡ AI Quota & Bóc Tách/, 'ShopList.jsx must have AI Quota & Bóc Tách column header');
  assert.match(listCode, /shop\.ai_used_today/, 'ShopList.jsx must display shop.ai_used_today');
  assert.match(listCode, /shop\.orders_count/, 'ShopList.jsx must display shop.orders_count');
});
