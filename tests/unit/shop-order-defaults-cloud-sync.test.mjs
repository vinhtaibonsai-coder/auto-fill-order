import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('Migration v87 contains shop order defaults column and RPCs', () => {
  const migrationPath = path.join(repoRoot, 'database', 'migrations', 'v87_shop_order_defaults_cloud_sync.sql');
  assert.ok(fs.existsSync(migrationPath), 'v87 migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.match(content, /order_defaults\s+JSONB/i, 'Must add order_defaults column to shops');
  assert.match(content, /owner_update_shop_order_defaults/i, 'Must define owner_update_shop_order_defaults RPC');
  assert.match(content, /owner_get_shop_order_defaults/i, 'Must define owner_get_shop_order_defaults RPC');
  assert.match(content, /is_shop_owner_or_manager/i, 'Must verify owner/manager permissions');
});

test('OrderSettings page supports Cloud load/save and 2-way storage sync', () => {
  const settingsPath = path.join(repoRoot, 'src', 'ui', 'options', 'pages', 'General', 'OrderSettings.jsx');
  assert.ok(fs.existsSync(settingsPath), 'OrderSettings.jsx file must exist');

  const content = fs.readFileSync(settingsPath, 'utf8');
  assert.match(content, /owner_update_shop_order_defaults/i, 'Must call cloud update RPC');
  assert.match(content, /owner_get_shop_order_defaults/i, 'Must call cloud get RPC');
  assert.match(content, /order_default_settings/i, 'Must sync order_default_settings');
  assert.match(content, /default_goods_name/i, 'Must sync legacy default_goods_name');
  assert.match(content, /default_weight_vnpost/i, 'Must sync legacy default_weight_vnpost');
  assert.match(content, /default_weight_jt/i, 'Must sync legacy default_weight_jt');
});

test('Panel App.jsx reads order_default_settings and populates parsedDataStore', () => {
  const panelAppPath = path.join(repoRoot, 'src', 'ui', 'panel', 'App.jsx');
  const content = fs.readFileSync(panelAppPath, 'utf8');

  assert.match(content, /order_default_settings/i, 'Panel must read order_default_settings');
  assert.match(content, /defaultGoodsName:\s*defaultGoodsName/i, 'Panel must pass defaultGoodsName');
  assert.match(content, /defaultWeightVnpost:\s*defaults\.defaultWeightVnpost/i, 'Panel must pass defaultWeightVnpost');
  assert.match(content, /defaultWeightJt:\s*defaults\.defaultWeightJt/i, 'Panel must pass defaultWeightJt');
});

test('VNPostAdapter fallbacks to defaultGoodsName when orderCode is absent and uses gram weight', () => {
  const vnpostPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'vnpost', 'autofill.js');
  const content = fs.readFileSync(vnpostPath, 'utf8');

  assert.match(content, /defaultGoodsName/i, 'VNPostAdapter must reference defaultGoodsName');
  assert.match(content, /defaultWeightVnpost/i, 'VNPostAdapter must reference defaultWeightVnpost');
  assert.match(content, /orderCode\s*\?\s*\(?"Đơn hàng:\s*"\s*\+\s*orderCode\)?\s*:\s*defaultGoodsName/i, 'VNPostAdapter must fallback to defaultGoodsName when orderCode is empty');
  assert.match(content, /resolveVNPostDefaultWeight/i, 'VNPostAdapter must define resolveVNPostDefaultWeight');
  assert.match(content, /order_default_settings/i, 'VNPostAdapter must query order_default_settings');
  assert.match(content, /default_weight_vnpost/i, 'VNPostAdapter must query default_weight_vnpost');
});

test('JTAdapter fallbacks to defaultGoodsName when orderCode is absent and uses kg weight', () => {
  const jtPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'jt', 'autofill.js');
  const content = fs.readFileSync(jtPath, 'utf8');

  assert.match(content, /defaultGoodsName/i, 'JTAdapter must reference defaultGoodsName');
  assert.match(content, /defaultWeightJt/i, 'JTAdapter must reference defaultWeightJt');
  assert.match(content, /defaultWeightKg/i, 'JTAdapter must support defaultWeightKg from settings');
});
