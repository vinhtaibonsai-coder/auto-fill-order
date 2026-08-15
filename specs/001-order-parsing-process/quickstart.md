# Quickstart: Order Parsing Process Review

**Branch**: `001-order-parsing-process` | **Date**: 2026-07-22

## Prerequisites

- Chrome browser with Developer Mode enabled
- Extension loaded as unpacked from project root
- VNPost (`my.vnpost.vn`) or J&T (`shop.jtexpress.vn`) page open
- User authenticated (logged in via extension panel)

## Validation Scenarios

### V1: Basic parse review displays extracted fields

1. Navigate to VNPost create-order page (`my.vnpost.vn/.../create`)
2. Open the Auto Fill Order panel (click ⚡ AF button)
3. Paste into the text area: `5kg đỗ quyên 13e/28 trương Văn lực,cam lộ,Hồng bàng,Hải phòng Sđt:0929682381 Chỉ thu cước`
4. Click "Tách đơn" (parse button)

**Expected**: Panel transitions to review view showing:
- Sản phẩm: `5kg đỗ quyên`
- Địa chỉ: `13e/28 trương Văn lực, cam lộ, Hồng bàng, Hải phòng`
- SĐT: `0929682381`
- Thu cước: ✅ (checked)

### V2: User can edit before confirming

1. Complete V1 steps
2. In the review view, modify the phone number field to `0912345678`
3. Click "Xác nhận"

**Expected**: AI processes with the edited phone number, not the original.

### V3: Cancel returns to edit mode

1. Complete V1 steps
2. Click "Sửa lại" (cancel button)

**Expected**: Panel returns to IDLE state with raw text preserved in the input area.

### V4: Missing fields show visual warning

1. Open the panel
2. Paste: `abc123` (text with no parseable fields)
3. Click "Tách đơn"

**Expected**: Review view displays with empty/fallback values highlighted (yellow background for missing phone, address shows "không tìm thấy").

### V5: End-to-end flow completes

1. Complete V1 steps
2. Click "Xác nhận" in review view
3. Wait for AI processing (LOADING → REVIEW)
4. Click "Xác nhận" in confidence review

**Expected**: Form fields on VNPost/J&T page are populated with order data.

## Commands

```bash
# Build extension (if needed)
npm run build

# Run unit tests
npm run test

# Reload extension in Chrome:
# 1. chrome://extensions
# 2. Click refresh icon on "Auto Fill Order" extension
# 3. Reload the VNPost/J&T page
```
