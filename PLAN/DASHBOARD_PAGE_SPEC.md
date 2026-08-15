# DASHBOARD_PAGE_SPEC.md

## 1. Objective

The Dashboard is the operational command center.

Primary user questions: 1. What is happening? 2. Is performance
improving? 3. What needs attention? 4. Why is it happening? 5. What
should I do next?

## 2. Page Structure

``` text
Dashboard
├── Page Header
│   ├── Title
│   ├── Context
│   ├── Date Range
│   ├── Shop Selector
│   └── Refresh
│
├── KPI Grid
│   ├── Revenue
│   ├── Orders
│   ├── Profit
│   ├── Success Rate
│   └── optional metrics
│
├── Main Trend
│   └── Revenue / Orders / Profit
│
├── Attention Required
│   ├── Delayed Orders
│   ├── Low Stock
│   ├── Failed Shipments
│   └── Integration Problems
│
├── Secondary Analysis
│   ├── Orders by Status
│   └── Inventory / Product analysis
│
├── Quick Actions
│   ├── Create Order
│   ├── Add Product
│   ├── Import
│   └── Create Shipment
│
└── Recent Orders
```

## 3. Above-the-Fold Priority

First viewport should expose: - page context - date range - primary
KPIs - critical alerts if present - main trend

Do not place decorative onboarding/marketing content above critical
business data.

## 4. Header

Example:

``` text
Dashboard

Monitor your shop performance and operations.

[Today ▼] [Shop ABC ▼] [Refresh]
```

If only one shop is available, do not show an unnecessary selector.

## 5. Date Range

Presets: - Today - Yesterday - Last 7 days - Last 30 days - This month -
Last month - Custom

If comparison is enabled: - current period - previous equivalent period

Comparison text must state what it compares against.

## 6. KPI Cards

Default: - Revenue - Orders - Profit - Success Rate

Optional: - Pending Orders - Inventory Value - Shipping Cost - Refunds

Card structure:

``` text
Revenue
125.4M VND
↑ 12.4%
vs previous period
```

Do not overload KPI cards with multiple charts/actions.

## 7. KPI Behavior

KPI click may drill down to the relevant page.

Examples: - Revenue → Reports - Orders → Orders - Pending Orders →
filtered Orders - Low Stock → Inventory

If there is no useful destination, do not make the KPI look clickable.

## 8. Main Trend Chart

Primary chart: - revenue over time

Optional toggles: - Revenue - Orders - Profit

Chart must answer: - Is performance rising/falling? - Where did changes
occur? - What period is being analyzed?

Avoid charts with no decision purpose.

## 9. Chart Selection

Trend: - line / area

Category comparison: - bar

Composition: - stacked bar

Pie/donut: - only for small category counts and when composition is the
actual question

## 10. Attention Required

Use exception-first design.

Example:

``` text
Attention Required

18 delayed orders                 [View]
12 products below stock threshold [Review]
7 failed shipments                [Investigate]
VNPost integration disconnected   [Reconnect]
```

Each alert should provide an action where possible.

## 11. Alert Priority

Sort by: 1. critical 2. warning 3. informational

Do not show old low-priority alerts above urgent operational problems.

## 12. Quick Actions

Maximum recommended: 4--6.

Examples: - Create Order - Add Product - Import Orders - Create
Shipment - Add Customer

Actions should reflect the user's most common next steps.

## 13. Secondary Analysis

Recommended: - Orders by status - Top products - Sales by channel -
Inventory alerts - Shipping carrier performance

Do not add all analytics to the home dashboard.

Advanced analytics belong in Reporting/Intelligence.

## 14. Recent Orders

Table columns:

``` text
Order
Customer
Amount
Payment
Shipping
Status
Created
Action
```

Actions: - view - open detail - more

Use pagination or a limited recent set.

## 15. Drill-Down Model

``` text
Dashboard
↓
Metric
↓
Breakdown
↓
Filtered list
↓
Record
↓
Detail
```

Example:

``` text
Revenue
↓
Revenue by shop
↓
Shop ABC
↓
Orders
↓
Order #VN123
```

## 16. Detail Drawer

Clicking a recent order may open a drawer:

``` text
Order #VN123

Customer
Items
Payment
Shipping
Timeline

[Open full order]
```

Use drawer when the user needs context without losing dashboard
position.

## 17. Dashboard Filters

Primary: - date - shop

Secondary: - channel - carrier - status - product - customer

Do not put every filter in the main toolbar.

Use More Filters for secondary filters.

