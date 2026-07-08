## Why

Users need a lightweight way to distinguish active inventory from bottles they have opened or consumed without forcing every library entry into detailed inventory tracking. Whisky collectors also expect terminology such as sealed, open, and empty, while "finished" is ambiguous because it commonly refers to cask finishing.

## What Changes

- Add optional bottle status tracking to Library entries.
- Support status values `sealed`, `open`, and `empty`, with unset status remaining distinct from `sealed`.
- Expose bottle status through collection bottle API responses and mutations.
- Let library owners set or clear status inline from their library list and immediately after adding a bottle to Library.
- Add Library filtering by status, including unset entries.

## Capabilities

### New Capabilities

- `library-bottle-status`: Optional status tracking, display, mutation, and filtering for bottle entries in a user's Library.

### Modified Capabilities

None.

## Impact

- Database schema: add nullable status storage to `collection_bottle`.
- API: extend collection bottle schemas, serialization, create behavior, list filters, and add an entry update route.
- Web UI: update Library list rows, Library filters, and add-to-library confirmation flows.
- Tests: add targeted backend route/schema coverage and frontend Library interaction coverage.
