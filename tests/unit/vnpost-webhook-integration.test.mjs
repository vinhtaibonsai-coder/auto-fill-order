import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const webhookEdge = readSource('supabase/functions/vnpost-webhook/index.ts');
const carriers = readSource('src/ui/options/pages/Carriers/Carriers.jsx');
const submittedOrders = readSource('src/ui/options/pages/Orders/SubmittedOrders.jsx');
const supabaseClient = readSource('src/infrastructure/supabase/client.js');

// 1. Edge Function Verification
assert.match(webhookEdge, /headers\.get\(['"]x-vnpost-token['"]\)|url\.searchParams\.get\(['"]token['"]\)/, 'VNPost webhook edge function must parse token from header or query string');
assert.match(webhookEdge, /vnpost_api_token/, 'VNPost webhook edge function must verify token against shop_feature_flags');
assert.match(webhookEdge, /body\.ItemCode \|\| body\.itemCode/, 'Webhook must extract tracking codes from VNPost payloads');
assert.match(webhookEdge, /tracking_code: itemCode/, 'Webhook must update tracking_code to submitted_orders');
assert.match(webhookEdge, /webhook_logs: logsArr/, 'Webhook must append journey events to webhook_logs');

// 2. Carriers View Webhook Configuration & Testing Tool
assert.match(webhookEdge, /save_config/, 'Edge function must support save_config action');
assert.match(carriers, /action:\s*['"]save_config['"]/, 'Carriers view must call Edge Function save_config to bypass RLS');
assert.match(carriers, /vnpost_customer_code/, 'Carriers view must support VNPost customer code');
assert.match(carriers, /vnpost_api_token/, 'Carriers view must support VNPost webhook API secret token');
assert.match(carriers, /functions\/v1\/vnpost-webhook\?token=/, 'Carriers view must generate copyable webhook endpoint URL with secret token');
assert.match(carriers, /handleGenToken|Tạo mới/, 'Carriers view must allow generating a new secure random token');
assert.match(carriers, /Kiểm tra kết nối Webhook|Test Ping/, 'Carriers view must provide a test ping modal tool');
assert.match(carriers, /handleTestPing/, 'Carriers view must handle pinging the webhook endpoint directly');

// 3. Submitted Orders Webhook Integration & Timeline
assert.match(submittedOrders, /getDeliveryStatusMeta/, 'Submitted orders view must map delivery status metadata');
assert.match(submittedOrders, /deliveryFilter/, 'Submitted orders view must provide delivery status filtering');
assert.match(submittedOrders, /selectedJourneyOrder/, 'Submitted orders view must manage selected journey order state');
assert.match(submittedOrders, /Trạng thái giao & Webhook/, 'Submitted orders view must include a Webhook status column in table header');
assert.match(submittedOrders, /Lịch Sử Hành Trình Vận Đơn/, 'Submitted orders view must provide a journey timeline modal');
assert.match(submittedOrders, /stats\.deliveredCount/, 'Submitted orders view must compute delivered count stats');

// 4. Supabase Client Mapping
assert.match(supabaseClient, /actual_weight|actualWeight/, 'SupabaseClient.fetchSubmittedOrders must map actual weight');
assert.match(supabaseClient, /shipping_fee|shippingFee/, 'SupabaseClient.fetchSubmittedOrders must map shipping fee');
assert.match(supabaseClient, /webhook_logs|webhookLogs/, 'SupabaseClient.fetchSubmittedOrders must map webhook logs');

console.log('VNPost Webhook integration tests passed successfully.');
