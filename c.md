# AUTO_FILL_ORDER_MASTER_ARCHITECTURE v2

> **Status:** OFFICIAL / SOURCE-ALIGNED  
> **Baseline:** `AUTO_FILL_ORDER_OFFICIAL_SOURCE_AUDIT.md`  
> **Date:** 2026-08-04  
> **Purpose:** Canonical architecture contract for future development, Vibe Coding, code review, testing and release decisions.

---

# 1. Architecture Authority

This document is the canonical architecture authority for Auto Fill Order.

Priority:

```text
MASTER_ARCHITECTURE
        ↓
PROJECT_BIBLE
        ↓
DOMAIN_SPEC
        ↓
ADR
        ↓
IMPLEMENTATION_PLAN
        ↓
SOURCE CODE
```

If an older document conflicts with this document, the older document is considered:

```text
SUPERSEDED
```

unless an explicit ADR overrides this decision.

---

# 2. Current Source Reality

The supplied source already contains:

- Manifest V3 extension
- Supabase Auth/Postgres/RLS
- RBAC
- Shop/member/permission domains
- device management
- AI Gateway
- Address Engine
- VNPost integration
- J&T integration
- Admin Dashboard
- migrations
- test infrastructure

But it also contains transitional architecture:

```text
Firebase compatibility
        +
Supabase
        +
Direct Groq
        +
AI Gateway
        +
Multiple session/storage paths
        +
Large Service Worker
        +
Direct domain/UI coupling
```

The project must therefore undergo **controlled architecture convergence**.

---

# 3. Non-Negotiable Architecture Rules

## Rule 01 — Supabase is the only cloud backend

Production runtime:

```text
Supabase Auth
Supabase Postgres
Supabase RLS
Supabase RPC
Supabase Edge Functions
```

Firebase is legacy migration infrastructure only.

---

## Rule 02 — Extension never calls Groq directly

Forbidden:

```text
Extension → api.groq.com
```

Required:

```text
Extension
   ↓
AI Gateway
   ↓
Groq
```

No Groq API key may exist in:

```text
chrome.storage
options.html
content scripts
service worker
source code
client configuration
```

---

## Rule 03 — Service Worker is orchestration only

The Service Worker must not contain business domains.

It coordinates:

```text
Auth
AI
Sync
Device
Config
Messages
```

Business logic belongs to dedicated services.

---

## Rule 04 — One canonical AuthSession

No parallel:

```text
Firebase session
Supabase session
legacy session
localStorage session
```

The application has exactly one logical session model.

---

## Rule 05 — One authoritative cloud mutation pipeline

Cloud writes must pass through:

```text
Repository
   ↓
Local mutation
   ↓
Outbox
   ↓
Sync Engine
   ↓
Supabase
```

No random direct writes from UI components.

---

## Rule 06 — Address Engine is independent of carriers

Address logic must never depend on:

```text
VNPost DOM
J&T DOM
carrier CSS selector
carrier page state
```

Instead:

```text
Raw Address
    ↓
Address Engine
    ↓
Canonical Address
    ↓
Carrier Mapper
```

---

## Rule 07 — Carrier integrations are adapters

```text
CarrierAdapter
├── VNPostAdapter
└── JTExpressAdapter
```

Carrier-specific code stays isolated.

---

## Rule 08 — Client cannot choose provider model arbitrarily

Client sends:

```json
{
  "task": "parse"
}
```

Gateway decides:

```text
task
 ↓
model policy
 ↓
approved model
```

---

# 4. Target System Architecture

