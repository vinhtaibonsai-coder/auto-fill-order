const fs = require('fs');

async function findUI() {
  const res = await fetch('https://my.vnpost.vn/umi.96ed20c2.js');
  const text = await res.text();

  // Tìm Component sử dụng hàm ve (ở trên)
  const idx = 3369016;
  console.log('UI component context:');
  console.log(text.slice(Math.max(0, idx - 1500), Math.min(text.length, idx + 1500)));
}

findUI().catch(err => console.error(err));
