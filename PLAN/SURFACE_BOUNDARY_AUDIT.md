# SURFACE_BOUNDARY_AUDIT.md

## 1. Executive Summary

This document formalizes the surface boundaries across the Auto Fill Order commercial architecture, ensuring distinct separation of concerns between:
1. **`index / panel`**: Worker Order Workspace
2. **`options`**: Shop Control Center
3. **`admin-dashboard`**: SaaS Control Plane

---

## 2. Surface Audit & Mapping

### A. Surface 1: `index / panel` (Worker Order Workspace)
- **Primary Users**: Shop Staff / Order Processors.
- **Main Responsibility**: Parse raw order text/images, normalize addresses, review AI confidence, autofill carrier forms (VNPost, J&T), and view recent order history.
- **Core Components**:
  - `src/ui/panel/App.jsx` (Draggable floating overlay in carrier sites)
  - `src/ui/index/App.jsx` (Web order processing workspace)
- **Status**: Correctly identified.
- **Boundary Fixes**:
  - Gated dev mock fallbacks so fake data is never injected in production.
  - Retained worker focus: Dashboard, Create Order, Order History, Address Normalization, Carrier Autofill.

### B. Surface 2: `options` (Shop Control Center)
- **Primary Users**: Shop Owners / Shop Managers.
- **Main Responsibility**: Configure shop profiles, team members, RBAC permissions, shop-level AI prompt policies & quotas, address aliases/learning, carrier accounts, sync policies, and shop subscription tier.
- **Core Components**:
  - `frontend/options/options.html`
  - `src/ui/options/App.jsx`
  - Submodules in `src/ui/options/pages/`:
    - General (ShopProfile, OrderSettings)
    - Team (Members, Roles, PermissionMatrix)
    - AI Settings (Usage, Prompt Policy)
    - Carriers (VNPost, J&T)
    - Address Engine (Custom Alias, Learning)
    - Sync & Security (Device Management, Audit Logs)
    - Subscription (Plan, Quota, Invoices)
- **Status**: Correctly structured and separated from daily order execution.

### C. Surface 3: `admin-dashboard` (SaaS Control Plane)
- **Primary Users**: System Administrators / Super Admins.
- **Main Responsibility**: Monitor system health, manage all shops across the SaaS platform, inspect and update user accounts, manage platform subscriptions and billing tiers, monitor AI provider metrics/rate limits, publish address datasets, and review platform-wide audit logs.
- **Core Components**:
  - `admin-dashboard/admin.html` & `admin-dashboard/master-admin.js` (Standalone Control Plane)
  - `src/ui/admin-dashboard/App.jsx` (React SaaS Control Plane)
  - Submodules:
    - Overview (Platform KPIs, Active Shops, MRR)
    - Shops (All Shops, Quotas, Status)
    - Users (Platform Users, Role Assignment, Session Revocation)
    - Subscriptions (Plans, Invoices, Limits)
    - AI Platform (Health, Provider Status, Quotas)
    - Feature Flags (Global & Tenant Flags)
    - Address Dataset (Publishing, Versions, Rollback)
    - System Health (Supabase, Auth, RLS, Carrier Gateways)
- **Status**: Strictly authorized for `SYSTEM_ADMIN` role only.

---

## 3. Boundary Resolution & Rules
1. Staff cannot access Options or Admin Dashboard.
2. Shop Owners/Managers configure their own shop within `options` but have zero access to platform SaaS control.
3. System Admin manages the SaaS platform without modifying customer business data arbitrarily.
