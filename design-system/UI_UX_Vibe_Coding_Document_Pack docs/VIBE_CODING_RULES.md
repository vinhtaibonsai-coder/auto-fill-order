# VIBE CODING RULES
## AI Development Rules — UI/UX

**Priority:** Mandatory

---

# 1. Golden Rule

> Think Before Coding.

Không code ngay khi nhận yêu cầu UI.

---

# 2. Required Context

Trước khi sửa UI, AI phải đọc:

```text
AGENTS.md
CLAUDE.md
UI_UX_MASTER_PLAN.md
UI_INVENTORY.md
FEATURE_MATRIX.md
DESIGN_SYSTEM.md
```

Nếu có database/API liên quan:

```text
database/migrations/
RPC definitions
```

---

# 3. Before Coding

AI phải xác định:

```text
1. Portal
2. Page
3. Feature
4. Primary Location
5. Existing implementation
6. Duplicate implementation
7. Permission
8. API/RPC
9. Database impact
10. RLS impact
```

---

# 4. No Unauthorized Architecture Changes

Không tự ý:

- Đổi framework
- Thêm bundler
- Chuyển Vanilla JS sang React
- Đổi Supabase architecture
- Đổi auth
- Đổi RLS
- Đổi RPC
- Đổi database
- Đổi manifest
- Đổi business flow

trừ khi task yêu cầu.

---

# 5. No Duplicate UI

Trước khi tạo component/page:

```text
Search existing code.
```

Nếu đã có:

```text
reuse
```

Không tạo:

```text
Button2
ModalNew
NewTable
AdminCardV2
```

chỉ vì page mới.

---

# 6. No Duplicate Feature

Nếu feature đã tồn tại:

```text
reuse
move
or improve
```

Không tạo implementation thứ hai.

---

# 7. Scope Discipline

Nếu task là:

```text
Redesign Admin Users
```

không được tự ý sửa:

```text
Orders
AI
RLS
Database
Extension parser
```

trừ khi phát hiện blocker trực tiếp.

---

# 8. Preserve Existing Business Flow

Không phá:

```text
Paste
→ Parse
→ AI
→ Review
→ Fill
```

---

# 9. UI State Completeness

Mỗi page phải kiểm tra:

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

---

# 10. Feedback

Không dùng:

```javascript
alert()
```

cho normal UX.

Ưu tiên:

```text
Toast
Inline validation
Dialog
Drawer
Error state
```

---

# 11. Destructive Actions

Các hành động sau phải confirmation:

```text
Delete
Disable
Remove
Revoke
Reset
Rotate Secret
```

---

# 12. Security

Không đưa secret vào frontend.

Không đưa:

```text
SUPABASE_SERVICE_ROLE_KEY
GROQ_SECRET_KEY
```

vào:

```text
HTML
JS
CSS
Extension
Git repository
```

---

# 13. Permission

Frontend permission chỉ dùng để:

```text
visibility
UX
navigation
```

Không dùng frontend để bảo vệ dữ liệu.

Backend phải enforce:

```text
JWT
RLS
RPC
Edge Function
```

---

# 14. File Editing

Ưu tiên:

```text
small targeted change
```

Không rewrite toàn bộ file nếu chỉ sửa một component.

Trước khi sửa:

```text
Read relevant code.
Understand dependencies.
Change only necessary lines.
```

---

# 15. No Fake Functionality

Không tạo UI button nếu backend chưa có capability thật.

Không được tạo:

```text
Save
Delete
Rotate
Export
Sync
```

mà không có implementation thật.

Nếu feature chưa có backend:

```text
TODO / Not implemented
```

phải rõ ràng.

---

# 16. Error Handling

Không hiển thị raw error:

```text
operator does not exist: integer = uuid
```

cho end user.

Map thành:

```text
Không thể thực hiện thao tác.
Vui lòng thử lại.
```

Log technical error ở developer console hoặc telemetry phù hợp.

---

# 17. Completion Report

Sau mỗi task, AI phải báo:

```text
Changed:
- ...

Not changed:
- ...

Files:
- ...

Backend impact:
- None / ...

Security impact:
- None / ...

Tests:
- ...
```

---

# 18. Definition of Done

```text
[ ] Correct portal
[ ] Correct navigation
[ ] No duplicate feature
[ ] Existing flow preserved
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Permission state
[ ] Success feedback
[ ] Confirmation when required
[ ] Responsive where required
[ ] No console errors
[ ] No unrelated refactor
[ ] No unauthorized DB/RPC/RLS changes
```

---

# 19. STOP Conditions

AI phải STOP và yêu cầu clarification nếu:

- Không biết feature thuộc portal nào.
- Có hai implementation cạnh tranh.
- Cần thay đổi DB ngoài scope.
- Cần thay đổi RLS.
- Cần thay đổi RPC.
- Không rõ permission.
- Không rõ Primary Location.
- UI request mâu thuẫn với UI_UX_MASTER_PLAN.

Không được tự đoán kiến trúc quan trọng.

---

# 20. Preferred Development Style

```text
Inspect
 ↓
Plan
 ↓
Confirm architecture
 ↓
Small change
 ↓
Run/test
 ↓
Review
 ↓
Next task
```

Không:

```text
Prompt
 ↓
Rewrite entire project
```