```text
                           ┌────────────────────┐
                           │   ADMIN DASHBOARD   │
                           └─────────┬──────────┘
                                     │
                                     ▼
                           ┌────────────────────┐
                           │      SUPABASE      │
                           │                    │
                           │ Auth               │
                           │ Postgres           │
                           │ RLS                │
                           │ RPC                │
                           │ Realtime           │
                           └──────┬─────────────┘
                                  │
                         ┌────────┴─────────┐
                         │                  │
                         ▼                  ▼
                  Edge Functions        Safe RPC
                         │
                         ▼
                    AI Gateway
                         │
                         ▼
                       GROQ


┌──────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION                         │
│                         MV3                                  │
│                                                              │
│ Options / Panel                                              │
│       │                                                      │
│       ▼                                                      │
│ Message Router                                               │
│       │                                                      │
│ ┌─────┼─────────┬─────────┬─────────┐                        │
│ ▼     ▼         ▼         ▼         ▼                        │
│Auth   AI       Sync      Device    Config                    │
│ │     │         │                                          │
│ │     │         ▼                                          │
│ │     │      Outbox                                         │
│ │     │         │                                          │
│ └─────┴─────────┴─────── Repository Layer                   │
│                           │                                  │
│                    chrome.storage.*                          │
│                                                              │
│ Content Runtime                                              │
│       │                                                      │
│       ▼                                                      │
│ Carrier Runtime                                              │
│    ┌──┴──────────┐                                           │
│    ▼             ▼                                           │
│ VNPost        J&T Express                                    │
│    │             │                                           │
│    └──────┬──────┘                                           │
│           ▼                                                  │
│      Carrier Mapper                                          │
│           ▲                                                  │
│           │                                                  │
│      Address Engine V2                                       │
│           │                                                  │
│      Order Domain                                            │
└──────────────────────────────────────────────────────────────┘
```

---

# 5. Domain Architecture

```text
src/
├── domain/
│   ├── auth/
│   ├── shop/
│   ├── member/
│   ├── permission/
│   ├── device/
│   ├── order/
│   ├── customer/
│   ├── address/
│   ├── carrier/
│   ├── ai/
│   ├── sync/
│   ├── audit/
│   └── config/
│
├── application/
│   ├── auth/
│   ├── order/
│   ├── address/
│   ├── ai/
│   ├── sync/
│   └── carrier/
│
├── infrastructure/
│   ├── supabase/
│   ├── storage/
│   ├── gateway/
│   └── browser/
│
└── runtime/
    ├── service-worker/
    └── content/
```

---

# 6. Identity Architecture

## Identity hierarchy

```text
System
 ├── Master Admin
 │
 └── Shop
      ├── Owner
      ├── Manager
      └── Staff
```

A user must never receive shop access merely because they know a `shop_id`.

Authorization:

```text
User
 ↓
Auth
 ↓
Shop Membership
 ↓
Role
 ↓
Permission
 ↓
RLS / Server Authorization
```

---

# 7. Device Identity

Each installation gets:

```text
device_id
device_name
installation_id
user_id
shop_id
status
last_seen_at
created_at
```

Rules:

- `device_id` is unique.
- It is never derived solely from computer name.
- It is not manually reused.
- revoked devices cannot perform authenticated mutations.
- changing computers creates a new installation identity.

---

# 8. AuthSession Contract

Canonical model:

```ts
interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  shopId: string;
  deviceId: string;
  roles: string[];
  permissions: string[];
}
```

Persistence:

```text
chrome.storage.session
    → active session

chrome.storage.local
    → durable non-secret metadata
```

Session lifecycle:

```text
LOGIN
 ↓
SESSION_CREATED
 ↓
ACTIVE
 ↓
REFRESH_REQUIRED
 ↓
REFRESHED
 ↓
EXPIRED / LOGOUT
```

---

# 9. AI Architecture

## AI request flow

```text
Order text/image
       ↓
AI Client
       ↓
Service Worker
       ↓
Supabase Edge Gateway
       ↓
Auth verification
       ↓
Shop membership
       ↓
Feature flag
       ↓
Rate limit
       ↓
Quota
       ↓
Model policy
       ↓
Provider
       ↓
Schema validation
       ↓
Normalized result
```

---

# 10. AI Task Registry

Recommended tasks:

```text
parse_order
normalize_address
extract_customer
extract_phone
vision_order
```

The client calls:

```text
task
```

not:

```text
provider model ID
```

---

# 11. AI Gateway Error Contract

Normalize provider errors into:

```text
AI_AUTH_REQUIRED
AI_SHOP_REQUIRED
AI_FEATURE_DISABLED
AI_RATE_LIMITED
AI_QUOTA_EXCEEDED
AI_INVALID_INPUT
AI_INVALID_IMAGE
AI_PROVIDER_UNAVAILABLE
AI_PROVIDER_TIMEOUT
AI_PROVIDER_BAD_REQUEST
AI_SCHEMA_INVALID
AI_UNKNOWN
```

Response:

```json
{
  "ok": false,
  "request_id": "...",
  "error": {
    "code": "AI_RATE_LIMITED",
    "message": "AI request rate limit reached",
    "retry_after_ms": 5000
  }
}
```

---

# 12. AI Security

Never:

```text
Groq key in extension
client model override
client shop override
client quota override
client permission override
```

Gateway derives:

```text
user_id
shop_id
role
permissions
feature flag
quota
model
```

from trusted server-side state.

---

# 13. AI Quota Architecture

Exactly one authoritative consumption point:

```text
AI Gateway
     ↓
consume_ai_quota()
```

Extension can only:

```text
read/display
```

It cannot consume quota itself.

---

# 14. Address Engine V2

## Pipeline

```text
RAW INPUT
   ↓
Text Cleanup
   ↓
Parser
   ↓
Normalizer
   ↓
Alias Resolver
   ↓
Administrative Resolver
   ↓
Merge/Split Resolver
   ↓
Fuzzy Resolver
   ↓
Confidence Scorer
   ↓
Validator
   ↓
Canonical Address
   ↓
Carrier Mapper
```

---

# 15. Canonical Address

```ts
interface CanonicalAddress {
  raw: string;
  recipientName?: string;
  phone?: string;

  addressLine?: string;

  ward?: {
    code?: string;
    name: string;
  };

  district?: {
    code?: string;
    name: string;
  };

  province?: {
    code?: string;
    name: string;
  };

  confidence: number;

  source:
    | "exact"
    | "alias"
    | "fuzzy"
    | "ai"
    | "manual";

  warnings: string[];
}
```

---

# 16. Address Confidence Policy

```text
>= 0.95
    AUTO_FILL

0.80 – 0.949
    AUTO_FILL + WARNING

0.60 – 0.799
    REQUIRE REVIEW

< 0.60
    MANUAL INPUT
```

This threshold must be configurable by feature policy.

---

# 17. Address Dataset Versioning

Every administrative dataset must have:

```text
dataset_id
version
effective_from
effective_to
source
checksum
created_at
```

Never overwrite historical mappings destructively.

Use:

```text
valid_from
valid_to
```

for administrative transitions.

---

# 18. Carrier SDK

Canonical interface:

```ts
interface CarrierAdapter {
  id(): string;

  detect(context): boolean;

  capabilities(): CarrierCapabilities;

  findFields(): FieldMap;

  fillCustomer(data): Promise<FillResult>;

  fillAddress(data): Promise<FillResult>;

  fillOrder(data): Promise<FillResult>;

  validate(): Promise<ValidationResult>;

  submit(): Promise<SubmissionResult>;
}
```

---

# 19. Carrier Field Strategy

Selector priority:

```text
1. semantic/accessible selector
2. stable attribute
3. known field identifier
4. fallback selector
5. DOM heuristic
```

Avoid relying exclusively on:

```text
nth-child
generated CSS class
deep DOM path
```

---

# 20. Controlled Input Handling

For React/Vue-style inputs:

```text
locate
 ↓
set native value
 ↓
dispatch input
 ↓
dispatch change
 ↓
dispatch blur
 ↓
verify displayed state
 ↓
verify framework state if possible
```

A successful DOM assignment alone is not considered a successful autofill.

---

# 21. Carrier Diagnostics

Every autofill operation should produce:

```json
{
  "carrier": "vnpost",
  "field": "ward",
  "found": true,
  "filled": true,
  "verified": true,
  "selector_strategy": "semantic",
  "duration_ms": 120
}
```

Failure:

```json
{
  "carrier": "jt",
  "field": "district",
  "found": false,
  "filled": false,
  "error_code": "FIELD_NOT_FOUND"
}
```

---

# 22. Order Domain

Order lifecycle:

```text
CAPTURED
   ↓
PARSED
   ↓
NORMALIZED
   ↓
READY
   ↓
AUTOFILLED
   ↓
SUBMITTED
   ↓
CONFIRMED
```

Failure states:

```text
PARSE_FAILED
ADDRESS_REVIEW
AUTOFILL_FAILED
SUBMIT_FAILED
SYNC_PENDING
SYNC_FAILED
```

---

# 23. Order Record

Minimum:

```text
id
shop_id
device_id
customer_id
recipient_name
phone
raw_address
normalized_address
carrier
carrier_order_id
status
created_at
updated_at
version
last_mutation_id
deleted_at
```

