(() => {
  const VNPOST_SELECTORS = {
    radioNewAddress: 'input[type="radio"], label, span',
    phoneLabels: [/Số điện thoại/i, /SĐT/i, /Phone/i, /Điện thoại nhận/i],
    phoneFallbacks: [
      'input#receiverPhone',
      'input[name*="phone" i]',
      'input[name*="ReceiverPhone" i]',
      'input[placeholder*="SĐT" i]',
      'input[placeholder*="Số điện thoại" i]',
      'input[placeholder*="điện thoại" i]',
      'input[type="tel"]',
      'input.ant-input[placeholder*="nhập" i]' // aggressive fallback handled in dom.js if needed
    ],
    nameLabels: [/Tên người nhận/i, /Họ tên/i, /Họ và tên/i, /Người nhận/i],
    nameFallbacks: [
      'input#receiverName',
      'input[name*="name" i]',
      'input[name*="ReceiverName" i]',
      'input[placeholder*="Tên" i]',
      'input[placeholder*="Họ tên" i]',
      'input[placeholder*="Họ và tên" i]',
      'input[placeholder*="Người nhận" i]'
    ],
    addressLabels: [/Địa chỉ chi tiết/i, /Địa chỉ mới/i, /Địa chỉ nhận/i, /Địa chỉ người nhận/i, /Số nhà/i, /Đường\/Phố/i],
    addressFallbacks: [
      'input[placeholder*="Địa chỉ" i]',
      'textarea[placeholder*="Địa chỉ" i]',
      'input[placeholder*="Số nhà" i]',
      'textarea[placeholder*="Số nhà" i]',
      'textarea#receiverAddress',
      'input#receiverAddress',
      'input[name*="Address" i]',
      'textarea[name*="Address" i]'
    ],
    noteLabels: [/Nội dung/i, /Ghi chú/i, /Nội dung hàng/i],
    noteFallbacks: [
      'textarea[placeholder*="Nội dung" i]',
      'textarea[placeholder*="Ghi chú" i]',
      'textarea#receiverNote',
      'textarea[name*="note" i]'
    ],
    codLabels: ['Phát hàng thu tiền COD', 'Thu tiền COD', 'Tiền thu hộ'],
    codInputFallbacks: [
      'input.ant-input-number-input',
      'input[name="PROP0018"]',
      'input[name*="COD" i]'
    ],
    shipFeeKeywords: ['thu phí ship', 'thu ship', 'thu cước ship', 'thu cước vận chuyển', 'người gửi trả cước']
  };

  globalThis.VNPOST_SELECTORS = VNPOST_SELECTORS;
})();
