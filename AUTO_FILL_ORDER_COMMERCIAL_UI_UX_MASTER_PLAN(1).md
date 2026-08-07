# AUTO FILL ORDER — COMMERCIAL UI/UX & FUNCTION MASTER PLAN

**Version:** 1.0  
**Status:** Proposed Commercial Architecture  
**Scope:** `index/panel` + `options` + `admin-dashboard`

## 1. Product Boundary

```text
INDEX / PANEL
= DO THE WORK
= Worker Workspace

OPTIONS
= CONFIGURE THE SHOP
= Shop Control Center

ADMIN
= OPERATE THE PLATFORM
= SaaS Control Plane
```

| Interface | Primary users | Main purpose |
|---|---|---|
| Index / Panel | Staff | Create, review and autofill orders |
| Options | Owner / Manager | Configure shop, team, AI, carriers, sync |
| Admin Dashboard | System Admin | Operate the entire SaaS platform |

---

# 2. INDEX / PANEL

## Main navigation

```text
Dashboard
Create Order
Orders
Customers
Address
History
Sync
Notifications
Account
```

## Dashboard

Show only work-related information:

```text
Orders Today
Completed
Failed
Pending Sync
AI Status
Cloud Status
```

Primary CTA:

```text
⚡ CREATE ORDER
```

## Create Order

Input sources:

```text
Paste text
Paste image
Upload image
Clipboard
Facebook message
Zalo copied text
Manual input
```

Pipeline:

```text
RAW ORDER
    ↓
AI PARSER
    ↓
STRUCTURED ORDER
    ↓
ADDRESS ENGINE
    ↓
REVIEW
    ↓
AUTOFILL
    ↓
VERIFY
    ↓
SUBMIT
```

## AI Review

Show confidence per field:

```text
Name          98% ✓
Phone         99% ✓
Address       83% ⚠
Ward          96% ✓
Province      99% ✓
```

Low-confidence fields require review.

## Address Engine

```text
Raw Address
    ↓
Normalized Address
    ↓
Current Administrative Unit
    ↓
Carrier Mapping
```

Display:

```text
Raw
Normalized
Province
Ward
Confidence
Source
```

## Autofill Center

```text
Detect Carrier
      ↓
Find Form
      ↓
Fill Customer
      ↓
Fill Address
      ↓
Fill Product
      ↓
Fill COD
      ↓
Verify
```

Carrier architecture:

```text
CarrierAdapter
├── VNPost
├── J&T
├── GHN
├── GHTK
└── Viettel Post
```

## Order History

Filters:

```text
Carrier
Status
Staff
Date
Customer
Phone
```

Statuses:

```text
Draft
Ready
Autofilled
Submitted
Failed
Sync Pending
```

## Customer Mini CRM

```text
Name
Phone
Latest Address
Order Count
Total Value
Last Order
Notes
```

## Sync Center

```text
Cloud Connected
```

or:

```text
Cloud Offline
3 orders pending sync
```

States:

```text
Pending
Processing
Failed
Completed
```

## Notifications

```text
AI quota low
AI error
Cloud offline
Orders pending sync
Low address confidence
Carrier DOM changed
Extension update
Subscription warning
```

---

# 3. OPTIONS — SHOP CONTROL CENTER

Options is not the order workspace.

## Main navigation

```text
GENERAL
├── Shop Profile
├── General Settings
└── Workspace

TEAM
├── Members
├── Roles
└── Permissions

AI
├── AI Settings
├── Usage
├── Quota
└── Prompt Policy

ADDRESS
├── Address Engine
├── Dataset
├── Alias
└── Learning

CARRIERS
├── VNPost
├── J&T
└── Carrier Settings

ORDER
├── Defaults
├── COD
├── Product
└── Workflow

SYNC
├── Cloud
├── Devices
└── Sync Policy

NOTIFICATIONS
├── Alerts
└── Preferences

SECURITY
├── Sessions
├── Devices
└── Security

AUDIT
├── Activity
└── Logs

SUBSCRIPTION
├── Plan
├── Usage
├── Billing
└── Invoices

ADVANCED
└── Diagnostics
```

