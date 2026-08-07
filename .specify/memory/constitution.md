<!--
Sync Impact Report
- Version change: (new) -> 1.0.0
- Modified principles: N/A (Initial creation)
- Added sections: Core Principles, Governance
- Removed sections: N/A
- Templates requiring updates: N/A
- Follow-up TODOs: None
-->

# Auto-fill Shipping Forms Extension Constitution

## Core Principles

### I. Preserve Core Workflow & Functionality
Maintain the fundamental user flow without disruption: paste raw order text -> parse -> review -> fill form. When making modifications, prefer small, targeted, and localized edits rather than broad rewrites to minimize regression risks.

### II. Lightweight & Encapsulated UI
The injected floating panel MUST remain lightweight. All UI components MUST be encapsulated within the shadow DOM to prevent styling conflicts with the host pages (VNPost and J&T). Do not break or circumvent the injected shadow-root structure.

### III. DOM Compatibility & Resilience
DOM automation and event simulation MUST remain fully compatible with the target sites. Implement minimal and highly targeted changes when interacting with the host page's DOM to ensure resilience against minor site updates.

### IV. Strict Security & Privacy
Network and AI integrations MUST use HTTPS with strict SSL/TLS validation. Do not disable certificate validation, weaken proxy security, or introduce insecure fallback behaviors unless explicitly requested. Never expose secrets or hard-code credentials in the repository.

### V. Localization & Style Preservation
Preserve the existing extension style and Vietnamese user-facing copy. Do not change the primary language or alter the established user experience unless there is a clear, explicit reason to do so.

## Governance

This Constitution supersedes all other practices and serves as the ultimate source of truth for the project. 
All pull requests and code modifications MUST verify compliance with these principles. Because this repository lacks an automated build/test pipeline, all changes MUST be manually validated by reloading the unpacked extension in a browser and verifying behavior on the supported VNPost/J&T pages.

**Version**: 1.0.0 | **Ratified**: 2026-07-17 | **Last Amended**: 2026-07-17
