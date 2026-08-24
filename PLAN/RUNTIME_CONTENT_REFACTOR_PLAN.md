# RUNTIME_CONTENT_REFACTOR_PLAN.md

## 1. Runtime Content Script Architecture

The content script operates on carrier websites (VNPost and J&T) using a modular pipeline loaded in sequence:

```text
Config & Storage
      ↓
Auth & Session (AuthSession, AuthService)
      ↓
Address Engine (Normalizer, Aliases, Rules, Fuzzy, Parser, AI)
      ↓
Carrier Adapters (VNPostAdapter, JtAdapter)
      ↓
Order Parser (OrderProcessor)
      ↓
UI Layer (Floating Panel, Styles, Toasts)
      ↓
Runtime Orchestrator (src/runtime/content/index.js)
```

## 2. Responsibilities Breakdown

1. **Carrier Detection & Form Matching**:
   - `VNPostAdapter` (`src/domain/carrier/vnpost/`): Selectors, autocomplete handling, form field filling, order code scraping.
   - `JtAdapter` (`src/domain/carrier/jt/`): Selectors, React/Vue synthetic events, address cascade selection, COD filling.
2. **Order Scrape & Sync**:
   - Scopes DOM inputs cleanly with fallback selectors.
   - Dispatches custom events (`order-saved-db`) to notify UI without reload.
3. **Floating Panel Integration**:
   - Shadow DOM / Draggable card to prevent style leakage from host carrier pages.
   - Communicates with background worker via standard `chrome.runtime.sendMessage`.

## 3. Current `src/runtime/content/index.js` Responsibility Map

### Parser responsibilities
- Reads raw order text from the injected panel.
- Runs local parser first, then normalizes address through `AddressEngine`.
- Updates `globalThis.parsedDataStore`.
- Emits `autofill:parsed` and renders parsed data through the panel contract.

### DOM automation responsibilities
- Waits for target carrier forms.
- Calls the active carrier adapter (`VNPostAdapter` or `JTAdapter`) to fill fields.
- Scrapes form values after user edits through `scrapeOrderFromDOM`.
- Watches carrier pages for tracking codes after submit.

### State, observers, and interception responsibilities
- Owns `parsedDataStore`, pending refill, clear/save/update flows.
- Observes DOM mutations to keep the panel present on SPA carrier pages.
- Polls URL changes for carrier SPAs.
- Intercepts fetch responses only around order submission/tracking workflows and restores the original fetch in cleanup paths.
- Handles Chrome runtime messages for bulk fill and revoked devices.

## 4. Extraction Plan And Decisions

- `src/runtime/content/carrier-runtime.js` is now the focused carrier runtime helper module. It owns platform metadata, URL detection, and carrier account detection.
- `src/runtime/content/index.js` remains the orchestrator. It consumes `globalThis.AutoFillCarrierRuntime` and keeps the existing public event/message contracts stable.
- VNPost-specific selectors/fill behavior already lives in `src/domain/carrier/vnpost/selectors.js` and `src/domain/carrier/vnpost/autofill.js`; no extra movement is needed in Phase 8.
- J&T-specific selectors/fill behavior already lives in `src/domain/carrier/jt/selectors.js` and `src/domain/carrier/jt/autofill.js`; no extra movement is needed in Phase 8.
- `manifest.json` loads `src/runtime/content/carrier-runtime.js` immediately before `src/runtime/content/index.js`.

## 5. Stable Contracts To Preserve

- Globals: `AutoFillCarrierRuntime`, `detectCarrierAccount`, `checkUrlAndInject`, `afTriggerFillForm`, `afHandleSaveOrder`, `parsedDataStore`.
- Events: `autofill:parsed`, `order-saved-db`.
- Runtime messages: `deviceRevoked`, `FILL_FROM_BULK`.