## Shop Profile

```text
Shop Name
Shop Code
Logo
Phone
Email
Address
Timezone
Currency
Language
```

## Team

Owner / Manager can:

```text
Invite Member
Remove Member
Suspend Member
Reset Access
```

Member data:

```text
Name
Username
Role
Status
Last Active
Device
```

## Roles

Recommended:

```text
OWNER
MANAGER
STAFF
VIEWER
```

Permission matrix:

| Permission | OWNER | MANAGER | STAFF | VIEWER |
|---|---:|---:|---:|---:|
| Create Order | ✓ | ✓ | ✓ | - |
| View Orders | ✓ | ✓ | ✓ | ✓ |
| Edit Order | ✓ | ✓ | ✓ | - |
| Delete Order | ✓ | ✓ | - | - |
| Customers | ✓ | ✓ | ✓ | ✓ |
| AI Settings | ✓ | ✓ | - | - |
| Team | ✓ | ✓ | - | - |
| Billing | ✓ | - | - | - |
| Audit | ✓ | ✓ | - | ✓ |
| Shop Settings | ✓ | ✓ | - | - |
| Device Management | ✓ | ✓ | - | - |

## AI Settings

Do not expose Groq secret keys to users.

Show:

```text
AI Status
AI Plan
Monthly Usage
Remaining Quota
Model Policy
Order Parsing
Address Normalization
Image Parsing
```

Model/provider policy should be controlled by the platform.

## AI Usage

Metrics:

```text
Requests
Tokens
Successful
Failed
Average Latency
429
Timeout
```

## Address Engine

Owner can view:

```text
Dataset Version
Current Administrative Data
Last Update
Alias Count
Learning Count
Accuracy
```

Allow:

```text
Custom Alias
Shop-specific Mapping
Correction
Feedback
```

Separate:

```text
Shop Learning
Global Dataset
```

Shop users must never directly overwrite the global production dataset.

## Carrier Settings

Per carrier:

```text
Status
Connected
Enabled
Default
Field Mapping
Carrier Preference
Default Service
COD
```

## Order Workflow

Example:

```text
Auto Parse                 ☑
Auto Normalize Address    ☑
Review if Confidence <90% ☑
Auto Fill                  ☑
Auto Submit                ☐
```

Auto-submit should not be enabled by default because of order-error risk.

## Default Order

```text
Default Carrier
Default Package Type
Default Weight
Default Quantity
Default COD
Default Product
Default Note
```

## Device Management

```text
Device
User
Browser
Last Active
Status
```

Actions:

```text
Revoke
Rename
Sign Out
```

Plan enforcement:

```text
Plan allows 5 devices
3 / 5 used
```

## Audit

```text
Who
Action
Object
Time
Device
Result
```

## Subscription

```text
Current Plan
Users Used / Limit
AI Usage / Quota
Devices Used / Limit
Renewal Date
```

Actions:

```text
Upgrade
Manage Subscription
Invoices
Payment Method
```

---

# 4. ADMIN DASHBOARD — SaaS CONTROL PLANE

Admin is not a shop order workspace.

## Main navigation

```text
Overview

Shops
├── All Shops
├── Active
├── Trial
├── Suspended
└── Churned

Users
├── Users
├── Staff
└── Sessions

Subscriptions
├── Plans
├── Subscriptions
├── Usage
└── Billing

AI Platform
├── Usage
├── Models
├── Rate Limits
├── Quotas
└── Provider Health

Features
├── Feature Flags
├── Rollouts
└── Experiments

Address
├── Dataset
├── Versions
├── Updates
└── Learning

Carriers
├── VNPost
├── J&T
├── Integrations
└── Health

Devices
├── All Devices
├── Online
└── Revoked

Security
├── Sessions
├── Audit
├── RLS Health
└── Security Events

System Health
├── Supabase
├── AI Gateway
├── Groq
├── Sync
└── Carrier

Support
├── Tickets
├── Issues
└── Customer Requests

System
├── Config
├── Maintenance
└── Releases
```

