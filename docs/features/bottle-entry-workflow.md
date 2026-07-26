# Bottle Entry Workflow

## Identity Contract

Bottle saves should complete after Peated persists the bottle. Slow duplicate
review, catalog verification, indexing, and similar work should run after the
save unless it is required for deterministic correctness.

Every marketed release is one concrete Bottle. Each Bottle durably stores the
shared expression values and exact fields needed to render, search, and
understand it without loading its BottleGroup. The group owns the generic
expression label, shared editing semantics, relationship presentation, and
member-derived aggregates; it does not supply missing exact Bottle data at read
time.

Manual entry uses one concrete Bottle form for add and edit. The form combines
shared expression fields with exact Bottle fields such as edition, ABV, release
year, vintage year, and cask details. Independent creation atomically creates a
complete Bottle and an automatic singleton BottleGroup. Ordinary users never
create, select, or name a BottleGroup.

“Add another release” pre-fills the selected Bottle's durable fields and submits
the same independent Bottle creation operation. It also creates a singleton;
later grouping is automatic and outside manual intervention.

Bottle pages and search results render exact fields from the independently
complete Bottle. A Bottle page may link quietly to all related releases using
that active member as the route anchor. The release-family page uses group-owned
presentation and aggregate data and lists independently complete member
Bottles. Canonical paths and user-facing terminology do not expose BottleGroup
ids, and there is no public `/bottle-groups` route.

Consumer workflows carry one Bottle id. Assigned aliases also point directly to
one Bottle; a general expression alias points to the retained general Bottle,
not BottleGroup or its representative. Library, tasting, Flight, review, and
price flows use that same Bottle identity without a CatalogTarget or second
resolver. Uncertain identity remains unresolved.

## Creation And Editing

- Add Bottle accepts shared and exact fields in one submission and always
  creates a Bottle, never a child release record.
- “Add another release” uses the selected Bottle and its group's shared label
  only to prefill the same independent form. Submission does not carry source
  Bottle or group authority and starts in a new singleton group.
- Creation returns the complete Bottle. Library, tasting, image, proposal, and
  return-intent continuations use its Bottle id directly rather than
  reconstructing a Bottle/release pair.
- Exact-only moderator edits change only the selected Bottle and its exact
  aliases.
- Shared moderator edits update the BottleGroup and atomically rematerialize
  every member Bottle's complete shared identity while preserving each
  member's exact fields. A shared name change therefore regenerates all member
  Bottle names.
- Automatic grouping runs outside ordinary creation. Likely related groups may
  be suggested, but name similarity, shared brand, or shared series is not
  enough to merge them silently.

Image uploads may still be part of the visible save flow, but the server remains
authoritative for final image dimensions, encoding, and quality. Client-side
resizing should reduce upload latency without replacing server processing.

## Current Workflow Details

- Manual bottle creation relies on deterministic alias duplicate checks in the
  request path and queues catalog verification after creation.
- Add and edit share one concrete Bottle form with explicit shared-versus-exact
  field ownership.
- Exact Bottle search and related-release rows share one Bottle-owned metadata
  renderer; BottleGroup hydration is not required for exact details.
- Automatic grouping changes are audited catalog operations outside the manual
  entry workflow. They never move Bottle-owned activity or aliases onto a
  BottleGroup.
- Bottle and tasting image uploads avoid GCS resumable-session startup for small
  processed images.
- Browser-side image blobs keep a high-quality intermediate image capped at a
  1600px edge before the server creates canonical derivatives.
- Moderators can update bottle images for bottles they did not create.

## Improvement Plan

- Improve partial-success UX so the page can say when the bottle was saved but
  image upload failed, timed out, or can be retried.
- Track save latency separately for bottle create, image processing, storage
  writes, and post-save jobs.
- Keep exact duplicate protection deterministic and fast; use queued verifier
  output for review, repair, sampling, or moderation rather than blocking saves.
- Continue using Peated's integration-first backend tests. Add focused route
  tests for each workflow branch instead of replacing them with broad mocks.
- Verify add/edit flows with local browser automation at desktop and mobile
  widths before shipping user-facing form changes.
