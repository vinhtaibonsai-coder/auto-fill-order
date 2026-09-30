#!/usr/bin/env node
// =========================================================================
// LOCAL MCP TOOL ADAPTER FOR AGENT/BACKOFFICE ORDER WORKFLOWS
// JSON-RPC 2.0 stdio Server (No Browser Dependencies, No Exposed Secrets)
// =========================================================================

import readline from 'node:readline';
import { parseOrderText, normalizeAddress, parseAndNormalize } from '../../src/application/order-parser/core-parser.js';

const TOOLS_MANIFEST = [
  {
    name: 'order_parse_text',
    description: 'Bóc tách thực thể đơn hàng (Tên, SĐT, Địa chỉ, Mã đơn SKU, Tiền thu hộ COD, Ghi chú, Khối lượng) từ văn bản tiếng Việt tự do.',
    inputSchema: {
      type: 'object',
      properties: {
        raw_text: {
          type: 'string',
          description: 'Văn bản đơn hàng thô do khách hàng hoặc nhân viên nhập (vd: "Tuấn 0912345678 12 Hàng Bài HK HN COD 500k")'
        },
        shop_id: {
          type: 'string',
          description: 'Mã shop tùy chọn (giúp cách ly cache bóc tách)'
        },
        default_weight: {
          type: 'number',
          description: 'Khối lượng mặc định bưu gửi tính theo gram (mặc định: 200)'
        }
      },
      required: ['raw_text']
    }
  },
  {
    name: 'address_normalize',
    description: 'Chuẩn hóa địa chỉ hành chính Việt Nam (Tỉnh/Thành phố, Quận/Huyện, Phường/Xã, Tên đường/Số nhà, tự động nhận diện 2 cấp vs 3 cấp).',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Chuỗi địa chỉ cần chuẩn hóa (vd: "số 339 ngõ quỳnh bạch mai hà nội")'
        },
        phone: {
          type: 'string',
          description: 'Số điện thoại người nhận (dùng để bổ trợ nhận diện mã vùng nếu địa chỉ mơ hồ)'
        }
      },
      required: ['address']
    }
  }
];

export async function handleMcpRequest(request) {
  const { id, method, params } = request || {};

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'auto-fill-order-mcp',
          version: '1.0.2'
        }
      }
    };
  }

  if (method === 'notifications/initialized') {
    return null; // Notification, no response needed
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS_MANIFEST
      }
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      if (name === 'order_parse_text') {
        const parsed = await parseAndNormalize(args?.raw_text || '', {
          shopId: args?.shop_id || 'default',
          defaultWeight: args?.default_weight || 200
        });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(parsed, null, 2)
              }
            ]
          }
        };
      }

      if (name === 'address_normalize') {
        const normalized = await normalizeAddress(args?.address || '', {
          phone: args?.phone || ''
        });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(normalized, null, 2)
              }
            ]
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown tool: ${name}`
        }
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: err.message || 'Lỗi xử lý tool'
        }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

// Start stdio loop if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    if (!line || !line.trim()) return;
    try {
      const req = JSON.parse(line.trim());
      const res = await handleMcpRequest(req);
      if (res) {
        process.stdout.write(JSON.stringify(res) + '\n');
      }
    } catch (e) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: invalid JSON' }
      }) + '\n');
    }
  });
}