## Admin Overview

Must answer immediately:

```text
Is the system healthy?
How many active shops?
Are there errors?
Is AI healthy?
Which shops are near quota?
Which subscriptions are expiring?
```

Cards:

```text
Active Shops
Active Users
Orders Today
AI Requests
AI Success Rate
Sync Failures
System Errors
MRR
```

## Shop Management

Table:

```text
Shop
Plan
Users
Devices
Orders
AI Usage
Status
Created
Last Active
```

Actions:

```text
Open
Suspend
Activate
Support Access
Change Plan
Reset Device
View Logs
```

Support access / impersonation must be:

```text
Explicitly authorized
Time-limited
Fully audited
```

## Shop Detail

```text
Overview
Users
Orders
Usage
AI
Devices
Audit
Subscription
Feature Flags
Diagnostics
```

Admin can inspect health but should not arbitrarily modify customer business data.

---

# 5. SUBSCRIPTION / COMMERCIAL MODEL

Suggested plans:

```text
FREE
STARTER
PRO
BUSINESS
ENTERPRISE
```

Each plan can define:

```text
Users
Devices
AI Requests
Vision Requests
Orders
Retention
Carriers
Support Level
```

Example structure:

```text
FREE
├── 1 user
├── 1 device
└── Basic AI quota

STARTER
├── 3 users
├── 2 devices
└── Standard AI quota

PRO
├── 10 users
├── 5 devices
└── Advanced AI quota

BUSINESS
├── 30 users
├── 15 devices
└── Priority Support

ENTERPRISE
├── Custom users
├── Custom quota
├── SLA
└── Custom integrations
```

Actual pricing and quotas must be calculated from real AI/provider costs.

---

# 6. ADMIN — AI PLATFORM

Never manage provider secrets in the browser client.

Admin needs:

```text
Provider
Status
Current Models
Latency
Error Rate
RPM
TPM
Quota
```

Model registry:

```text
Task
Provider
Model
Status
Priority
Fallback
```

Health:

```text
AI Gateway       Healthy
Provider         Healthy
Average Latency  820ms
Success          99.2%
429              0.3%
5xx              0.1%
Timeout          0.4%
```

---

# 7. FEATURE FLAGS

Required for safe SaaS releases.

Examples:

```text
address_engine_v2
ai_vision
sync_v2
carrier_v2
new_panel
new_options
```

Scope:

```text
GLOBAL
PLAN
SHOP
USER
```

Rollout:

```text
0%
10%
25%
50%
100%
```

---

# 8. ADDRESS DATASET MANAGEMENT

Production dataset must be versioned.

Flow:

```text
Upload Dataset
      ↓
Validate
      ↓
Preview Diff
      ↓
Test
      ↓
Publish
      ↓
Monitor
      ↓
Rollback if required
```

Never:

```text
Upload → overwrite production
```

Required:

```text
Current Version
Previous Version
Import
Validate
Diff
Publish
Rollback
```

---

# 9. SYSTEM HEALTH

Health checks:

```text
Supabase
Auth
Database
RLS
AI Gateway
Groq
Storage
Sync
Extension API
```

Statuses:

```text
Healthy
Degraded
Down
```

---

# 10. SUPPORT CENTER

Ticket fields:

```text
Ticket
Shop
User
Priority
Status
Assigned
Created
Updated
```

Types:

```text
Login
AI
Address
Carrier
Sync
Billing
Feature
Bug
```

---

# 11. SYSTEM AUDIT

Admin audit must capture:

