import assert from 'node:assert/strict';
import { handleMcpRequest } from '../../mcp/order-tools/server.mjs';

console.log('🧪 Running MCP Order Tools Adapter Unit Tests...');

// 1. Test initialize
const initRes = await handleMcpRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {}
});
assert.equal(initRes.result.serverInfo.name, 'auto-fill-order-mcp');
assert.ok(initRes.result.capabilities.tools);

// 2. Test tools/list
const listRes = await handleMcpRequest({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list'
});
const tools = listRes.result.tools;
assert.equal(tools.length, 2, 'Must expose exactly 2 deep tools');
assert.equal(tools[0].name, 'order_parse_text');
assert.equal(tools[1].name, 'address_normalize');

// 3. Test tools/call: order_parse_text
const callOrderRes = await handleMcpRequest({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'order_parse_text',
    arguments: {
      raw_text: 'Trần Văn B 0977889900 Số 10 Mai Hắc Đế, Bùi Thị Xuân, Hai Bà Trưng, Hà Nội COD 320k',
      shop_id: 'test_shop_mcp'
    }
  }
});
assert.ok(!callOrderRes.error, 'Tool call must succeed');
const orderData = JSON.parse(callOrderRes.result.content[0].text);
assert.equal(orderData.order.phone, '0977889900');
assert.equal(orderData.order.codAmount, 320000);
assert.ok(orderData.order.name.includes('Trần Văn B'));

// 4. Test tools/call: address_normalize
const callAddrRes = await handleMcpRequest({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'address_normalize',
    arguments: {
      address: 'số 5 ngõ 122 vĩnh tuy hai bà trưng hà nội'
    }
  }
});
assert.ok(!callAddrRes.error, 'Address normalize must succeed');
const addrData = JSON.parse(callAddrRes.result.content[0].text);
assert.ok(addrData.province.toLowerCase().includes('hà nội') || addrData.normalized.toLowerCase().includes('hà nội'));
assert.ok(addrData.ward.toLowerCase().includes('vĩnh tuy') || addrData.normalized.toLowerCase().includes('vĩnh tuy'));

// 5. Test unknown tool handling
const unknownRes = await handleMcpRequest({
  jsonrpc: '2.0',
  id: 5,
  method: 'tools/call',
  params: { name: 'non_existent_tool' }
});
assert.ok(unknownRes.error);
assert.equal(unknownRes.error.code, -32601);

console.log('✅ ALL MCP ORDER TOOLS TESTS PASSED 100%!');
