# ENTERPRISE_DESIGN_SYSTEM.md

## 1. Design Language

Style: - Clean - Enterprise - Minimal - Data-first - Professional -
Calm - High information density - Low visual noise

Do not use a flashy visual language, excessive gradients, glassmorphism,
giant hero sections, or excessive shadows.

## 2. Reference Baseline

The supplied reference uses: - Inter - white workspace - light gray
borders - subtle blue brand states - 260px sidebar - 64px header -
rounded controls/cards - light shadows - table-centric management UI

These are the baseline visual principles for this system.

## 3. Color Tokens

``` css
--color-bg: #F9FAFB;
--color-surface: #FFFFFF;

--brand-50: #EFF6FF;
--brand-100: #DBEAFE;
--brand-200: #BFDBFE;
--brand-500: #3B82F6;
--brand-600: #2563EB;
--brand-700: #1D4ED8;
--brand-900: #1E3A8A;

--text-primary: #111827;
--text-secondary: #374151;
--text-muted: #6B7280;
--text-placeholder: #9CA3AF;

--border-subtle: #F3F4F6;
--border-default: #E5E7EB;
```

Semantic colors should be mapped consistently: - success - warning -
danger - info - neutral

Never rely on color alone.

## 4. Typography

Primary font: - Inter

Recommended hierarchy: - Metadata: 12px - Body: 14px - Body large:
16px - Section: 20px - Heading: 24px - KPI: 28--32px - Page title:
32--36px

Font weights: - 400 body - 500 labels - 600 controls/section headings -
700 major headings

Avoid too many font sizes.

## 5. Spacing

Use an 8px-based scale:

``` text
4
8
12
16
20
24
32
40
48
64
```

Do not invent arbitrary values unless required by the component.

## 6. Radius

``` text
Button/Input: 8px
Card: 12px
Drawer: 12px
Modal: 12px
Badge/Avatar: full
```

## 7. Shadows

Default: - none or subtle shadow-sm

Use borders and spacing for hierarchy. Avoid large floating shadows.

## 8. Grid

Desktop: - 12 columns

Tablet: - 8 columns

Mobile: - 4 columns

Recommended dashboard patterns:

``` text
KPI: 3 + 3 + 3 + 3

Main analysis:
8 + 4

Two analysis panels:
6 + 6

Full-width:
12
```

## 9. Core Components

``` text
AppShell
Sidebar
Header
Breadcrumb
PageHeader

GlobalSearch
CommandMenu
HelpMenu
NotificationCenter
UserMenu

Tabs
FilterBar
SearchInput
DateRangePicker

MetricCard
ChartCard
AlertPanel

DataTable
StatusBadge
Pagination
BulkActionBar

Drawer
Modal
Dropdown
Tooltip
Toast

Skeleton
EmptyState
ErrorState
Confirmation
```

## 10. Buttons

Primary: - main action - brand-600 background - white text

Secondary: - white background - border - neutral text

Tertiary: - text/ghost

Danger: - reserved for destructive actions

Button hierarchy must match task importance.

## 11. Inputs

Inputs: - 8px radius - clear label - visible focus state - placeholder
only as supplementary guidance - validation message below field

Search inputs may use leading search icon.

## 12. Tabs

Use tabs for closely related datasets: - Active / All - Orders by
status - Notification categories

Active tab: - brand text - subtle bottom border or equivalent indicator

Do not use tabs as primary navigation.

## 13. Cards

Use cards for logical grouping.

Do not wrap every element in a card. Avoid card-inside-card. Avoid "card
soup."

## 14. Data Table

Header: - muted text - 13--14px - medium weight

Cells: - 14px - primary text for important values - muted text for
supporting metadata

Alignment: - text left - numeric values right - actions right - status
uses consistent badge

Row hover may be subtle.

## 15. Status Badge

Structure:

``` text
[Status]
```

Optional icon for accessibility/clarity.

Statuses must have consistent semantic mapping throughout the
application.

## 16. Notification Components

``` text
NotificationBell
NotificationBadge
NotificationPopover
NotificationItem
NotificationFilters
NotificationDrawer
NotificationSettings
```

Notification item: - icon/state - title - message - timestamp - unread
indicator - optional action

## 17. User Components

``` text
UserAvatar
UserIdentity
UserMenu
ProfileHeader
ProfileForm
SecurityPanel
SessionList
```

User menu should remain compact.

## 18. Forms

Form hierarchy:

``` text
Section
Description
Field
Help text
Validation
```

Long forms should be grouped into sections.

Save behavior: - clear Save/Cancel - disabled state while saving -
success feedback - preserve user input on recoverable failure

## 19. Drawer

Use for: - order preview - customer preview - product quick detail -
notification detail

Drawer should include: - title - close - key information - contextual
actions - full-page link where appropriate

## 20. Modal

Use for: - confirmation - destructive action - short form - quick edit

Do not place complex workflows inside modal.

## 21. Toast

Use for: - saved - created - updated - restored

Do not use toast as the only channel for critical alerts.

## 22. Motion

Motion should be: - subtle - fast - functional

Use animation to clarify: - opening/closing - state transition -
loading - navigation

Do not animate every component.

## 23. Iconography

Use one icon system consistently. If the project already uses Font
Awesome, keep it consistent instead of mixing several icon libraries.

Icon-only controls require accessible labels.

## 24. Responsive Rules

Desktop: - full sidebar - full toolbar

Tablet: - collapsed sidebar - controls may wrap

Mobile: - navigation drawer - stacked controls - compact header -
horizontal table scroll or list transformation

## 25. Dark Mode

If implemented: - define semantic tokens, not component-specific
colors - preserve contrast - do not simply invert colors

Supported modes: - Light - Dark - System

## 26. Component API Principle

Components must be configurable rather than duplicated.

Prefer:

``` tsx
<DataTable
  columns={columns}
  data={data}
  filters={filters}
  actions={actions}
/>
```

over multiple copies of nearly identical tables.

## 27. Definition of Done

A component is complete when: - visual states exist - interaction states
exist - keyboard behavior works - responsive behavior works - permission
behavior is defined - loading/empty/error behavior is defined -
component is reusable - design tokens are used
