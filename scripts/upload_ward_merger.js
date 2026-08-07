/**
 * Tệp script Node.js dùng để đẩy dữ liệu ward_merger lên Supabase
 * Yêu cầu: npm install @supabase/supabase-js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Điền cấu hình Supabase của bạn vào đây
const SUPABASE_URL = 'https://xlgovgynbsahuykyjzcx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ292Z3luYnNhaHV5a3lqemN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU4ODYxOSwiZXhwIjoyMTAwMTY0NjE5fQ.PqbHDnTxUDT0zSO8RXVHbr53p0DAmY76IlbUXYjWpR4';

async function uploadToSupabase() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error("Vui lòng cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong file scripts/upload_ward_merger.js trước khi chạy.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dataPath = path.join(__dirname, '../src/application/address/database/ward_merger.js');

  if (!fs.existsSync(dataPath)) {
    console.error(`Không tìm thấy file: ${dataPath}`);
    process.exit(1);
  }

  console.log("Đang load object WardMerger...");
  global.window = {};
  
  try {
    require(dataPath);
  } catch (e) {
    console.error("Lỗi khi load file:", e);
    process.exit(1);
  }

  const parsedData = globalThis.WARD_MERGER_MAP;
  if (!parsedData) {
    console.error("Không tìm thấy dữ liệu trên globalThis.WARD_MERGER_MAP");
    process.exit(1);
  }

  const keys = Object.keys(parsedData);
  console.log(`Tìm thấy ${keys.length} bản ghi địa danh. Đang đẩy lên Supabase...`);

  // Batch insert để tránh timeout (insert 500 records/lần)
  const BATCH_SIZE = 500;
  let batch = [];
  let totalInserted = 0;

  for (let i = 0; i < keys.length; i++) {
    batch.push({
      search_key: keys[i],
      mapped_value: parsedData[keys[i]]
    });

    if (batch.length === BATCH_SIZE || i === keys.length - 1) {
      const { error } = await supabase.from('address_dictionary').insert(batch);
      if (error) {
        console.error("Lỗi khi insert:", error);
      } else {
        totalInserted += batch.length;
        console.log(`Đã insert ${totalInserted}/${keys.length} bản ghi...`);
      }
      batch = [];
    }
  }

  console.log("Hoàn tất đẩy dữ liệu lên Database!");
  console.log("Bạn có thể xóa file ward_merger.js (4MB) khỏi source code.");
}

uploadToSupabase();
