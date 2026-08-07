# Feature Specification: Order Parsing Process Review

**Feature Branch**: `001-order-parsing-process`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Kiểm tra cách tách đơn: 5kg đỗ quyên 13e/28 trương Văn lực,cam lộ,Hồng bàng,Hải phòng Sđt:0929682381 Chỉ thu cước hiện qui trình tách đơn"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Parsing Results (Priority: P1)

As a user, I want to visually inspect the intermediate parsing results of a raw text order before the data is populated into the shipping form, so that I can verify the accuracy of the extraction process.

**Why this priority**: Correct data extraction is the core value of the extension. Allowing the user to see the extracted data before autofilling builds trust and ensures accuracy, especially for complex addresses or custom notes.

**Independent Test**: Can be fully tested by pasting a raw order text into the extension's input field and observing the UI displaying the extracted data points clearly.

**Acceptance Scenarios**:

1. **Given** the extension panel is open, **When** the user inputs "5kg đỗ quyên 13e/28 trương Văn lực,cam lộ,Hồng bàng,Hải phòng Sđt:0929682381 Chỉ thu cước" and triggers the parse action, **Then** the UI displays an intermediate view showing the separated fields: Item (5kg đỗ quyên), Address (13e/28 trương Văn lực, cam lộ, Hồng bàng, Hải phòng), Phone (0929682381), and Notes (Chỉ thu cước).
2. **Given** the intermediate parsing view is displayed, **When** the user reviews the data and confirms it, **Then** the extension proceeds to fill the VNPost/J&T forms.

### Edge Cases

- What happens when a phone number is missing from the raw text?
- How does the system handle multi-line raw text inputs with unclear boundary definitions?
- What happens if the address cannot be confidently mapped to a specific district or ward?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accurately extract the items/products and weights from raw Vietnamese order text.
- **FR-002**: System MUST accurately extract the full shipping address from the raw text.
- **FR-003**: System MUST accurately extract phone numbers from the raw text.
- **FR-004**: System MUST accurately extract payment instructions and specific delivery notes (e.g., "Chỉ thu cước").
- **FR-005**: System MUST provide a UI step to display the extracted fields to the user before form submission.
- **FR-006**: Users MUST be able to proceed with filling the target form from the intermediate UI step.

### Key Entities

- **Parsed Order**: An entity representing the structured output of the extraction process. Key attributes include: `items_description`, `address`, `phone_number`, `notes`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can clearly see all parsed data fields mapped to their respective logical categories in the UI within 1 second of triggering the parse action.
- **SC-002**: The extraction algorithm successfully structures the provided test case ("5kg đỗ quyên 13e/28 trương...") into the 4 correct categories (Item, Address, Phone, Notes) 100% of the time.
- **SC-003**: Users experience zero accidental form submissions before having the chance to review the parsed data.

## Assumptions

- The existing AI/Parsing logic can successfully break down the text, and the focus is on displaying the "parsing process" or validating its output.
- The UI panel has enough space to display the intermediate structured data.
- The user speaks Vietnamese and the UI copy will be in Vietnamese, as per project Constitution.
