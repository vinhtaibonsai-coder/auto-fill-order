# Research: Order Parsing Process Review

**Date**: 2026-07-22 | **Branch**: `001-order-parsing-process`

## R1: Existing Local Parser Capability

**Decision**: Reuse `OrderProcessor.parse()` as the local extraction engine.

**Rationale**: The existing parser (`src/application/order-parser/parser.js:315-439`) already extracts all required fields from raw Vietnamese text:
- `name` — recipient name via surname detection and label matching
- `phone` — phone numbers via regex + segmentation
- `address` — full address via province/keyword heuristics
- `productItem` — item description with weight (e.g., "5kg đỗ quyên")
- `codAmount` — COD value parsed from "tr"/"k" notation
- `collectFee` — boolean for "Chỉ thu cước" instruction
- `orderCode` — order codes with SKU filtering
- `extraNote` — social media notes (FB/Zalo/TikTok)

The parser runs synchronously in <10ms on typical inputs. No AI dependency.

**Alternatives considered**:
- Write a new parser: Rejected — existing parser already handles the test case in spec (L23) correctly.
- Use AI for extraction: Rejected — adds latency, cost, and contradicts the "offline" philosophy of the extension.

## R2: UI Integration Point

**Decision**: Insert `PARSE_REVIEW` state between `IDLE` and `LOADING` in `App.jsx` state machine.

**Rationale**: Current flow in `App.jsx:76-175`:
```
IDLE → (user pastes + clicks parse) → LOADING → (AI call) → REVIEW → (confirm) → fill form
```

New flow:
```
IDLE → (user pastes + clicks parse) → PARSE_REVIEW → (user confirms) → LOADING → (AI call) → REVIEW → (confirm) → fill form
```

The `PARSE_REVIEW` state displays locally-parsed data. User can edit or confirm before AI processing. This:
- Satisfies FR-005 (UI step before submission)
- Satisfies FR-006 (user proceeds from intermediate step)
- Reduces unnecessary AI calls for straightforward orders

**Alternatives considered**:
- Show parsed data inside LOADING skeleton: Rejected — conflates two distinct states; user cannot edit.
- Add review after AI response (current `REVIEW` state): Rejected — this already exists; the spec asks for review BEFORE form submission, and local parse is the earliest verification point.

## R3: Component Design

**Decision**: Create `ParseReview.jsx` component rendered during `PARSE_REVIEW` state.

**Rationale**: Follows existing component pattern (`ConfidenceReview`, `SkeletonReview`). Component receives parsed data as props, displays fields in editable form, emits `onConfirm(editedData)` and `onCancel()` callbacks.

**Key UI elements** (Vietnamese copy):
- Header: "Xem lại thông tin tách đơn"
- Fields: Sản phẩm, Địa chỉ, SĐT, Mã đơn, COD, Thu cước, Ghi chú
- Buttons: "Xác nhận" (proceed to AI), "Sửa lại" (back to edit raw text)

## R4: Bypass AI for Simple Orders

**Decision**: Optional — not implemented in this phase.

**Rationale**: The spec focuses on the review step, not AI bypass. Adding skip-AI logic introduces branching complexity (when to skip? confidence thresholds?) that is out of scope. The review step alone satisfies all requirements. AI bypass can be a follow-up feature.

**Alternatives considered**:
- Add "Skip AI, fill directly" button: Deferred — requires confidence threshold design, separate feature.
- Auto-skip AI when local parse confidence is high: Deferred — no confidence scoring exists in local parser yet.

## R5: Error Handling

**Decision**: If `OrderProcessor.parse()` returns default/empty fields, display them with visual warnings (yellow highlights).

**Rationale**: The parser returns `"không tìm thấy"` for missing address, empty string for missing fields. The review UI should visually indicate low-confidence extractions (empty or fallback values) so the user can correct them before proceeding.

**Alternatives considered**:
- Block proceeding with empty fields: Rejected — too restrictive; user may want to proceed and let AI correct.
- Auto-retry with different parsing: No — single parser, no alternative strategies.
