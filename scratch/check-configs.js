const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xlgovgynbsahuykyjzcx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ292Z3luYnNhaHV5a3lqemN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU4ODYxOSwiZXhwIjoyMTAwMTY0NjE5fQ.PqbHDnTxUDT0zSO8RXVHbr53p0DAmY76IlbUXYjWpR4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Updating default_custom_prompt_rules in database...");
  
  const updatedRules = `Bạn là chuyên gia bóc tách đơn hàng. Trả về JSON duy nhất, không bọc markdown.
    YÊU CẦU:
    - phone PHẢI là số điện thoại Việt Nam bắt đầu bằng 0, gồm 10 hoặc 11 chữ số.
    - Nếu văn bản có nhiều số điện thoại, hãy giữ số đầu tiên hợp lệ làm phone.
    - Nếu có số điện thoại dính nhau, tách ra và chỉ giữ số hợp lệ 10 hoặc 11 chữ số.
    - codAmount là số nguyên, không có ký tự khác.
      + Chú ý cách viết tiền thu hộ dạng "1.700k" hay "1,700k" nghĩa là 1700k (1700000 - 1 triệu 700 nghìn đồng), tuyệt đối không được bóc tách nhầm thành 170000 (trăm bảy mươi nghìn) hay 1700.
    - correctAddress PHẢI đầy đủ và chi tiết: bao gồm cả số phòng, số nhà, ngõ/đường, tòa nhà/block/khu đô thị, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố (ví dụ: S202 vinsmart city...). KHÔNG được tự ý cắt bỏ căn hộ/tòa nhà.
    - Nếu địa chỉ viết tắt (HN, HCM...), hãy mở rộng đầy đủ.
    - Nếu không biết rõ Phường/Xã hoặc Quận/Huyện, chỉ ghi các cấp hành chính lớn nhất biết được. Tuyệt đối KHÔNG tự ý điền các từ đại diện như "Phường", "Quận", "Xã", "Huyện" làm giá trị mặc định.
    - orderCode là mã quản lý đơn hàng của shop (ví dụ: e100.377). Tuyệt đối KHÔNG lấy số phòng, số nhà, số căn hộ, tên tòa nhà/block (như S202, S2.02, tòa S2, block A...), hoặc chữ "Cod", "COD" kèm số tiền thu hộ làm mã đơn hàng. Nếu không có mã đơn hàng rõ ràng, hãy để chuỗi rỗng "".
    JSON format: {"name":"...","phone":"...","orderCode":"","codAmount":0,"correctAddress":"..."}
    Văn bản: {text}`;

  const { data, error } = await supabase
    .from('system_configs')
    .update({ value: { rules: updatedRules } })
    .eq('key', 'default_custom_prompt_rules');

  if (error) {
    console.error("Error updating config:", error.message);
  } else {
    console.log("Successfully updated default_custom_prompt_rules in DB!");
  }
}

run();