---

# 24. Sync Architecture

```text
User action
    ↓
Repository
    ↓
Local transaction
    ├── entity update
    └── outbox event
             ↓
         Sync Engine
             ↓
        retry/backoff
             ↓
          Supabase
```

---

# 25. Outbox Contract

```ts
interface OutboxItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: unknown;
  shopId: string;
  deviceId: string;
  mutationId: string;
  idempotencyKey: string;
  attemptCount: number;
  nextAttemptAt: number;
  status: "PENDING" | "PROCESSING" | "FAILED" | "DONE";
  lastError?: string;
  createdAt: number;
}
```

---

# 26. Sync Guarantees

The Sync Engine must support:

- offline mode
- retry
- exponential backoff
- idempotency
- conflict detection
- soft delete
- tombstones
- dead-letter state
- manual retry
- multi-device reconciliation

---

# 27. Conflict Policy

Baseline:

```text
mutation_id
+
version
+
updated_at
+
device_id
```

Do not silently overwrite data when concurrent edits are detected.

Conflict:

```text
LOCAL_UPDATED
CLOUD_UPDATED
      ↓
CONFLICT
      ↓
RESOLUTION_POLICY
```

---

# 28. Storage Architecture

Use a repository abstraction:

```text
StorageRepository
├── AuthRepository
├── OrderRepository
├── CustomerRepository
├── AddressRepository
├── SettingsRepository
├── OutboxRepository
└── DeviceRepository
```

Direct calls from UI:

```text
chrome.storage.local.get(...)
chrome.storage.local.set(...)
```

should be progressively eliminated from business code.

---

# 29. Service Worker Architecture

Target:

```text
service-worker/
├── bootstrap.js
├── message-router.js
├── auth-runtime.js
├── ai-runtime.js
├── sync-runtime.js
├── device-runtime.js
├── config-runtime.js
└── alarm-runtime.js
```

`bootstrap.js` should only initialize runtime dependencies.

---

# 30. Service Worker Scheduling

Forbidden for periodic work:

```javascript
setInterval(...)
```

Required:

```text
chrome.alarms
```

Example jobs:

```text
sync-outbox
refresh-config
device-heartbeat
cleanup-expired-data
```

---

# 31. Content Runtime

Target:

```text
content/
├── bootstrap.js
├── message-bridge.js
├── page-detector.js
├── carrier-runtime.js
├── order-observer.js
├── autofill-orchestrator.js
└── diagnostics.js
```

The content entrypoint must not become a second Service Worker.

---

# 32. Admin Dashboard

Admin responsibilities:

```text
System
├── shops
├── users
├── members
├── roles
├── permissions
├── devices
├── quotas
├── feature flags
├── audit
├── system configuration
└── diagnostics
```

Admin must never expose provider secrets to shop clients.

---

# 33. Configuration Architecture

```text
ConfigRegistry
│
├── BuildConfig
├── PublicRuntimeConfig
├── ShopConfig
├── FeatureFlags
└── ServerSecrets
```

Rules:

```text
PublicRuntimeConfig → client
ShopConfig → authorized client
FeatureFlags → authorized client
ServerSecrets → Edge/server only
```

---

# 34. Observability

Every critical request receives:

```text
trace_id
request_id
shop_id
user_id
device_id
module
operation
status
error_code
started_at
duration_ms
```

AI:

```text
AIRequestTrace
```

Sync:

```text
SyncTrace
```

Carrier:

```text
CarrierTrace
```

---

# 35. Logging Rules

Never log:

```text
password
access_token
refresh_token
Groq API key
full sensitive customer data
```

Logs should use redaction:

```text
phone: 09******123
token: [REDACTED]
```

---

# 36. Database Principles

Supabase remains authoritative.

Rules:

```text
RLS = mandatory
shop_id isolation = mandatory
server authorization = mandatory
SECURITY DEFINER = reviewed
search_path = hardened
indexes = intentional
audit = required for privileged mutations
```

---

# 37. System Config Policy

Client must not directly query sensitive system configuration.

Required:

```text
Client
 ↓
safe RPC / Edge Function
 ↓
validated response
```

Provider secrets stay server-side.

---

# 38. Feature Flags

Feature flag hierarchy:

```text
system
   ↓
shop
   ↓
user/role
   ↓
runtime
```

Examples:

```text
ai_enabled
vision_enabled
address_v2_enabled
carrier_v2_enabled
sync_v2_enabled
```

---

# 39. Error Taxonomy

All modules should use stable error codes.

```text
AUTH_*
AI_*
SYNC_*
ADDRESS_*
CARRIER_*
ORDER_*
DEVICE_*
CONFIG_*
DB_*
NETWORK_*
```

Example:

```text
ADDRESS_NO_MATCH
ADDRESS_LOW_CONFIDENCE
CARRIER_FIELD_NOT_FOUND
CARRIER_DOM_CHANGED
SYNC_CONFLICT
SYNC_RETRY_EXHAUSTED
AI_PROVIDER_TIMEOUT
```

---

# 40. Testing Pyramid

```text
                    E2E
                   /   \
              Carrier   Multi-device
                /         \
           Integration   Security
              /              \
        Service / Gateway / DB
                 |
               Unit
                 |
              Static
```

Required CI:

```text
L0 lint/type/static
L1 unit
L2 extension runtime
L3 Supabase integration
L4 RLS/security
L5 AI Gateway
L6 Address Engine
L7 Carrier DOM
L8 E2E
```

No critical integration test may remain permanently skipped.

---

# 41. Definition of Done

A feature is not DONE because:

```text
code compiles
```

It is DONE only when:

- domain contract exists
- authorization exists
- error codes exist
- tests exist
- logging exists
- offline behavior considered
- sync behavior considered
- migration impact reviewed
- security reviewed
- documentation updated
- legacy path removed if replaced

---

# 42. Vibe Coding Protocol

Every AI-generated implementation must follow:

```text
READ
 ↓
PLAN
 ↓
VERIFY ARCHITECTURE
 ↓
IMPLEMENT
 ↓
TEST
 ↓
AUDIT
 ↓
CLEAN LEGACY
```

AI must not:

- invent new parallel auth
- create another storage mechanism
- add direct Groq calls
- bypass RLS
- add direct database writes from UI
- add a second Address Engine
- duplicate carrier logic
- introduce another global config
- modify architecture without ADR

---

# 43. Package 01 — Architecture Convergence

This is the first implementation package.

```text
01. Firebase retirement
02. AI Gateway cutover
03. AuthSession consolidation
04. ConfigRegistry
05. Service Worker message router
06. remove direct Groq
07. remove Groq API key UI
08. remove Firebase runtime
09. integration tests
10. release gate
```

### Package 01 must NOT include

```text
new carrier features
new dashboard features
new AI features
major UI redesign
new database domains
```

First stabilize the foundation.

---

# 44. Package 02 — Address Engine V2

```text
DatasetRegistry
AddressParser
Normalizer
AliasResolver
AdministrativeResolver
MergeResolver
FuzzyResolver
ConfidenceScorer
Validator
CarrierMapper
LearningStore
```

---

# 45. Package 03 — Sync Engine V2

```text
Repository
Outbox
Mutation ID
Idempotency
Retry
Backoff
Conflict
Tombstone
Dead Letter
Diagnostics
```

---

# 46. Package 04 — Carrier SDK

```text
CarrierAdapter
CarrierRegistry
FieldMap
SelectorRegistry
DOMController
VNPostAdapter
JTExpressAdapter
CarrierDiagnostics
```

---

# 47. Package 05 — Observability

```text
Trace
ErrorEvent
AI Trace
Sync Trace
Carrier Trace
Audit Dashboard
Diagnostic Export
```

---

# 48. Package 06 — Enterprise Hardening

```text
Security
RLS
RBAC
Rate limit
Quota
Device security
Session security
Data isolation
Audit
Backup/recovery
Release governance
```

---

# 49. Package 07 — UI/UX Master Alignment

Only after runtime stabilization:

```text
Options
Panel
Admin
Dashboard
Logs
AI settings
Address tools
Carrier tools
```

UI must consume domain/application APIs rather than implementing business logic.

---

# 50. Migration Rules

Never perform a destructive migration in one step.

Required:

```text
OLD
 ↓
COMPATIBILITY
 ↓
DUAL READ
 ↓
MIGRATE
 ↓
VERIFY
 ↓
CUTOVER
 ↓
REMOVE OLD
```

For high-risk systems:

