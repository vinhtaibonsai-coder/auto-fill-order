# UI ROUTE MAP
## Canonical Navigation Map

**Status:** AUDITED

---

# 1. Admin Portal

```text
/admin
├── /overview
├── /shops
│   ├── /shops/:id
│   ├── /shops/:id/members
│   ├── /shops/:id/features
│   ├── /shops/:id/quota
│   ├── /shops/:id/orders
│   └── /shops/:id/audit
├── /users
│   └── /users/:id
├── /devices
├── /usage
├── /audit
└── /system
    ├── /system/ai
    ├── /system/extension
    ├── /system/security
    ├── /system/shipping
    └── /system/maintenance
```

Nếu hiện tại đang dùng hash routing:

```text
#overview
#shops
#users
#devices
#usage
#audit
#system
```

có thể giữ nguyên.

Không bắt buộc chuyển sang SPA/router framework.

---

# 2. Shop Portal

```text
/shop
├── /dashboard
├── /orders
├── /customers
├── /address
├── /team
└── /settings
    ├── /profile
    ├── /vnpost
    ├── /jt
    ├── /ai
    └── /permissions
```

---

# 3. Extension Options

```text
/options
├── /general
├── /shop
├── /shipping
│   ├── /vnpost
│   └── /jt
├── /ai
├── /address
├── /shortcuts
└── /account
```

---

# 4. Extension Main Panel

Không dùng route navigation kiểu dashboard.

State machine:

```text
IDLE
 ↓
INPUT
 ↓
PARSING
 ↓
PARSED
 ↓
AI_PROCESSING (optional)
 ↓
REVIEW
 ↓
SUBMITTING
 ↓
FILLED
```

Error có thể quay về:

```text
INPUT
REVIEW
```

---

# 5. Navigation Rules

Không thêm top-level navigation nếu feature có thể thuộc:

```text
Existing Section
Existing Detail Page
Existing Settings
```

Top-level navigation phải đại diện cho một domain lớn.

---

# 6. Naming

Ưu tiên noun:

```text
Orders
Users
Shops
Devices
Audit Logs
Settings
```

Không:

```text
Manage Orders
Manage Users
Do Settings
```

---

# 7. Page Ownership

| Domain | Owner |
|---|---|
| System | Admin |
| Shops | Admin |
| Users | Admin |
| Devices | Admin |
| Quotas | Admin |
| Audit | Admin |
| Orders | Shop |
| Customers | Shop |
| Team | Shop |
| Shop Settings | Shop |
| Extension Preferences | Extension Options |
| Order Parsing | Extension Panel |
| Autofill | Extension Panel |

---

# 8. Navigation Freeze

Sau khi IA được approved:

> Không thêm top-level menu nếu chưa cập nhật UI_UX_MASTER_PLAN.md và UI_ROUTE_MAP.md.
