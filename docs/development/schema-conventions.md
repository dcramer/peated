# Bottle Schema Conventions

This document has been consolidated. It defines no independent conventions.

- [Whisky Identity Model](../architecture/whisky-identity-model.md) owns Bottle,
  BottleGroup, field ownership, editing, matching, and consumer identity.
- [Bottle Normalization Contract](../architecture/bottle-normalization-contract.md)
  owns deterministic string-normalization boundaries.
- [Bottle Classifier](../architecture/bottle-classifier.md) owns semantic
  classification and evidence policy.
- `apps/server/src/db/schema/` and exported runtime schemas own exact field and
  persistence shapes.

Keep this pointer until historical change inventories no longer reference the
old path; new documentation must link to the owning source directly.
