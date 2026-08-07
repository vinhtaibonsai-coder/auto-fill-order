# UI/UX MASTER PLAN
## VNPost & J&T Order Automation Platform

**Version:** 1.0  
**Status:** DESIGN BASELINE  
**Purpose:** Single Source of Truth (SSOT) cho UI/UX, Information Architecture và AI Vibe Coding.

---

## 1. Mục tiêu

Chuẩn hóa toàn bộ giao diện hệ thống mà không phá vỡ business flow hiện tại:

```text
Paste Order
    ↓
Parse
    ↓
AI Normalize (optional)
    ↓
Review
    ↓
VNPost / J&T Autofill
```

Nguyên tắc:

- Không rewrite hệ thống chỉ vì UI.
- Không refactor business logic đang chạy tốt nếu không thuộc scope.
- Không tạo chức năng trùng.
- Mỗi chức năng phải có một Primary Location duy nhất.
- Admin, Shop và Extension là ba vùng sản phẩm khác nhau.
- UI chỉ là lớp presentation; security phải nằm ở backend/RLS/RPC/Edge Function.

---

# 2. Product Architecture

Hệ thống gồm 3 vùng:

```text
SYSTEM ADMIN
    ↓
Master Admin Portal

SHOP USER
    ↓
Shop Portal / Extension Options

DAILY ORDER OPERATION
    ↓
Chrome Extension Main Panel
```

## 2.1 Master Admin Portal

Dành cho:

- SYSTEM_ADMIN
- SUPPORT (chỉ các chức năng được cấp quyền)

Mục tiêu:

> Quản trị toàn hệ thống, shop, user, device, quota, cấu hình và audit.

## 2.2 Shop Portal

Dành cho:

- SHOP_OWNER
- SHOP_MANAGER
- SHOP_STAFF
- VIEWER / EXTENSION_USER theo permission

Mục tiêu:

> Quản lý hoạt động của một shop.

## 2.3 Extension Main Panel

Dành cho thao tác nhanh hàng ngày:

```text
Paste
→ Parse
→ AI
→ Review
→ Fill
```

Không biến Extension Panel thành Admin Dashboard.

---

# 3. Information Architecture

## 3.1 Master Admin

```text
ADMIN
├── Overview
├── Shops
│   ├── All Shops
│   └── Shop Detail
├── Users
│   ├── All Users
│   └── User Detail
├── Devices
├── Usage & Quotas
├── Audit Logs
└── System
    ├── AI
    ├── Extension
    ├── Security
    ├── Shipping
    └── Maintenance
```

## 3.2 Shop Portal

```text
SHOP
├── Dashboard
├── Orders
│   ├── All Orders
│   ├── Draft
│   ├── Submitted
│   ├── Failed
│   └── History
├── Customers
├── Address
├── Team
└── Settings
    ├── Shop Profile
    ├── VNPost
    ├── J&T
    ├── AI
    └── Permissions
```

## 3.3 Extension Options

`options.html` KHÔNG phải Admin Dashboard.

```text
EXTENSION SETTINGS
├── General
├── Shop
├── Shipping
│   ├── VNPost
│   └── J&T
├── AI
├── Address
├── Shortcuts
└── Account
```

## 3.4 Extension Main Panel

```text
Paste
 ↓
Parse
 ↓
AI Normalize
 ↓
Review
 ↓
Fill VNPost/J&T
```

---

# 4. Page Ownership Rules

| Chức năng | Primary Location |
|---|---|
| System metrics | Admin / Overview |
| Shop CRUD | Admin / Shops |
| User CRUD | Admin / Users |
| System roles | Admin / Users |
| Devices | Admin / Devices |
| System quota | Admin / Usage & Quotas |
| Audit logs | Admin / Audit Logs |
| Global AI config | Admin / System / AI |
| Extension version | Admin / System / Extension |
| Security config | Admin / System / Security |
| Shop dashboard | Shop / Dashboard |
| Orders | Shop / Orders |
| Customers | Shop / Customers |
| Shop team | Shop / Team |
| Shop profile | Shop / Settings |
| VNPost shop config | Shop / Settings / VNPost |
| J&T shop config | Shop / Settings / J&T |
| Personal extension preferences | Extension Options |
| Parse order | Extension Main Panel |
| Review order | Extension Main Panel |
| Autofill | Extension Main Panel |

Nếu chức năng cần xuất hiện ở nhiều nơi, chỉ được phép:

```text
Primary Location
+
Secondary Shortcut
```

Không được tạo hai implementation riêng.

---

# 5. Master Admin Overview

Dashboard chỉ trả lời:

> Hệ thống đang hoạt động thế nào?

## KPI