```text
Admin
Action
Target
Before
After
Reason
IP Metadata
Timestamp
```

Sensitive actions:

```text
Change Plan
Suspend Shop
Impersonate
Change System Config
Change AI Policy
Publish Dataset
Revoke Device
```

All sensitive actions must be audited.

---

# 12. RELEASE CENTER

```text
Current Extension Version
Latest Version
Minimum Supported Version
Force Update
Release Notes
Rollout %
```

Example:

```text
Current: v2.4.1
Latest:  v2.5.0
Rollout: 25%
```

---

# 13. MULTI-TENANT SECURITY

Every business record must be scoped to:

```text
shop_id
```

Authorization:

```text
auth.uid()
    ↓
membership
    ↓
shop_id
```

Never trust a frontend-provided `shop_id` as an authorization boundary.

Use Supabase RLS as the primary database security layer.

---

# 14. COMMERCIAL ANALYTICS

Admin metrics:

```text
DAU
WAU
MAU
Orders / day
AI Requests / day
AI Cost / day
AI Cost / Shop
Active Shops
Trial Conversion
Paid Conversion
Churn
MRR
ARPU
Retention
```

Product quality KPIs:

```text
Order Parse Success
Address Match Rate
Autofill Success
Carrier Success
Submit Success
Sync Success
```

Example:

```text
AI Parse        98.7%
Address Match   96.4%
Autofill        97.1%
Submit          95.8%
Sync            99.4%
```

---

# 15. ERROR MONITORING

Categorize:

```text
AI Errors
Address Errors
Carrier Errors
Sync Errors
Auth Errors
```

Use stable machine-readable error codes:

```text
CARRIER_FIELD_NOT_FOUND
AI_RATE_LIMITED
ADDRESS_LOW_CONFIDENCE
SYNC_CONFLICT
AUTH_SESSION_EXPIRED
```

Users should see understandable messages rather than provider-specific raw errors.

---

# 16. COMMERCIAL ONBOARDING

```text
Register
 ↓
Create Shop
 ↓
Choose Plan
 ↓
Verify Email
 ↓
Install Extension
 ↓
Login
 ↓
Register Device
 ↓
Connect Carrier
 ↓
Test AI
 ↓
Create First Order
```

Checklist:

```text
☐ Shop Profile
☐ Invite Staff
☐ Connect Carrier
☐ Test Address
☐ Test AI
☐ Create First Order
```

---

# 17. FIRST-RUN EXPERIENCE

```text
Welcome
 ↓
Login
 ↓
Select Shop
 ↓
Device Registration
 ↓
Permissions
 ↓
AI Test
 ↓
Carrier Test
 ↓
Ready
```

Do not immediately drop a new user into a large settings page.

---

# 18. PLAN LIMIT ENFORCEMENT

When quota is exhausted, show a product-level message:

```text
Bạn đã sử dụng 10,000 / 10,000 lượt AI.

Reset: 04/09/2026

[Upgrade Plan]
```

Do not expose raw:

```text
Groq error 429
```

to ordinary users.

---

# 19. GRACEFUL DEGRADATION

If AI fails:

```text
AI unavailable
      ↓
Manual Parser
      ↓
Local Address Engine
      ↓
Manual Review
```

If cloud fails:

```text
Cloud Offline
      ↓
Local Mode
      ↓
Outbox
      ↓
Auto Sync when online
```

The extension should degrade gracefully instead of becoming completely unusable.

---

# 20. PRODUCT POSITIONING

Do not position the product only as:

> Extension tự điền đơn.

Commercial positioning:

> **AI Order Automation Platform cho người bán hàng đa kênh.**

Core value:

```text
Facebook / Zalo
      ↓
AI
      ↓
Order
      ↓
Address Engine
      ↓
Carrier
      ↓
Submit
      ↓
Cloud
      ↓
Analytics
```

---

# 21. PRODUCT ROADMAP

