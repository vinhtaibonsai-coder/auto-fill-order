# Internal Contracts: Parser → Review UI

## ParseReview Component Contract

### Props Interface

```typescript
interface ParseReviewProps {
  data: ParsedOrder;          // Output from OrderProcessor.parse()
  rawText: string;            // Original user input (preserved for re-parse)
  onConfirm: (editedData: ParsedOrder) => void;  // Proceed to AI
  onCancel: () => void;       // Return to IDLE
}
```

### ParsedOrder Shape

```typescript
interface ParsedOrder {
  name: string;           // Recipient name or ""
  phone: string;          // Primary phone or ""
  address: string;        // Full address or "không tìm thấy"
  orderCode: string;      // Comma-separated codes or ""
  productItem: string;    // Item description or ""
  codAmount: number;      // COD in VND (0 if absent)
  collectFee: boolean;    // "Chỉ thu cước" flag
  extraPhones: string[];  // Additional phones
  extraNote: string;      // Social media notes or ""
}
```

### State Machine Contract

```
App.state === 'PARSE_REVIEW'
  → Renders <ParseReview /> with parsedData + rawText
  → onConfirm(editedData) → sets parsedData, transitions to 'LOADING'
  → onCancel() → transitions to 'IDLE', preserves rawText
```

### Ordering Guarantee

`ParseReview` MUST be rendered BEFORE any AI call is initiated. The AI call only triggers after user confirmation in this component.
