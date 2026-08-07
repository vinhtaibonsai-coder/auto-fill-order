(() => {
  const VNPOST_SELECTORS = {
    radioNewAddress: 'input[type="radio"], label, span',
    phoneLabels: [/Số điện thoại/i, /SĐT/i, /Phone/i],
    phoneFallbacks: [
      'input#receiverPhone',
      'input[name*="phone" i]',
      'input[placeholder*="SĐT" i]',
      'input[placeholder*="Số điện thoại" i]',
      'input[type="tel"]'
    ],
    nameLabels: [/Tên người nhận/i, /Họ tên/i, /Họ và tên/i, /Người nhận/i],
    nameFallbacks: [
      'input#receiverName',
      'input[name*="name" i]',
      'input[placeholder*="Tên" i]',
      'input[placeholder*="Họ tên" i]'
    ],
    addressLabels: [/Địa chỉ chi tiết/i, /Địa chỉ mới/i, /Địa chỉ nhận/i, /Địa chỉ người nhận/i],
    addressFallbacks: [
      'input[placeholder*="Địa chỉ chi tiết" i]',
      'textarea[placeholder*="Địa chỉ chi tiết" i]',
      'input[placeholder*="địa chỉ mới" i]',
      'textarea[placeholder*="địa chỉ mới" i]',
      'textarea#receiverAddress',
      'input#receiverAddress'
    ],
    noteLabels: [/Nội dung/i, /Ghi chú/i, /Nội dung hàng/i],
    noteFallbacks: [
      'textarea[placeholder*="Nội dung" i]',
      'textarea[placeholder*="Ghi chú" i]',
      'textarea#receiverNote',
      'textarea[name*="note" i]'
    ],
    codLabels: ['Phát hàng thu tiền COD', 'Thu tiền COD'],
    codInputFallbacks: [
      'input.ant-input-number-input',
      'input[name="PROP0018"]'
    ],
    shipFeeKeywords: ['thu phí ship', 'thu ship', 'thu cước ship', 'thu cước vận chuyển', 'người gửi trả cước']
  };

  globalThis.VNPOST_SELECTORS = VNPOST_SELECTORS;
})();