## V1 — Commercial Foundation

```text
Auth
Shop
Team
Orders
AI Parser
Address Engine
VNPost
J&T
Sync
Subscription
Admin
```

## V1.5

```text
Customer CRM
Analytics
Notifications
Support
Feature Flags
Usage
Device Management
```

## V2

```text
GHN
GHTK
Viettel Post
Facebook Integration
Zalo Integration
Multi-channel Inbox
Advanced CRM
Automation Rules
```

## V3

```text
AI Agent
Auto Order Classification
Auto Address Correction
Smart Carrier Selection
Fraud Detection
Revenue Analytics
Workflow Automation
API / Webhook
```

---

# 22. FINAL COMMERCIAL ARCHITECTURE

```text
                    ┌───────────────────┐
                    │   SYSTEM ADMIN    │
                    │ SaaS Control Plane│
                    └─────────┬─────────┘
                              │
               ┌──────────────▼──────────────┐
               │           SUPABASE           │
               │                              │
               │ Auth / RLS / DB / RPC       │
               │ Subscription / Usage        │
               │ Audit / Feature Flags       │
               └──────────────┬──────────────┘
                              │
                         AI Gateway
                              │
                             Groq

       ┌──────────────────── SHOP ────────────────────┐
       │                                               │
       │       OWNER / MANAGER                         │
       │               │                               │
       │               ▼                               │
       │            OPTIONS                            │
       │               │                               │
       │     Config / Team / AI / Carrier              │
       │     Address / Security / Billing              │
       │                                               │
       │               ▼                               │
       │             STAFF                             │
       │               │                               │
       │               ▼                               │
       │             INDEX                             │
       │               │                               │
       │       Parse → Address → Autofill              │
       │               │                               │
       │       VNPost / J&T / Future Carriers          │
       └───────────────────────────────────────────────┘
```

---

# 23. IMPLEMENTATION ORDER

## PHASE 1 — UI/UX Foundation

```text
01 Index Shell
02 Options Shell
03 Admin Shell
04 Navigation
05 Permission-aware Routing
06 Design System
07 Empty / Loading / Error States
```

## PHASE 2 — Index

```text
01 Dashboard
02 Create Order
03 AI Parse
04 Review
05 Address
06 Autofill
07 Orders
08 Customers
09 History
10 Sync
```

## PHASE 3 — Options

```text
01 General
02 Team
03 AI
04 Address
05 Carrier
06 Order
07 Sync
08 Security
09 Audit
10 Subscription
```

## PHASE 4 — Admin

```text
01 Overview
02 Shops
03 Users
04 Plans
05 Usage
06 AI Platform
07 Features
08 Address Dataset
09 Carriers
10 Devices
11 Security
12 Health
13 Support
14 Releases
```

## PHASE 5 — Commercial

```text
Subscription
Quota
Usage
Billing
Trial
Upgrade
Downgrade
Suspension
Renewal
Invoice
```

## PHASE 6 — Hardening

```text
RLS
RBAC
Audit
Security
Offline
Sync
Observability
E2E
```

---

# 24. DEFINITION OF DONE

```text
Index   = Worker Workspace
Options = Shop Control Center
Admin   = SaaS Control Plane

+
RBAC
+
Subscription
+
Quota
+
Usage
+
Audit
+
Support
+
Feature Flags
+
Health Monitoring
+
Multi-Tenant Isolation
+
Offline / Sync Resilience
```

## Final rule

Không tiếp tục vá thêm chức năng trực tiếp vào `options.html`, `index.html` hoặc `admin-dashboard`.

Trước khi phát triển tính năng mới, phải xác định:

```text
Screen
→ Role
→ Permission
→ Domain
→ API
→ Database
→ RLS
→ Feature Flag
→ Audit
→ Error State
```

Đây là baseline để phát triển Auto Fill Order từ extension nội bộ thành sản phẩm SaaS thương mại.
