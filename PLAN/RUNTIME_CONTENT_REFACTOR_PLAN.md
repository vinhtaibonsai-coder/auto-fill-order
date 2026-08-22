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
