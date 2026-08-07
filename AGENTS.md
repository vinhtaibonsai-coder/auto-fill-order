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
