# Chrome Web Store publishing requirements for Auto Fill Order

Date checked: 2026-09-26

Scope: current Chrome Web Store requirements and a repository-specific pre-submission assessment. Only first-party Google/Chrome sources were used. Repository findings are an engineering assessment, not a guarantee of approval.

## Executive verdict

The product architecture is eligible in principle: it already uses Manifest V3, packages its JavaScript locally, and sends data to a server-side AI service rather than downloading AI code. However, the current package should **not** be submitted publicly until the P0/P1 gates below are closed.

Highest-risk areas:

1. The package has no manifest `icons` field and no PNG store icon was found. Google requires a 128×128 PNG icon in the ZIP; a missing icon or screenshots causes rejection. ([Prepare the extension](https://developer.chrome.com/docs/webstore/prepare), [image requirements](https://developer.chrome.com/docs/webstore/images), [listing policy](https://developer.chrome.com/docs/webstore/program-policies/policies))
2. Raw order text and identifiers are sent to the Supabase AI gateway, while the store disclosure, hosted privacy policy, retention rules, processor terms, and in-product consent must all say exactly what is sent and why. Google requires accurate disclosure and informed consent for user data handling. ([Disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements), [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use))
3. Required permissions and hosts are broader than a reviewer is likely to accept without strong justification, notably `tabs`, `unlimitedStorage`, `clipboardRead`, and `https://*.supabase.co/*`. Google requires the narrowest permission set needed by current functionality. ([Use of permissions](https://developer.chrome.com/docs/webstore/program-policies/policies), [User Data FAQ — minimum permissions](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq))
4. Remote selector releases change which carrier DOM elements are targeted. Remote JSON/config is allowed only when the complete operating logic remains in the submitted package; it must never contain JavaScript, executable expressions, action programs, or complex commands. ([Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements))
5. The reviewer needs reproducible access to authenticated and AI-assisted functionality. Test instructions should include a dedicated extension account, a working test path, deterministic sample input, expected output, and any carrier sandbox/test credentials. ([Test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions), [publish workflow](https://developer.chrome.com/docs/webstore/publish))

## Official requirements

| Area | Current requirement | Release implication |
| --- | --- | --- |
| Developer account | Register a CWS developer account, accept the agreement/policies, and pay the one-time fee. The current page does not publish a fixed fee amount. The account email cannot later be changed. ([Register](https://developer.chrome.com/docs/webstore/register)) | Use a company-controlled Google account, not a personal throwaway account. |
| Account security | Publisher name and verified contact email are required. Two-Step Verification is mandatory before publishing or updating. ([Account setup](https://developer.chrome.com/docs/webstore/set-up-account), [2-Step Verification policy](https://developer.chrome.com/docs/webstore/program-policies/policies)) | Complete account setup before attempting the first upload. Enable monitored policy/rejection email alerts. |
| Trader status | Every publisher must declare Trader or Non-Trader. A Trader publishing to EU consumers must verify legal name, phone and address; verified trader details are displayed publicly. ([Trader disclosure](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure), [Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)) | A commercial SaaS publisher should obtain legal/accounting advice and prepare public business contact details. |
| Manifest platform | Manifest V3 is required for a new submission. MV2 was fully disabled in Chrome and remaining MV2 items were removed from CWS by 2026-08-31. ([MV2 deprecation timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline)) | The repository passes this structural gate with `"manifest_version": 3`. |
| Packaged code | Extension logic must be self-contained and discernible from the submitted code. Remote script tags, `eval` of fetched strings, or interpreters for remote command programs are prohibited. Server calls and data/config downloads are allowed when they do not carry logic. ([MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements), [remote hosted code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)) | AI responses should use a fixed JSON schema and be treated only as data. Bundle all libraries; do not load a runtime CDN. |
| Code readability | Obfuscation or concealed functionality is prohibited. Minification/bundling is permitted, but large or hard-to-review bundles can extend review time. ([Code readability policy](https://developer.chrome.com/docs/webstore/program-policies/policies), [review process](https://developer.chrome.com/docs/webstore/review-process)) | Ship production code, source maps if safe, meaningful module names, and no dead/admin/test payload in the ZIP. |
| Single purpose | An extension must have one narrow, understandable purpose. A persistent UI must enhance the current task and cause minimal distraction. ([Quality policy](https://developer.chrome.com/docs/webstore/program-policies/policies), [single-purpose FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)) | Recommended purpose: “Turn order text supplied by the user into reviewed shipping fields and fill supported carrier forms.” CRM, billing and admin functions must remain subordinate to that workflow or be separated into the web service. |
| Permissions | Request only the narrowest required permissions and hosts; “future-proof” permissions are not allowed. Each manifest permission needs a Dashboard justification. Broad hosts and sensitive permissions such as `tabs` lead to deeper review. ([Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [review process](https://developer.chrome.com/docs/webstore/review-process)) | Remove permissions that are not essential to the submitted release; convert optional features to optional permissions where appropriate. |
| User data | A product handling user data needs an accurate, current privacy policy linked in the Dashboard. The policy and in-product notices must disclose collection, use, sharing, and all recipient parties. Data use must be limited to the disclosed single purpose. ([Privacy policy](https://developer.chrome.com/docs/webstore/program-policies/privacy), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)) | The hosted policy, listing, Privacy tab and actual network traffic must match. Order/customer data cannot be sold, used for personalized ads, or exposed to routine human review. |
| Consent | Before handling user data, disclose what is collected and how it is used and obtain affirmative, informed consent. If sensitive handling is not obvious, the disclosure and consent must appear in-product before collection; a privacy-policy link alone is insufficient. ([Disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements), [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)) | Add first-run consent and a clear just-in-time AI/cloud notice. Do not invoke AI merely because a page opened. |
| Security | Collected user data must be transmitted securely using modern cryptography; authentication and payment information must not be publicly exposed. ([Handling requirements](https://developer.chrome.com/docs/webstore/program-policies/policies)) | Keep HTTPS-only transport, server-side AI keys, tenant isolation, short-lived credentials, deletion controls and documented retention. |
| Listing assets | Required assets are a 128×128 PNG icon in the ZIP, one 440×280 small promo image, and at least one screenshot (maximum five) at 1280×800 or 640×400. A 1400×560 marquee is optional. ([Images](https://developer.chrome.com/docs/webstore/images)) | Produce screenshots of the real floating panel, parse/review state, autofill result and privacy/AI control. Avoid implying official VNPost/J&T endorsement. |
| Listing metadata | Provide an accurate detailed description, category and language. Misleading, incomplete, stale or keyword-stuffed metadata is prohibited. ([Listing setup](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [listing policy](https://developer.chrome.com/docs/webstore/program-policies/policies)) | Explain local parsing, optional remote AI, supported sites, account/subscription requirements and data flow without “100% offline” ambiguity. |
| Package | Test the production build locally. ZIP the extension with `manifest.json` at the archive root; include valid `name`, increasing `version`, `icons`, and a manifest description of at most 132 characters. Maximum ZIP size is 2 GB. ([Prepare](https://developer.chrome.com/docs/webstore/prepare), [Publish](https://developer.chrome.com/docs/webstore/publish)) | Build and test from `extension/`, then ZIP the *contents* of that directory, not the containing folder. Do not include secrets. |
| Distribution/review | Public, Unlisted and Private items all receive the same policy review. Review usually takes days but may take weeks; new accounts/items, risky permissions, broad hosts and hard-to-review code increase time. A staged approval must be published within 30 days. ([Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution), [review process](https://developer.chrome.com/docs/webstore/review-process), [Publish](https://developer.chrome.com/docs/webstore/publish)) | First validate with Private/trusted testers, then submit with deferred publishing and a rollback/support plan. |
| Payments | A CWS listing may be free or connect to an external payment system, but the developer is responsible for transactions, license checks, records and taxes. Paid basic functionality must be disclosed before install; terms/refunds and seller identity must be clear. A physical address is required for purchases, paid features or subscriptions. ([About CWS](https://developer.chrome.com/docs/webstore/about), [Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms), [payment policy](https://developer.chrome.com/docs/webstore/program-policies/accepting-payment), [account setup](https://developer.chrome.com/docs/webstore/set-up-account)) | Use external checkout plus server-side entitlement. Declare in-app purchases in Distribution. Do not put card processing or payment secrets inside the extension. |

The older Listing page groups a YouTube promotional video with required assets, while the image guide says only the icon, small promo and screenshot are mandatory. Treat the live Developer Dashboard as authoritative and prepare a short real product video if the field is required. ([Listing setup](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Images](https://developer.chrome.com/docs/webstore/images))

## Repository-specific gap assessment

### P0 — must resolve before submission

| Gap | Evidence | Required outcome |
| --- | --- | --- |
| Missing package icon declaration/assets | [`manifest.json`](../../manifest.json#L1) has no `icons` property; no PNG icon was found under `extension/assets/`. | Add properly sized package icons, including a 128×128 PNG, and confirm the built `extension/manifest.json` contains them. |
| Public privacy policy and consent are not proven | A local [`privacy.html`](../../privacy.html#L79) exists, but CWS needs a public URL and in-product consent. | Host an HTTPS policy on the product/company domain. Add first-run and just-in-time consent before AI/cloud transfer, with settings to withdraw/disable. |
| Policy claims need evidence and broader cloud disclosure | The policy says “Local-First” and names Supabase/Gemini/Groq, but does not fully specify cloud order storage retention, server logs, deletion SLA, legal entity/controller, or proof for the “not used for training” statement. [`privacy.html`](../../privacy.html#L79) | Reconcile the policy with observed traffic and processor contracts/configuration. State data categories, recipients, purpose, retention, human access, deletion/export process and contact identity. |
| AI sends personal order content remotely | `_callAiGateway` posts `task`, raw `text`, `deviceId`, `shop_id`, a shop access credential and optional staff name to Supabase. [`service-worker.js`](../../src/runtime/service-worker/service-worker.js#L293) | Document the exact data path Supabase → AI provider. Minimize/pseudonymize fields before AI where feasible; avoid sending phone/name/COD for address-only correction. |

### P1 — likely rejection or long-review risks

| Risk | Evidence | Mitigation |
| --- | --- | --- |
| Excess permissions | The manifest requests `storage`, `unlimitedStorage`, `tabs`, `alarms`, and `clipboardRead`. [`manifest.json`](../../manifest.json#L7) | Prove use of each permission. Likely candidates to remove or make optional: `tabs` if host grants suffice, `clipboardRead` if normal user paste suffices, and `unlimitedStorage` unless measured storage exceeds the normal quota. |
| Broad/redundant hosts | `https://*.supabase.co/*` covers every Supabase tenant; carrier wildcard hosts overlap explicit hosts. [`manifest.json`](../../manifest.json#L14) | Pin Supabase to the production project origin and reduce carrier match patterns to the exact portals/routes needed. Justify each remaining host in the Privacy tab. |
| Remote behavior configuration | The content runtime downloads and caches active `selectors` from `remote_selector_releases`, then applies them. [`carrier-runtime.js`](../../src/runtime/content/carrier-runtime.js#L61) | Keep the schema narrowly typed as selector data. Reject unknown keys/operators. Never accept scripts, expressions, event programs or remote action sequences. Consider disabling remote selector sync in the first store build if reviewability cannot be demonstrated. |
| Persistent injected panel | Content scripts load automatically across broad carrier domains. [`manifest.json`](../../manifest.json#L26) | Keep the panel compact, dismissible and limited to order-entry routes; require user confirmation before fill/submit and show the behavior accurately in screenshots/listing text. |
| “Offline” metadata can mislead | The manifest description emphasizes offline processing but also mentions Groq and the product syncs data to Supabase. [`manifest.json`](../../manifest.json#L6) | Use precise wording: local parsing by default; optional/triggered AI correction and authenticated cloud sync. Remove the author phone number from the short manifest description and place support contact on the listing/site. |
| Reviewer may be unable to exercise core features | Authentication, shop membership, AI quotas and carrier logins can block the flow. | Supply dedicated reviewer credentials, a funded test tenant/quota, exact steps and expected results. Add a read-only/demo parse-and-review path that proves core utility without a production carrier account. |
| Large/hard-to-review package | The extension contains application, dashboard and cloud-related modules in addition to the injected panel. | Package only runtime files needed by the extension, keep readable module boundaries, and verify no admin-only source, scratch files, secrets or source credentials enter the ZIP. |
| Trademark/affiliation ambiguity | The product integrates with VNPost, J&T, Viettel Post and GHTK. | Use “compatible with/supports” language and original branding; do not imply carrier authorization or use protected logos without permission. |

### P2 — commercialization readiness features

These are not all explicit CWS requirements, but they materially reduce policy, support and revenue risk:

1. Privacy onboarding: purpose, exact cloud/AI data transfer, processor list, consent version, withdrawal and delete/export controls.
2. Data minimization: redact fields not needed by the selected AI task; configurable retention; automatic deletion; audit trail for privileged human access.
3. Subscription entitlement service: external checkout, webhook-driven plan state, server-enforced quota, billing portal, grace period and account recovery. The extension should never be the source of truth for paid status.
4. Reviewer/demo mode: deterministic sample order, local parse, review and simulated form-fill target without third-party production credentials.
5. Support and reliability: public support URL, status page, AI/cloud outage messaging, local fallback, diagnostics export with PII redaction, and an incident/deletion request workflow.
6. Release controls: private tester channel, deferred publication, versioned privacy disclosures, reproducible release ZIP checksums and rollback instructions.

## Recommended Dashboard declarations

### Single purpose

> Auto Fill Order converts order text supplied by the user into reviewed recipient and shipment fields and fills those fields into supported Vietnamese carrier order forms.

### Data categories to verify and declare

- Personally identifiable information: recipient name, phone number and delivery address.
- Form/order content: raw pasted text or image, order code, COD, notes and extracted shipping fields.
- Authentication/account data: user/shop identity, session/access credentials and device identifier used to authorize the service.
- Website interaction/content only to the extent required to read/write the supported carrier order form.
- Product telemetry or diagnostics, if any; disclose event fields and retention separately from order content.

### Permission justification checklist

- `storage`: local settings, session state, drafts/cache and user preferences.
- `alarms`: name the exact scheduled maintenance/sync task and interval; remove if not essential.
- Host permissions: one justification per production API/carrier origin and the user-facing feature it enables.
- `tabs`, `clipboardRead`, `unlimitedStorage`: submit only after evidence shows a narrower alternative cannot implement the released feature.

## Submission sequence

1. Freeze the release's single purpose and data-flow diagram.
2. Remove or narrow permissions/hosts; validate remote selector data cannot become remote logic.
3. Finish the hosted privacy policy, terms, consent UI, deletion/export flow and processor evidence.
4. Add required icons and listing assets; make metadata match actual local, AI and cloud behavior.
5. Run the production build and sync to `extension/`; load that directory unpacked and test every supported carrier, offline fallback, login/logout, AI quota failure and data deletion.
6. ZIP the contents of `extension/`, inspect the archive root and scan for secrets/unneeded files.
7. Publish Private to trusted testers; fix field evidence and support issues.
8. Submit with complete Test Instructions and deferred publishing. Monitor the publisher inbox; if review exceeds three weeks, use CWS support. ([Review process](https://developer.chrome.com/docs/webstore/review-process))

## Source index

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Privacy policy](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [Disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Register and set up the account](https://developer.chrome.com/docs/webstore/register)
- [Developer account setup](https://developer.chrome.com/docs/webstore/set-up-account)
- [Prepare the extension](https://developer.chrome.com/docs/webstore/prepare)
- [Publish](https://developer.chrome.com/docs/webstore/publish)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)
- [Listing details](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Images](https://developer.chrome.com/docs/webstore/images)
- [Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)
- [Payments policy](https://developer.chrome.com/docs/webstore/program-policies/accepting-payment)
- [Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms)

