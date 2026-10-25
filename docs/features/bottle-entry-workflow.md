# Bottle Entry Workflow

This document describes the current manual Bottle create and edit workflow. The
[Whisky Identity Model](../architecture/whisky-identity-model.md) owns identity,
field ownership, grouping, and merge semantics.

For researched catalog backfills, deduplication, and production API edits, use
the [Catalog Maintenance](../operations/catalog-maintenance.md) workflow.

## Creation

- The Add a bottle form accepts one flat Bottle input. The server owns field storage and
  returns one independently complete Bottle.
- A submitted stated age belongs to the new Bottle. The singleton BottleGroup
  starts without a shared age. A reviewed shared edit can establish one later.
- A release can have only a year, a year and month, or a full date. A month
  requires a year, and a day requires a month. Store only the parts supported
  by evidence. The server rejects invalid combinations.
- When a new Bottle has a distillation year and a stated age but no bottling
  year, the form fills bottling year with their sum. It stops once the user
  types their own. Age counts whole years in the cask, so the real bottling
  year can be one later; the user checks it against the label.
- Creation atomically creates a singleton BottleGroup. Users do not select,
  name, or submit authority for a group.
- Deterministic reference duplicate checks remain in the request path. Slow catalog
  verification, review, indexing, and similar work run after persistence.
- While the user fills the form, an advisory check lists existing Bottles that
  may match. It sends only the facts that Bottle search uses to match, so
  editing other fields does not start a new check. Save is never disabled by
  the check. If one is running, Save waits for it and then opens the review. If
  the check fails, the Bottle saves anyway.
- “Add a similar bottle” only prefills the same independent creation form from
  the selected Bottle. It does not reuse or join the source BottleGroup. It
  leaves bottler empty when the source names its own distillery Brand as
  bottler, because an official release has no bottler. It still copies any
  other bottler, such as an independent bottler's own label.
- A created Bottle id continues directly into Library, tasting, image, proposal,
  and return-intent workflows. The browser never reconstructs a legacy
  Bottle/BottleRelease pair.

When photo resolution suggests the wrong Bottle, the user can search or open
manual creation with the pending photo and the label fields it read, such as
cask number, maturation, outturn, and bottling year. The
[photo-assisted Bottle resolution](./photo-assisted-bottle-resolution.md) owns
that handoff.

## Editing

- Add and edit use one Bottle form and flat Bottle input. The server owns field
  storage and shared fan-out.
- A stated-age edit changes the selected Bottle. The client does not select an
  age storage scope.
- An exact edit changes only the selected Bottle and its exact references.
- A shared edit updates the BottleGroup and updates every
  member Bottle while preserving exact fields and references.
- Independently created Bottles stay in singleton groups. Similar names, brand,
  or series do not merge them automatically.
- The form cannot move a Bottle to another group.

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
[local UI verification playbook](../development/local-web-checks.md).
