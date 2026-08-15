# Implementation Plan: Order Parsing Process Review

**Branch**: `001-order-parsing-process` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-order-parsing-process/spec.md`

## Summary

Add an intermediate review step to the order parsing flow. Currently: paste text → AI → AddressEngine → ConfidenceReview → fill form. The feature inserts a local-parse-first step: paste text → **local parser extracts fields** → **user reviews extracted data** → (optionally proceed to AI/AddressEngine) → fill form. This builds trust, lets users catch extraction errors before form submission, and reduces unnecessary AI calls for straightforward orders.

## Technical Context

**Language/Version**: JavaScript (ES2022+), JSX (React 19)

**Primary Dependencies**: React 19, Chrome Extension Manifest V3, Supabase JS v2

**Storage**: Chrome Extension `storage.local` for settings; Supabase for order history

**Testing**: Vitest (unit), manual browser reload validation (no automated E2E pipeline)

**Target Platform**: Chrome browser (Manifest V3 extension), injected content scripts on VNPost (`my.vnpost.vn`) and J&T (`shop.jtexpress.vn`, `khachhang.jtexpress.vn`)

**Project Type**: Browser extension (content script + service worker)

**Performance Goals**: Local parse completes in <100ms; review UI renders within 200ms of parse completion

**Constraints**: All UI must be encapsulated in shadow DOM; Vietnamese copy per Constitution; must not break existing VNPost/J&T DOM automation

**Scale/Scope**: Single feature addition; ~3 files modified, ~1 new component (~150 LOC)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate Status | Notes |
|-----------|-------------|-------|
| I. Preserve Core Workflow | ✅ PASS | Adds review step before existing flow; does not alter core paste→parse→fill pipeline |
| II. Lightweight & Encapsulated UI | ✅ PASS | New component rendered inside existing shadow DOM `DraggableCard`; no external DOM injection |
| III. DOM Compatibility | ✅ PASS | No changes to VNPost/J&T DOM interaction; review step is purely internal to extension panel |
| IV. Strict Security & Privacy | ✅ PASS | Local parsing runs entirely in-content-script; no new network calls; no credentials exposed |
| V. Localization & Vietnamese Copy | ✅ PASS | All new UI strings in Vietnamese; matches existing style |

## Project Structure

### Documentation (this feature)

```text
specs/001-order-parsing-process/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── application/
│   └── order-parser/
│       └── parser.js           # Already exists — local parse logic (OrderProcessor.parse)
├── ui/
│   └── panel/
│       ├── App.jsx             # MODIFY: Insert PARSE_REVIEW state between IDLE and LOADING
│       └── components/
│           └── ParseReview.jsx # NEW: Intermediate review UI component
└── domain/
    └── carrier/
        ├── vnpost/
        └── jt/
```

**Structure Decision**: Minimal surgical change. Reuse existing `OrderProcessor.parse()` for local extraction. Add one new React component (`ParseReview.jsx`) and modify `App.jsx` to insert a `PARSE_REVIEW` state between user paste and AI call. No new directories, no new dependencies.

## Complexity Tracking

> No constitution violations to justify.
