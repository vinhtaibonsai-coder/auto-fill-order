export function parseCustomerCsv(text, mapping = {}) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return { rows: [], errors: [{ row: 0, message: 'Tệp trống' }] };
  const split = line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(value => value.replace(/^\"|\"$/g, '').replace(/\"\"/g, '"').trim());
  const headers = split(lines[0]).map(value => value.toLowerCase());
  const aliases = { phone: ['phone','số điện thoại','sdt','điện thoại'], name: ['name','tên','tên khách hàng'], address: ['address','địa chỉ'], orderCode: ['order code','mã đơn','order_code'], codAmount: ['cod','cod amount','tiền thu hộ'], status: ['status','trạng thái'], carrier: ['carrier','hãng vận chuyển'] };
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => {
    const mappedHeader = String(mapping[key] || '').toLowerCase();
    return [key, mappedHeader ? headers.indexOf(mappedHeader) : headers.findIndex(header => names.includes(header))];
  }));
  if (indexes.phone < 0) return { rows: [], errors: [{ row: 1, message: 'Thiếu cột Số điện thoại' }] };
  const rows = []; const errors = [];
  lines.slice(1).forEach((line, index) => {
    const values = split(line); const phone = String(values[indexes.phone] || '').replace(/\D/g, '');
    if (phone.length < 9) { errors.push({ row: index + 2, message: 'Số điện thoại không hợp lệ' }); return; }
    const value = key => indexes[key] >= 0 ? values[indexes[key]] || '' : '';
    rows.push({ id: `import-${index + 2}-${phone}`, phone, name: value('name'), address: value('address'), orderCode: value('orderCode'), codAmount: Number(value('codAmount').replace(/\D/g,'')) || 0, status: value('status') || 'success', carrier: value('carrier') });
  });
  return { rows, errors, headers, mapping: Object.fromEntries(Object.entries(indexes).map(([key, index]) => [key, index >= 0 ? headers[index] : ''])) };
}

const xmlDecode = value => String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const columnIndex = ref => [...String(ref || '').replace(/\d/g, '')].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1;

async function unzipEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('Tệp XLSX dùng kiểu nén không được hỗ trợ.');
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readXlsxEntries(buffer) {
  const bytes = new Uint8Array(buffer); const view = new DataView(buffer); const decoder = new TextDecoder();
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error('Tệp XLSX không hợp lệ.');
  const count = view.getUint16(eocd + 10, true); let offset = view.getUint32(eocd + 16, true); const files = {};
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true); const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true); const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    files[name] = decoder.decode(await unzipEntry(bytes, { method, compressedSize, localOffset }));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

export async function parseCustomerXlsx(buffer, mapping = {}) {
  const files = await readXlsxEntries(buffer); const sharedXml = files['xl/sharedStrings.xml'] || '';
  const shared = [...sharedXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(match => xmlDecode([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(item => item[1]).join('')));
  const sheetName = Object.keys(files).find(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error('Tệp XLSX không có worksheet.');
  const rows = [...files[sheetName].matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(rowMatch => {
    const values = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cell[1].match(/\br="([A-Z]+\d+)"/)?.[1]; const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
      const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
      values[columnIndex(ref)] = type === 's' ? (shared[Number(raw)] || '') : xmlDecode(raw);
    }
    return values;
  });
  const csv = rows.map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  return parseCustomerCsv(csv, mapping);
}

export async function parseCustomerFile(file, { mapping = {} } = {}) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.csv') || file?.type === 'text/csv') return parseCustomerCsv(await file.text(), mapping);
  if (name.endsWith('.xlsx')) return parseCustomerXlsx(await file.arrayBuffer(), mapping);
  throw new Error('Chỉ hỗ trợ tệp CSV hoặc XLSX.');
}

export async function runCustomerSyncJob(repository, orders, { sourceType = 'import', batchSize = 100, resumeFrom = 0, retries = 2, signal, onProgress = () => {} } = {}) {
  const list = Array.isArray(orders) ? orders : [];
  const created = await repository.createJob(sourceType === 'import' ? 'import' : 'backfill', list.length);
  const job = created?.[0]; let success = 0; const errors = [];
  repository.audit?.('CUSTOMER_SYNC_STARTED', { jobId: job?.id, sourceType, total: list.length }).catch(() => {});
  try {
    for (let offset = Math.max(0, resumeFrom); offset < list.length; offset += batchSize) {
      if (signal?.aborted) {
        await repository.updateJob(job.id, { status: 'cancelled', cursor_value: String(offset), completed_at: new Date().toISOString() });
        return { jobId: job.id, success, errors, cancelled: true, cursor: offset };
      }
      for (const order of list.slice(offset, offset + batchSize)) {
        let attempt = 0;
        while (attempt <= retries) {
          try { await repository.syncOrder(order, sourceType); success += 1; break; }
          catch (error) {
            attempt += 1;
            if (attempt > retries) errors.push({ id: order.id, message: error.message });
          }
        }
      }
      const processed = Math.min(offset + batchSize, list.length);
      await repository.updateJob(job.id, { cursor_value: String(processed), processed_rows: processed, success_rows: success, error_rows: errors.length, error_report: errors.slice(-100) });
      onProgress({ processed, total: list.length, success, errors: errors.length });
    }
    await repository.updateJob(job.id, { status: errors.length ? 'partial' : 'completed', completed_at: new Date().toISOString(), processed_rows: list.length, success_rows: success, error_rows: errors.length, error_report: errors });
    repository.audit?.('CUSTOMER_SYNC_COMPLETED', { jobId: job.id, sourceType, total: list.length, success, errors: errors.length }).catch(() => {});
    return { jobId: job.id, success, errors };
  } catch (error) {
    if (job?.id) await repository.updateJob(job.id, { status: 'failed', error_report: [...errors, { message: error.message }], completed_at: new Date().toISOString() });
    console.warn('[CustomerHubMetric]', { event: 'sync_job_failed', jobId: job?.id, sourceType, processed: success + errors.length, error: error.message });
    repository.audit?.('CUSTOMER_SYNC_FAILED', { jobId: job?.id, sourceType, processed: success + errors.length, error: error.message }).catch(() => {});
    throw error;
  }
}

export function exportCustomersCsv(customers) {
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['Số điện thoại','Tên khách hàng','Địa chỉ','Tổng đơn','Đơn thành công','LTV','AOV','Phân khúc','Rủi ro','Đơn gần nhất'];
  const rows = customers.map(item => [item.rawPhone || item.phone,item.name,item.primaryAddress,item.totalOrders,item.successfulOrders,item.totalSpent,Math.round(item.aov),item.manualTag || item.autoTag,item.riskLevel,item.lastOrderDate].map(escape).join(','));
  return `\uFEFF${header.map(escape).join(',')}\n${rows.join('\n')}`;
}
