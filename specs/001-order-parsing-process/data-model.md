# Data Model: Order Parsing Process Review

**Date**: 2026-07-22 | **Branch**: `001-order-parsing-process`

## Entities

### ParsedOrder

Represents the structured output of `OrderProcessor.parse()`. This is the data exchanged between the local parser and the review UI.

| Field | Type | Source | Required | Notes |
|-------|------|--------|----------|-------|
| `name` | `string` | `extractName()` | No | Recipient name; empty string if not found |
| `phone` | `string` | `extractPhoneNumbers()` | No | Primary phone; empty string if not found |
| `address` | `string` | Address extraction block | No | Defaults to `"không tìm thấy"` when absent |
| `orderCode` | `string` | `extractOrderCode()` | No | Comma-separated codes; empty string if not found |
| `productItem` | `string` | `extractProductItem()` | No | Item + weight; empty string if not found |
| `codAmount` | `number` | `parseCOD()` | No | COD in VND (integer); 0 if not found |
| `collectFee` | `boolean` | `parseCollectFee()` | No | `true` if "Chỉ thu cước" detected |
| `extraPhones` | `string[]` | `extractPhoneNumbers()` | No | Additional phone numbers beyond primary |
| `extraNote` | `string` | Social media detection | No | FB/Zalo/TikTok notes; empty string if not found |

### ReviewState (UI State)

Extended state machine for `App.jsx`. New state inserted between `IDLE` and `LOADING`.

```
IDLE → PARSE_REVIEW → LOADING → REVIEW → SUCCESS
                     ↘ IDLE (cancel)
```

| State | Description | Transition |
|-------|-------------|------------|
| `IDLE` | Waiting for user input | User pastes text → `PARSE_REVIEW` |
| `PARSE_REVIEW` | Displaying locally-parsed data | User confirms → `LOADING`; Cancel → `IDLE` |
| `LOADING` | AI processing (Groq call) | AI response → `REVIEW` |
| `REVIEW` | Displaying AI-corrected data with confidence | User confirms → fill form → `SUCCESS` |
| `SUCCESS` | Form filled successfully | Auto-reset → `IDLE` |

## Validation Rules

Derived from spec acceptance scenarios (spec.md L23):

| Rule | Description | Source |
|------|-------------|--------|
| VR-001 | Phone must be 10-11 digits starting with `0` | `isValidPhoneNumber()` |
| VR-002 | Address must contain at least one ward/district/province keyword | `AddressValidator.validate()` |
| VR-003 | COD amount must be non-negative integer | `parseCOD()` output |
| VR-004 | Product item must contain weight unit (kg/g/hộp/etc.) | `extractProductItem()` regex |

## State Transitions

```
[User paste] ──→ PARSE_REVIEW
                    │
          ┌─────────┴─────────┐
          ↓                   ↓
      [Confirm]           [Cancel]
          │                   │
          ↓                   ↓
       LOADING              IDLE
          │
          ↓
       REVIEW
          │
     ┌────┴────┐
     ↓         ↓
 [Confirm]  [Save only]
     │         │
     ↓         ↓
  SUCCESS   order-saved-db
     │
     ↓
   IDLE
```
