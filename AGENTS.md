# AGENTS.md

## Project overview
This workspace is a browser extension that auto-fills shipping/order forms for VNPost and J&T sites. The extension injects a floating panel into supported pages and uses local parsing plus AI-assisted normalization to fill form fields.

## Key files
- [manifest.json](manifest.json): extension manifest, permissions, and content script injection.
- [content.js](content.js): core parsing, AI/API calls, form filling, and browser-page automation.
- [ui.js](ui.js): panel UI, shadow DOM styling, drag behavior, and button wiring.
- [style.css](style.css): stylesheet for the injected UI.

## Behavioral Guidelines (from CLAUDE.md)
1. **Think Before Coding**: Don't assume. Surface tradeoffs explicitly. Ask if anything is unclear before coding.
2. **Simplicity First**: Write minimum code to solve the problem. Avoid speculative features or unnecessary abstractions.
3. **Surgical Changes**: Touch only what is required for the user's request. Match existing code style and do not refactor unbroken code.
4. **Goal-Driven Execution**: Define clear success criteria for every task and verify changes thoroughly before completing.

## Working conventions
- Preserve the existing flow: paste raw order text -> parse -> review -> fill form.
- Keep DOM automation and event simulation compatible with the target sites; prefer minimal, targeted changes.
- If you modify the UI, keep the panel lightweight and avoid breaking the injected shadow-root structure.
- If you change network or AI integration, keep HTTPS and strict SSL/TLS behavior intact. Do not disable certificate validation, weaken proxy security, or introduce insecure fallback behavior unless explicitly requested.
- Avoid exposing secrets or hard-coded credentials when adding new integrations.

## Validation
There is no build/test pipeline in this repository. After changes, validate by reloading the unpacked extension in a browser and checking the supported VNPost/J&T pages.

## Notes for agents
- Prefer small, local edits over broad rewrites.
- When debugging parsing or autofill issues, inspect the target page DOM and the current extension logic together.
- Preserve the current extension style and Vietnamese user-facing copy unless there is a clear reason to change it.

## Order identity invariant (mandatory)

Before changing order deduplication, upsert, tracking updates, or Customer Hub synchronization, read [docs/incidents/2026-08-28-repeat-customer-order-overwrite.md](docs/incidents/2026-08-28-repeat-customer-order-overwrite.md). Never use customer name, phone, address, or COD as an order identity. A returning customer with a different `order_code` is always a new order. Run `npm run test:repeat-order` after related changes.

## Panel & Options Auth Synchronization Invariant (mandatory)

Before modifying authentication, sessions, or panel injection, read [docs/incidents/2026-08-28-panel-auth-state-out-of-sync.md](docs/incidents/2026-08-28-panel-auth-state-out-of-sync.md). Always ensure `AuthService.isAuthenticated()` and `AuthSession.isAuthenticated()` are exported, and Content Script listens for `chrome.storage.onChanged` on `vnpost_session` to automatically switch between Login and Input panels in real-time.

## Account Creation Role Invariant (mandatory)

Before modifying Shop/account creation RPCs or profile synchronization, read [docs/incidents/2026-08-29-admin-create-shop-profiles-role-check.md](docs/incidents/2026-08-29-admin-create-shop-profiles-role-check.md). `profiles.role` is legacy and must remain `member` (or be omitted); real roles belong in `user_roles` and `shop_members`. Run `node tests/unit/admin-create-shop-profile-role.test.mjs` after related changes.

## PostgreSQL Function Default Invariant (mandatory)

Before changing an existing PostgreSQL function's parameter defaults, read [docs/incidents/2026-08-29-postgres-function-default-removal.md](docs/incidents/2026-08-29-postgres-function-default-removal.md). PostgreSQL cannot remove a parameter default with `CREATE OR REPLACE FUNCTION`; explicitly `DROP FUNCTION schema.name(argument_types)` first, recreate the function, and restore every required grant. Run `node tests/unit/auth-login-migration.test.mjs` after related changes.

Before adding overloads with default parameters, also read [docs/incidents/2026-08-29-is-system-admin-overload-ambiguity.md](docs/incidents/2026-08-29-is-system-admin-overload-ambiguity.md). Never leave both a zero-argument function and an overload whose defaults allow a zero-argument call. Do not use `DROP ... CASCADE` to repair authorization helpers because it can remove RLS policies and dependent RPCs. Run `node tests/unit/is-system-admin-overload-migration.test.mjs` after related changes.

## Extension Folder & Standalone Build Invariant (mandatory)

Before delivering any UI, Option page, or runtime changes, read [docs/incidents/2026-08-29-extension-folder-vite-dev-sync.md](docs/incidents/2026-08-29-extension-folder-vite-dev-sync.md). The user loads the unpacked extension directly from the `extension/` directory. Files in `extension/` MUST always contain standalone production-built bundles and never contain raw Vite dev-mode loading stubs. `npm run build` must always execute `vite build && node scripts/sync-extension.js` so that `extension/` is always updated.

## Print Tab CSP & Font Scale Invariant (mandatory)

Before modifying label rendering, print tabs, or HTML document generation, read [docs/incidents/2026-09-26-print-tab-csp-inline-script.md](docs/incidents/2026-09-26-print-tab-csp-inline-script.md). Never inject inline `<script>` tags or inline `on<event>` attributes into generated HTML documents for printing. All interactions (print buttons, close buttons, shortcuts, dimension changes, auto-print triggers) must be wired via `wirePrintTabControls()` from compiled extension scripts. Thermal shipping labels must support doubled font size (200% scale) by default. Run `node --test tests/unit/print-center-filter-and-carrier.test.mjs tests/unit/label-renderer.test.mjs` and `npm run build` after related changes.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
