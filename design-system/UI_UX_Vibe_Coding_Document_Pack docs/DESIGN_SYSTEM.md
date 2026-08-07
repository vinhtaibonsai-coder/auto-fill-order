# DESIGN SYSTEM
## VNPost & J&T Order Automation Platform

**Status:** Baseline

---

# 1. Design Principles

1. Clean
2. Fast
3. Consistent
4. Data-first
5. Minimal cognitive load
6. Enterprise but not visually heavy
7. Clear status and feedback
8. Keyboard-friendly where useful

---

# 2. Layout

## Admin

```text
┌──────────────┬─────────────────────────────┐
│ Sidebar      │ Header                      │
│              ├─────────────────────────────┤
│ Navigation   │ Breadcrumb / Page title     │
│              │                             │
│              │ Main content                │
│              │                             │
└──────────────┴─────────────────────────────┘
```

## Extension

Compact panel.

Không dùng full dashboard pattern.

---

# 3. Core Components

Required reusable components:

```text
AppShell
Sidebar
Topbar
Breadcrumb
PageHeader
Card
StatCard
Table
DataTable
FilterBar
SearchInput
Pagination
Tabs
Badge
Button
IconButton
Input
Select
Textarea
Checkbox
Switch
Modal
Drawer
Dropdown
Tooltip
Toast
Alert
Skeleton
EmptyState
ErrorState
ConfirmDialog
```

---

# 4. Buttons

Semantic variants:

```text
Primary
Secondary
Ghost
Danger
Success
```

Không tạo button style mới cho từng page.

---

# 5. Status

Status phải có:

- Text
- Visual indicator

Không chỉ dùng màu.

Ví dụ:

```text
● Active
● Disabled
● Pending
● Failed
● Submitted
```

---

# 6. Tables

Table phải hỗ trợ nếu phù hợp:

- Search
- Filters
- Sort
- Pagination
- Row actions
- Empty state
- Loading skeleton
- Error state

Không nhồi quá nhiều column.

Ưu tiên:

```text
Primary information
→ Secondary information
→ Row actions
```

---

# 7. Detail View

Ưu tiên:

```text
Page
```

hoặc:

```text
Drawer
```

cho detail ngắn.

Modal chỉ dùng cho:

- Confirm
- Short form
- Quick edit

Không dùng modal cho page-sized content.

---

# 8. Forms

Form phải có:

```text
Label
Description nếu cần
Input
Validation
Error
Save
Cancel
```

Không chỉ dựa vào placeholder.

---

# 9. Loading

Không dùng màn hình trắng.

Ưu tiên:

```text
Skeleton
```

cho data-heavy page.

Button saving:

```text
Saving...
```

và disable duplicate submit.

---

# 10. Empty State

Phải trả lời:

```text
What happened?
Why empty?
What can user do?
```

Ví dụ:

```text
No orders yet.

Create your first order from the Extension.
```

---

# 11. Error State

Error phải có:

```text
What happened
What user can do
Retry nếu phù hợp
```

Không expose raw SQL/RPC error cho end user.

---

# 12. Toast

Dùng cho:

- Save success
- Update success
- Delete success
- Background operation result

Không dùng toast cho lỗi cần user action dài.

---

# 13. Modal

Bắt buộc confirmation cho destructive action.

Nội dung phải rõ:

```text
Title
Impact
Action
Cancel
Confirm
```

Không dùng:

```text
Are you sure?
```

mà không nói rõ hành động.

---

# 14. Drawer

Dùng cho:

- Audit detail
- User quick detail
- Order quick detail
- Activity detail

---

# 15. Responsive

Desktop Admin:

```text
Sidebar fixed
Content flexible
```

Mobile:

```text
Sidebar collapses
Tables may become cards or horizontal scroll
```

Không ép table nhỏ đến mức khó đọc.

---

# 16. Accessibility

Required:

- Keyboard accessible
- Focus visible
- Labels
- Semantic HTML
- ARIA only when necessary
- Escape closes dialogs where appropriate
- Focus trap for modal
- No color-only status

---

# 17. Design Token Rule

Nếu project đã có CSS variables, ưu tiên tái sử dụng.

Không tạo magic values rải rác:

```css
margin: 13px;
padding: 17px;
border-radius: 11px;
```

Thay bằng design tokens.

Ví dụ:

```css
--space-1
--space-2
--space-3
--radius-sm
--radius-md
--radius-lg
```

Không thay toàn bộ existing CSS chỉ vì muốn đổi style nếu không nằm trong scope.