- Total Shops
- Active Users
- Orders Today
- AI Requests Today
- AI Quota Usage
- Active Devices
- Failed Orders

## System Health

- Supabase
- Authentication
- AI Gateway
- Groq
- VNPost
- J&T

## Recent Activity

Chỉ hiển thị activity quan trọng.

Không hiển thị toàn bộ audit log.

Có:

```text
View All Activity
```

---

# 6. Admin Shops

## List

Columns:

- Shop
- Owner
- Status
- Members
- Orders
- AI Usage
- Created
- Actions

Actions:

- View
- Edit
- Members
- Features
- Quota
- Disable
- Restore

## Shop Detail

```text
Header
    Shop name
    Status
    Owner

Tabs
    Overview
    Members
    Features
    Quota
    Orders
    Audit
    Settings
```

---

# 7. Admin Users

## List

Filters:

- Search
- Status
- System Role
- Shop
- Created date

Columns:

- User
- Role
- Shop
- Status
- Last Login
- Devices
- Created
- Actions

## User Detail

```text
Profile
Roles
Shop Memberships
Devices
Activity
Security
```

---

# 8. Devices

Columns:

- Device
- User
- Shop
- Browser
- Extension Version
- Last Seen
- Status

Actions:

- View
- Revoke

Revoke phải có confirmation.

---

# 9. Usage & Quotas

Metrics:

- AI Requests
- AI Tokens
- Orders
- Active Devices

Filters:

- Today
- 7 Days
- 30 Days
- Custom

Shop quota:

- Limit
- Used
- Remaining
- Reset Date

Quota mutation không đặt trực tiếp trên dashboard overview.

---

# 10. Audit Logs

Filters:

- Actor
- Action
- Resource
- Shop
- Date

Columns:

- Time
- Actor
- Action
- Resource
- Target
- Shop

Click row → Detail Drawer.

Audit logs phải ưu tiên immutable.

---

# 11. System Configuration

Không tạo một Config page khổng lồ.

```text
System
├── AI
│   ├── Providers
│   ├── Models
│   ├── Prompt
│   └── Limits
├── Extension
│   ├── Version
│   ├── Force Update
│   └── Maintenance
├── Security
│   ├── Blacklist
│   ├── Rate Limits
│   └── Session Policy
└── Shipping
    ├── VNPost
    └── J&T
```

---

# 12. Configuration UX

Mỗi configuration page phải hỗ trợ:

```text
View
→ Edit
→ Dirty State
→ Validation
→ Save
→ Success Toast / Error Toast
```

Khi rời page có unsaved changes:

```text
Bạn có thay đổi chưa lưu.

[Ở lại]
[Bỏ thay đổi]
```

Không dùng `alert()` làm feedback chính.

---

# 13. Secret Management

API secret không hiển thị đầy đủ.

Ví dụ:

```text
gsk_••••••••••••••••9K2A
```

Actions:

- Add
- Rotate
- Disable
- Delete

Secret tuyệt đối không được gửi về Extension Client.

---

# 14. Shop Dashboard

Dashboard phải trả lời:

> Shop hôm nay hoạt động thế nào?

KPI:

- Orders Today
- Successful Orders
- Failed Orders
- COD
- AI Usage

Không đưa system configuration vào Shop Dashboard.

---

# 15. Orders

Filters:

- Search
- Status
- Platform
- Shipping Provider
- Date

Statuses:

```text
Draft
Parsed
Reviewed
Submitted
Shipping
Delivered
Failed
Cancelled
Returned
```

Order Detail:

```text
Customer
Address
Items
COD
Shipping Provider
Tracking
Created By
Device
Timeline
```

---

# 16. Extension Options

Options chỉ chứa cấu hình liên quan trực tiếp tới extension/user.

Không đưa vào:

- System user management
- Shop CRUD
- Global API keys
- System audit
- Global quotas
- System maintenance
- Global RBAC administration

---

# 17. Extension Main Panel

Business flow bắt buộc giữ:

```text
Paste
 ↓
Parse
 ↓
AI
 ↓
Review
 ↓
Fill
```

Ưu tiên:

- Keyboard navigation
- Paste nhanh
- Tab/Enter
- Quick Actions
- Clear validation
- Error recovery

Không biến panel thành một CRUD dashboard.

---

# 18. Permission UX

Không chỉ disable button khi user không có quyền.

Nếu feature không thuộc quyền user, ưu tiên:

```text
Hide
```

Nếu cần cho user biết feature tồn tại nhưng chưa được cấp:

```text
Visible + Locked State
```

Không được dựa vào frontend để bảo mật.

Backend/RLS/RPC là security boundary.

---

# 19. UI States