## 18. Filter State

Always show active filter context.

Example:

``` text
Last 30 days
Shop: ABC
Status: Delivered

[Clear all]
```

## 19. Loading

Dashboard should use component-level skeletons.

Example: - KPI skeleton - chart skeleton - alert skeleton - table
skeleton

Do not block the entire dashboard when only one data source is loading.

## 20. Empty Dashboard

Example:

``` text
No business data yet

Create your first order or import your existing orders
to start seeing performance data.

[Create Order]
[Import Orders]
```

## 21. Error State

Example:

``` text
Unable to load revenue data.

Your other dashboard sections are still available.

[Retry]
```

A single failed widget must not destroy the whole dashboard.

## 22. Realtime

Realtime events: - new order - order status change - inventory
threshold - shipment update - notification

Update only affected widgets.

Do not reload the entire page.

## 23. Refresh

Provide manual refresh where data freshness matters.

Optional: - last updated timestamp - auto-refresh state

Example:

``` text
Updated 20 seconds ago
↻
```

## 24. Responsive Layout

Desktop:

``` text
KPI: 4 columns
Main chart: 8 + 4
Secondary: 6 + 6
Recent orders: 12
```

Tablet: - KPI 2 columns - charts stack or 6+6 - tables may scroll

Mobile: - KPI 1--2 per row - charts full width - alerts stacked -
actions stack/wrap - table scrolls or becomes list

## 25. Dashboard Data Contracts

Prefer scoped data functions:

``` text
getDashboardMetrics()
getRevenueTrend()
getDashboardAlerts()
getOrderStatusBreakdown()
getRecentOrders()
```

Do not implement:

``` text
getEverything()
```

## 26. Suggested Data Model

Metrics:

``` text
period
current_value
previous_value
change_percent
unit
```

Alert:

``` text
id
severity
category
title
message
entity_type
entity_id
action_url
created_at
```

## 27. Permission Rules

Dashboard visibility must respect: - shop_id - role - permissions - user
scope

Examples: - user can see only their shop - manager may see shop
analytics - system admin may see cross-shop analytics

Do not rely on frontend filtering for data isolation.

## 28. Performance

Use: - server-side aggregation - cached dashboard metrics - parallel
scoped queries - lazy loading for secondary sections - pagination for
recent orders - memoization where meaningful

Avoid loading thousands of raw records to calculate a KPI in the
browser.

## 29. Accessibility

Charts must provide accessible summaries or data tables where
appropriate.

Icon-only controls: - aria-label

Status: - text + semantic visual indicator

Keyboard: - all controls reachable - focus visible

## 30. Dashboard Acceptance Criteria

### UX

-   [ ] User understands context immediately
-   [ ] KPI hierarchy is obvious
-   [ ] Critical problems are visible
-   [ ] Important metrics have context
-   [ ] Drill-down is logical
-   [ ] Actions are actionable

### UI

-   [ ] Uses Enterprise Design System
-   [ ] Uses consistent shell
-   [ ] Uses consistent spacing
-   [ ] Uses semantic colors
-   [ ] No card soup
-   [ ] No decorative charts

### Data

-   [ ] Correct date filtering
-   [ ] Correct shop scope
-   [ ] Correct comparison
-   [ ] Server-side aggregation where appropriate
-   [ ] No unnecessary data fetching

### States

-   [ ] Loading
-   [ ] Empty
-   [ ] Error
-   [ ] Partial failure
-   [ ] Realtime update

### Responsive

-   [ ] Desktop
-   [ ] Tablet
-   [ ] Mobile

### Security

-   [ ] Permission-aware
-   [ ] Shop scope enforced
-   [ ] Backend/RLS remains authoritative

## 31. AI Vibe Coding Instruction

When implementing this Dashboard:

1.  Inspect the existing repository first.
2.  Reuse the existing AppShell and Design System.
3.  Do not create a second sidebar/header.
4.  Do not invent a new color palette.
5.  Do not add charts without a business question.
6.  Use real data contracts rather than fake production data.
7.  Implement loading, empty, error and partial failure states.
8.  Implement permission-aware visibility.
9.  Preserve shop scope.
10. Optimize queries before optimizing visual details.
11. Test desktop/tablet/mobile.
12. Audit the page against this document before declaring done.

Definition of Done:

``` text
UX ✓
UI ✓
Data ✓
States ✓
Interaction ✓
Responsive ✓
Accessibility ✓
Performance ✓
Permissions ✓
Security ✓
```
