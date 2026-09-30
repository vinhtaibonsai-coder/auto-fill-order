import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const databaseManager = read('src/ui/options/pages/Database/DatabaseManager.jsx');
assert.match(databaseManager, /const hasChromeStorage = \(\) =>/);
assert.match(databaseManager, /chrome\.storage\.local\.getBytesInUse/);
assert.match(databaseManager, /localStorage\.removeItem\(savedKey\)/);
assert.match(databaseManager, /localStorage\.removeItem\(submittedKey\)/);

const subscription = read('src/ui/options/pages/Subscription/Subscription.jsx');
assert.match(subscription, /const asNumber = value =>/);
assert.match(subscription, /const fmtNumber = value =>/);
assert.match(subscription, /monthlyLimit - monthlyUsed/);
assert.match(subscription, /fmtNumber\(budget\.monthly_remaining\)/);
assert.doesNotMatch(subscription, /budget\.monthly_remaining\.toLocaleString\(\)/);

const aiSettings = read('src/ui/options/pages/AISettings/AISettings.jsx');
assert.match(aiSettings, /const saveLocalAiConfig = \(payload\)/);
assert.match(aiSettings, /localStorage\.setItem\(key, JSON\.stringify\(value\)\)/);
assert.match(aiSettings, /enable_get_ai_budget_rpc/);
assert.match(aiSettings, /shop_quotas\?shop_id=eq\.\$\{activeShopId\}&select=ai_monthly_limit,ai_monthly_used,ai_daily_limit,ai_daily_used/);
assert.match(aiSettings, /shouldUseAiBudgetRpc\(\) && token && activeShopId/);

const team = read('src/ui/options/pages/Team/Team.jsx');
assert.match(team, /rpc\/owner_get_members_v3/);
assert.match(team, /owner_revoke_device/, 'Team must use audited device revocation');
assert.match(team, /shop_members\?shop_id=eq\.\$\{sess\.active_shop_id\}&removed_at=is\.null/);
assert.match(team, /const \[shopQuota, setShopQuota\] = useState\(\{ max_devices: 5, max_users: 1 \}\)/, 'Team must render with a safe quota default');
assert.match(team, /const \[subscription, setSubscription\] = useState\(\{ plan_tier: 'FREE', status: 'active' \}\)/, 'Team must render with a safe subscription default');
assert.match(team, /shop_quotas\?shop_id=eq\.\$\{shopId\}&select=max_devices/, 'Quota lookup must only request the stable max_devices column');
assert.doesNotMatch(team, /shop_quotas\?[^`]*select=max_devices,max_users/, 'Quota lookup must not require the optional max_users column');
assert.match(team, /subscriptions\?shop_id=eq\.\$\{shopId\}&select=\*/, 'Subscription lookup must tolerate plan_code and plan_tier schemas');
assert.match(team, /plan_tier: row\.plan_tier \|\| row\.plan_code \|\| 'FREE'/, 'Subscription records must be normalized before rendering');
assert.match(team, /shop_members\?shop_id=eq\.\$\{sess\.active_shop_id\}&select=id,user_id,role,status,created_at/, 'Member lookup must retry without removed_at for older schemas');

console.log('Options graceful fallback contracts verified.');