Mọi page quan trọng phải có:

```text
Loading
Loaded
Empty
Error
Unauthorized
Disabled
Saving
Saved
Dirty
```

Không để màn hình trắng khi API lỗi.

---

# 20. Confirmation Rules

Bắt buộc confirmation:

- Delete
- Disable
- Remove Member
- Revoke Device
- Rotate Secret
- Reset Configuration
- Restore destructive state

Không cần confirmation:

- Search
- Filter
- Open
- View
- Refresh

---

# 21. Toast Rules

Success:

```text
✓ Đã lưu cấu hình
```

Error:

```text
✕ Không thể lưu thay đổi
```

Warning:

```text
⚠ Bạn có thay đổi chưa lưu
```

Không sử dụng alert() cho UX thông thường.

---

# 22. Design System

Tất cả portal dùng component pattern thống nhất:

```text
Button
Input
Select
Checkbox
Switch
Badge
Card
Table
Modal
Drawer
Toast
Tabs
Dropdown
Tooltip
Skeleton
Empty State
Pagination
Breadcrumb
```

Không viết lại component pattern khác nhau cho từng page.

---

# 23. Responsive

Admin:

- Desktop first

Shop:

- Desktop
- Tablet
- Mobile

Extension:

- Compact UI

Không chỉ scale desktop xuống mobile.

---

# 24. Accessibility

Tối thiểu:

- Keyboard navigation
- Visible focus state
- Semantic buttons
- Labels cho form
- Contrast tốt
- Không chỉ dùng màu để thể hiện trạng thái
- Dialog có focus management
- Escape đóng modal/drawer khi phù hợp

---

# 25. AI Vibe Coding Rules

AI KHÔNG được tự ý:

- Tạo page mới
- Tạo navigation mới
- Duplicate feature
- Đổi database schema
- Đổi RPC
- Đổi RLS
- Đổi business flow
- Refactor unrelated code
- Rename existing API
- Xóa chức năng hiện có

nếu task không yêu cầu.

---

# 26. Before Coding Checklist

AI phải xác định:

1. Feature thuộc Portal nào?
2. Feature thuộc Navigation nào?
3. Có feature trùng không?
4. Page nào hiện đang có feature tương tự?
5. Primary Location là gì?
6. Có cần DB change không?
7. Có cần RPC change không?
8. Có ảnh hưởng RLS không?
9. Có ảnh hưởng extension flow không?

Nếu chưa xác định được:

```text
STOP
DO NOT CODE
```

---

# 27. Implementation Order

```text
Phase 1
Information Architecture

Phase 2
UI Inventory

Phase 3
Feature Matrix

Phase 4
Design System

Phase 5
Master Admin

Phase 6
Shop Portal

Phase 7
Extension Options

Phase 8
Extension Main Panel

Phase 9
Responsive + Accessibility

Phase 10
QA
```

---

# 28. Definition of Done

UI task chỉ hoàn thành khi:

- Đúng Portal
- Đúng Navigation
- Không duplicate feature
- Không phá business logic
- Loading state
- Empty state
- Error state
- Permission state
- Success feedback
- Confirmation khi cần
- Responsive nếu cần
- Không console error
- Không sửa DB ngoài scope
- Không tạo navigation ngoài IA
- Không tạo component UI trùng

---

# 29. Reference Products

Tham khảo:

- Shopify Admin — business/admin IA
- Stripe Dashboard — tables/orders/financial UX
- Supabase Dashboard — developer/admin UX
- Vercel Dashboard — settings/project management
- Linear — interaction patterns

Không copy trực tiếp.

Chỉ học:

- Information Architecture
- Navigation
- Tables
- Filters
- Detail pages
- Settings
- Feedback
- Interaction patterns

---

# 30. Golden Rule

> Mỗi chức năng phải có đúng một nơi để tồn tại.

Nếu cần shortcut:

```text
Primary Location
+
Secondary Shortcut
```

Không tạo hai implementation riêng.

---

# 31. Non-Goals

Tài liệu này KHÔNG yêu cầu:

- Rewrite Vanilla JS
- Chuyển React/Vue
- Rewrite Supabase
- Rewrite Extension
- Thay đổi business flow
- Thay đổi database nếu chưa được phê duyệt
- Thay đổi authentication architecture nếu chưa được audit

---

# 32. Design Freeze Rule

Sau khi IA được phê duyệt:

> Không được thêm sidebar item, page hoặc module mới nếu chưa cập nhật tài liệu này.

Mọi feature mới phải cập nhật:

```text
UI_UX_MASTER_PLAN.md
UI_INVENTORY.md
FEATURE_MATRIX.md
```

trước khi code.
