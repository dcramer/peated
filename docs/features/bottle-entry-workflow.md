# Bottle Entry Workflow

This document describes the current manual Bottle create and edit workflow. The
[Whisky Identity Model](../architecture/whisky-identity-model.md) owns identity,
field ownership, grouping, and merge semantics.

## Creation

- Add Bottle accepts the shared expression and exact marketed-release fields in
  one submission and returns one independently complete Bottle.
- Creation atomically creates a singleton BottleGroup. Users do not select,
  name, or submit authority for a group.
- Deterministic alias duplicate checks remain in the request path. Slow catalog
  verification, review, indexing, and similar work run after persistence.
- “Add a similar bottle” only prefills the same independent creation form from
  the selected Bottle. It does not reuse or join the source BottleGroup.
- A created Bottle id continues directly into Library, tasting, image, proposal,
  and return-intent workflows. The browser never reconstructs a legacy
  Bottle/BottleRelease pair.

When photo resolution suggests the wrong Bottle, the user can search or open
manual creation with supported label fields and the pending photo. The
[photo-assisted resolution contract](./photo-tasting-entry.md) owns that handoff.

## Editing

- Add and edit use one concrete Bottle form with explicit shared-versus-exact
  field ownership.
- An exact edit changes only the selected Bottle and its exact aliases.
- A shared edit updates the BottleGroup and atomically rematerializes every
  member Bottle while preserving exact fields and aliases.
- Independently created Bottles stay in singleton groups. Similar names, brand,
  or series do not merge them automatically.
- No manual or automatic regrouping operation ships in the current workflow.

## Save Boundary

Bottle persistence is the authoritative save. Image handling may remain visible
to the user, but server processing owns final dimensions, encoding, and quality.
Client resizing is only a latency optimization.

Post-save side-effect failure must not make a durable Bottle appear unsaved.
Surface partial success when the UI has a recovery action; otherwise log enough
safe context for investigation and retry. Follow
[Background Work](../policies/background-work.md) and
[Error Handling](../policies/error-handling.md).

## Verification

Use integration tests for create, duplicate, exact-edit, shared-edit, and
continuation branches. Verify user-facing add and edit changes at desktop and
mobile widths with the
[local UI verification playbook](../development/local-ui-verification.md).
