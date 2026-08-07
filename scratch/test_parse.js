const fs = require('fs');

global.localStorage = { getItem: () => null, setItem: () => {} };

eval(fs.readFileSync('./backend/features/address/database/data.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/database/ward_merger.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/aliases.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/fuzzy.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/parser.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/rules.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/validator.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/learning.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/normalizer.js', 'utf8'));
eval(fs.readFileSync('./backend/features/address/engine.js', 'utf8'));
eval(fs.readFileSync('./backend/features/order-parser/parser.js', 'utf8'));

async function testAll() {
  console.log("=================== TEST 1 ===================");
  const text1 = `Vũ Trang
5kg đỗ quyên 
Cod 450k+ cước 
0962004039
ấp chợ phú túc định quán đồng nai đơn  như này ko tìm thấy địa chỉ`;
  const order1 = OrderProcessor.parse(text1);
  console.log('Order 1:', order1);
  const addr1 = await AddressEngine.process(order1.address, order1.phone);
  console.log('Addr 1:', addr1);

  console.log("\n=================== TEST 2 ===================");
  const text2 = `Cá cảnh gò Vấp
SĐT 0378890309
Địa chỉ 145 đường số 8, phường 11, Gò Vấp
Cod 3.420k + cước`;
  const order2 = OrderProcessor.parse(text2);
  console.log('Order 2:', order2);
  const addr2 = await AddressEngine.process(order2.address, order2.phone);
  console.log('Addr 2:', addr2);
}

testAll();
