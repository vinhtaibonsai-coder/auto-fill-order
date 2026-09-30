import assert from 'node:assert/strict';
import { parseCustomerCsv, parseCustomerXlsx, exportCustomersCsv } from '../../src/application/customer/customer-import.service.js';
const storedZip = files => {
  const encoder = new TextEncoder(); const chunks = []; const central = []; let offset = 0;
  for (const [name,value] of Object.entries(files)) {
    const n=encoder.encode(name), d=encoder.encode(value), local=new Uint8Array(30+n.length+d.length), lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(8,0,true); lv.setUint32(18,d.length,true); lv.setUint32(22,d.length,true); lv.setUint16(26,n.length,true); local.set(n,30); local.set(d,30+n.length); chunks.push(local);
    const c=new Uint8Array(46+n.length), cv=new DataView(c.buffer); cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(10,0,true); cv.setUint32(20,d.length,true); cv.setUint32(24,d.length,true); cv.setUint16(28,n.length,true); cv.setUint32(42,offset,true); c.set(n,46); central.push(c); offset+=local.length;
  }
  const centralSize=central.reduce((sum,item)=>sum+item.length,0), end=new Uint8Array(22), ev=new DataView(end.buffer); ev.setUint32(0,0x06054b50,true); ev.setUint16(8,central.length,true); ev.setUint16(10,central.length,true); ev.setUint32(12,centralSize,true); ev.setUint32(16,offset,true);
  const output=new Uint8Array(offset+centralSize+end.length); let at=0; for(const item of [...chunks,...central,end]){output.set(item,at);at+=item.length;} return output.buffer;
};
const parsed = parseCustomerCsv('Số điện thoại,Tên,Địa chỉ,COD\n0912345678,Nguyễn An,Hà Nội,500000\nabc,Lỗi,HCM,0');
assert.equal(parsed.rows.length, 1);
assert.equal(parsed.errors.length, 1);
assert.equal(parsed.rows[0].phone, '0912345678');
assert.ok(exportCustomersCsv([{ phone:'0912345678',name:'An',totalOrders:1 }]).startsWith('\uFEFF'));
const remapped = parseCustomerCsv('mobile,customer\n0987654321,Bình', { phone: 'mobile', name: 'customer' });
assert.equal(remapped.rows[0].name, 'Bình');
assert.equal(remapped.mapping.phone, 'mobile');
const xlsx = storedZip({
  'xl/sharedStrings.xml':'<sst><si><t>Số điện thoại</t></si><si><t>Tên</t></si><si><t>0911222333</t></si><si><t>Lan</t></si></sst>',
  'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row></sheetData></worksheet>'
});
const parsedXlsx = await parseCustomerXlsx(xlsx);
assert.equal(parsedXlsx.rows[0].phone, '0911222333'); assert.equal(parsedXlsx.rows[0].name, 'Lan');
console.log('Customer Hub import/export contracts passed.');
