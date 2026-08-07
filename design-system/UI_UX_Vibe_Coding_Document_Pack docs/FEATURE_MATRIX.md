# FEATURE MATRIX
## Roles × Portal × Capability

**Status:** AUDITED

---

# 1. Roles

## System roles

- SYSTEM_ADMIN
- SUPPORT

## Shop roles

- SHOP_OWNER
- SHOP_MANAGER
- SHOP_STAFF
- VIEWER
- EXTENSION_USER

---

# 2. Portal

```text
ADMIN
SHOP
EXTENSION_OPTIONS
EXTENSION_PANEL
```

---

# 3. Permission Matrix

| Capability | SYS_ADMIN | SUPPORT | OWNER | MANAGER | STAFF | VIEWER | EXT_USER |
|---|---:|---:|---:|---:|---:|---:|---:|
| System Overview | ✓ | ✓ | — | — | — | — | — |
| Shop CRUD | ✓ | Limited | — | — | — | — | — |
| User Management | ✓ | Limited | — | — | — | — | — |
| System Roles | ✓ | — | — | — | — | — | — |
| Shop Members | ✓ | Limited | ✓ | ✓ | — | — | — |
| Device Management | ✓ | Limited | ✓ | Limited | Own | Own | Own |
| System Config | ✓ | Limited | — | — | — | — | — |
| Shop Settings | ✓ | Support | ✓ | Limited | — | — | — |
| Orders View | ✓ | Support | ✓ | ✓ | ✓ | ✓ | Permission |
| Orders Create | ✓ | Support | ✓ | ✓ | ✓ | — | Permission |
| Orders Edit | ✓ | Support | ✓ | ✓ | ✓ | — | Permission |
| Orders Delete | ✓ | — | ✓ | Limited | — | — | — |
| AI Parsing | ✓ | Support | ✓ | ✓ | ✓ | — | Permission |
| VNPost Autofill | ✓ | Support | ✓ | ✓ | ✓ | — | Permission |
| J&T Autofill | ✓ | Support | ✓ | ✓ | ✓ | — | Permission |
| Audit Logs | ✓ | Limited | Shop only | Shop only | Own | — | Own |
| Quota Management | ✓ | Limited | View | View | — | — | — |

> Đây là baseline. Không dùng bảng này thay thế backend authorization.

---

# 4. Permission Naming

Permission nên chuẩn hóa thành dạng:

```text
orders.read
orders.create
orders.update
orders.delete

orders.submit

customers.read
customers.create
customers.update

team.read
team.invite
team.update
team.remove

shop.read
shop.update

ai.parse
ai.address

shipping.vnpost
shipping.jt

devices.read
devices.revoke

audit.read

quota.read
quota.manage
```

---

# 5. UI Visibility Rules

Nếu không có permission:

### Default

Ẩn action.

### Nếu feature cần discoverability

Hiển thị locked state:

```text
Feature unavailable
Contact your administrator.
```

Không hiển thị disabled action nếu làm UI rối.

---

# 6. Security Rule

Frontend permission chỉ phục vụ UX.

Không được coi là security boundary.

Security phải được enforce bằng:

```text
JWT
+
RPC authorization
+
RLS
+
Edge Function authorization
```

---

# 7. New Feature Rule

Mỗi feature mới phải khai báo:

```text
Feature:
Portal:
Primary Location:
Required Permission:
Roles:
Backend API:
Database:
RLS:
Audit Event:
```

Không được code nếu thiếu các thông tin cần thiết.
