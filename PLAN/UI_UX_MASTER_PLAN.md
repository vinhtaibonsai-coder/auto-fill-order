# UI_UX_MASTER_PLAN.md

## 1. Purpose

This document is the product-wide UI/UX source of truth for the
Enterprise SaaS Dashboard.

Design direction: clean enterprise SaaS, data-first, calm, predictable,
actionable, inspired by the supplied Rhombus-style reference.

The reference establishes a white workspace, 260px sidebar, 64px header,
Inter typography, light borders, blue primary actions, grouped
navigation, tabs, search/filter/actions, tables and pagination.

## 2. UX North Star

Every screen should help the user:

CONTEXT → UNDERSTAND → SCAN → FILTER → INVESTIGATE → ACT

A dashboard is not a collection of widgets. It is an operational
decision surface.

## 3. Product Areas

-   Dashboard
-   Orders
-   Customers
-   Inventory
-   Products
-   Stock Control
-   Reports
-   Intelligence
-   Apps / Integrations
-   Notifications
-   Settings
    -   Profile
    -   Account
    -   Security
    -   Sessions
    -   Notifications
    -   Appearance

## 4. Global App Shell

``` text
AppShell
├── Sidebar
├── Header
│   ├── Global Search
│   ├── Help
│   ├── Notification Center
│   └── User Menu
└── Main Content
```

Desktop shell: - Sidebar: 260px - Header: 64px - Main content: max-width
\~1400px - Desktop page padding: 48px - Tablet: 32px - Mobile: 16px

## 5. Navigation

Sidebar: - Dashboard - Orders - Inventory - Customers - Stock Control -
B2B eCommerce - Reporting - Intelligence - Apps - Settings

Navigation groups may expand/collapse. Active item uses subtle brand
background and brand text. Collapsed sidebar: \~72px, icon + tooltip.

Navigation must be permission-aware.

## 6. Global Header

Header contains: - Global Search - Help - Notification Bell - User
Avatar / Name / Role

Global search should support: - orders - customers - products - SKU -
tracking numbers - phone/email - pages - settings

Command menu: - Ctrl/Cmd + K - navigation - create actions - search -
settings - notifications - profile - logout

## 7. Notification Center

Required features: - unread badge - popover - all/unread/category
filtering - mark read - mark all read - deep link to related entity -
realtime updates - notification settings

Categories: - Order - Inventory - Payment - Shipping - Customer -
System - Security - Staff - Integration - Report

Priorities: - info - success - warning - critical

Notification entity: - id - user_id - shop_id - type - category -
priority - title - message - entity_type - entity_id - action_url -
is_read - read_at - created_at

## 8. User Profile

User menu: - My Profile - Account Settings - Notification Settings -
Security - Appearance - Help & Support - Sign out

Profile: - avatar - full name - username - email - phone - role -
department - language - timezone

Security: - password - 2FA - active sessions - login history - trusted
devices - logout all devices

## 9. Page Architecture

Standard page:

``` text
Page Header
├── Breadcrumb (optional)
├── Title
├── Description (optional)
├── Primary Action
└── Secondary Actions

Tabs (optional)

Toolbar
├── Search
├── Filters
├── Sort
├── Export
└── Create / Primary Action

Content
└── Table / Cards / Charts / Forms
```

## 10. Dashboard UX

Dashboard hierarchy: 1. Context 2. Primary KPIs 3. Main trend 4. Alerts
/ exceptions 5. Secondary analysis 6. Recent activity 7. Drill-down

Primary KPI count: normally 4--6.

Every metric must have context: - current period - comparison period -
unit - trend where meaningful

Every important alert should be actionable.

## 11. Tables

Use tables for operational data: - Orders - Products - Customers -
Users - Inventory - Transactions

Required capabilities as appropriate: - search - filters - sorting -
pagination - selection - bulk actions - row actions - status -
responsive handling

Use a reusable DataTable rather than page-specific table
implementations.

## 12. States

Every asynchronous surface must support: - loading - empty - error -
success - partial failure

Use skeletons for page/component loading. Do not blank the whole page
when only one widget is loading.

## 13. Interaction Patterns

Use: - Drawer for contextual detail - Modal for confirmation/small
forms - Toast for short-lived success feedback - Dropdown for secondary
actions - Tooltip for icon-only controls - Command menu for fast
navigation

Avoid excessive modals and nested dialogs.

## 14. Responsive

Desktop: - 260px sidebar - 12-column grid

Tablet: - collapsed sidebar - 8-column layout

Mobile: - drawer navigation - compact header - 4-column base grid -
cards stack - tables become horizontal scroll or responsive list

Do not simply shrink desktop UI.

## 15. Accessibility

Required: - semantic HTML - keyboard navigation - visible focus - ARIA
labels - sufficient contrast - screen-reader compatible controls - never
use color alone to convey status

## 16. Performance

Required where applicable: - server-side pagination - server-side
filtering/sorting - debounced search - caching - lazy loading -
virtualization for large tables - scoped queries - minimal rerenders

Never fetch the entire dataset to render a small page.

## 17. Permission-aware UI

Permissions may include: - canView - canCreate - canEdit - canDelete -
canExport - canManageUsers - canManageSettings

Frontend permissions improve UX only. Backend authorization and RLS
remain the security boundary.

## 18. Design Quality Gate

Before a page is complete:

-   hierarchy is clear
-   primary action is obvious
-   filters are understandable
-   data has context
-   loading/empty/error states exist
-   responsive behavior is intentional
-   permissions are respected
-   reusable components are used
-   no duplicated visual language
-   no decorative component without purpose
