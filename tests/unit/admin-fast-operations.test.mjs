import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const file of ['Pagination.jsx','FilterBar.jsx','ExportButton.jsx','FastOperationsHub.jsx','ImpersonationBanner.jsx','QuotaOverview.jsx'])assert.ok(fs.existsSync(path.join(root,'src/ui/admin-dashboard/components',file)),`Missing ${file}`);
for(const file of ['CreateShopModal.jsx','TopupQuotaModal.jsx','InviteAdminModal.jsx','EditUserRoleModal.jsx','OverrideSubscriptionModal.jsx','PublishReleaseModal.jsx','TicketDetailModal.jsx'])assert.ok(fs.existsSync(path.join(root,'src/ui/admin-dashboard/modals',file)),`Missing ${file}`);
const migration=read('database/migrations/v66_admin_fast_operations.sql');
for(const rpc of ['admin_topup_shop_quota','admin_transfer_shop_ownership','admin_create_admin_account','admin_override_subscription','admin_revoke_shop_devices','admin_reply_support_ticket','admin_publish_release','admin_record_carrier_probe']){assert.match(migration,new RegExp(`FUNCTION public\\.${rpc}`));}
assert.match(migration,/IF NOT public\.is_system_admin\(\)/);
assert.match(read('src/ui/admin-dashboard/components/FilterBar.jsx'),/300/);
assert.match(read('src/ui/admin-dashboard/components/ExportButton.jsx'),/\\uFEFF/);
assert.match(read('src/ui/admin-dashboard/App.jsx'),/FastOperationsHub/);
assert.match(read('src/ui/admin-dashboard/pages/Shops/ShopList.jsx'),/startImpersonation/);
console.log('Admin Fast Operations Hub tests passed.');