```text
feature flag
+
rollback
+
diagnostic logging
```

---

# 51. Rollback Strategy

Every package must have:

```text
migration
verification
rollback
```

No release without a rollback plan.

---

# 52. Production Release Gates

## Architecture

- [ ] Firebase runtime = 0
- [ ] direct Groq runtime = 0
- [ ] one AuthSession
- [ ] one AI route
- [ ] one storage policy
- [ ] Service Worker decomposed

## Security

- [ ] JWT verified
- [ ] RLS verified
- [ ] shop isolation tested
- [ ] provider secrets server-side
- [ ] system config protected
- [ ] privileged RPC reviewed

## AI

- [ ] server-side model registry
- [ ] current API contract
- [ ] schema validation
- [ ] rate limit
- [ ] quota exactly once
- [ ] timeout
- [ ] retry policy

## Address

- [ ] current administrative dataset
- [ ] versioning
- [ ] merge/split support
- [ ] confidence
- [ ] carrier mapping

## Sync

- [ ] outbox
- [ ] idempotency
- [ ] retry
- [ ] conflict
- [ ] tombstone
- [ ] multi-device tests

## Carrier

- [ ] VNPost adapter
- [ ] J&T adapter
- [ ] selector resilience
- [ ] DOM event verification
- [ ] diagnostics

---

# 53. Final Architecture Decision Record

## ADR-AFO-001

### Decision

Auto Fill Order will converge on:

```text
MV3
+
Supabase
+
AI Gateway
+
Address Engine V2
+
Carrier Adapter SDK
+
Repository/Outbox Sync
+
Domain-driven runtime
```

### Rejected

```text
Firebase + Supabase hybrid
Direct Groq from extension
Multiple auth/session systems
Direct UI database writes
Carrier-specific address logic
Monolithic Service Worker
```

### Reason

The target must provide:

```text
security
stability
offline capability
multi-device consistency
AI provider independence
carrier resilience
maintainability
AI coding safety
```

---

# 54. Final Target

```text
                         AUTO FILL ORDER
                               │
                    ┌──────────▼──────────┐
                    │   DOMAIN CONTRACTS  │
                    └──────────┬──────────┘
                               │
       ┌───────────┬───────────┼───────────┬───────────┐
       ▼           ▼           ▼           ▼           ▼
     AUTH        ORDER      ADDRESS      CARRIER      AI
       │           │           │           │           │
       └───────────┴───────────┼───────────┴───────────┘
                               ▼
                        APPLICATION LAYER
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
             Repository      Gateway       Runtime
                 │             │             │
                 ▼             ▼             ▼
              Outbox       Supabase        MV3
                 │             │
                 └──────┬──────┘
                        ▼
                    SUPABASE
                 Auth / DB / RLS
                        │
                        ▼
                   AI Gateway
                        │
                        ▼
                       Groq
```

---

# 55. Success Definition

The architecture is considered converged when:

```text
Firebase references in production runtime     = 0
Direct Groq calls from extension             = 0
Groq secrets in client                       = 0
Duplicate AuthSession implementations        = 0
Uncontrolled direct cloud mutations          = 0
Long-lived Service Worker intervals          = 0
Carrier logic outside adapters               = 0
Address logic inside carrier adapters        = 0
Critical integration tests skipped           = 0
```

And:

```text
AI Gateway = single AI boundary
Supabase   = single cloud authority
Address V2 = single address authority
Outbox     = single sync mutation pipeline
Carrier SDK = single carrier abstraction
AuthSession = single client identity model
```

---

# 56. Immediate Next Action

**Do not start Package 02 yet.**

Execute:

```text
PACKAGE 01
ARCHITECTURE CONVERGENCE
```

in this order:

```text
1. Firebase inventory
2. Firebase → Supabase cutover
3. AI Gateway contract
4. Remove direct Groq
5. Remove Groq API key UI
6. Canonical AuthSession
7. ConfigRegistry
8. Service Worker message router
9. Supabase integration tests
10. Security tests
11. Build/release verification
12. Legacy removal
```

Only when all Package 01 release gates pass:

```text
→ Package 02 Address Engine V2
→ Package 03 Sync Engine V2
→ Package 04 Carrier SDK
```

**This is the canonical implementation direction for the source snapshot audited on 2026-08-04.**
