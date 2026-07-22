# Bottle Entry Workflow

## Current Direction

Bottle saves should complete after Peated persists the bottle. Slow duplicate
review, catalog verification, indexing, and similar work should run after the
save unless it is required for deterministic correctness.

Manual entry uses one concrete Bottle form for add and edit. The form combines
shared expression fields with exact Bottle fields such as edition, ABV, release
year, vintage year, and cask details. Independent creation always creates a
complete Bottle in an automatic singleton BottleGroup; ordinary users never
select a source Bottle or BottleGroup.

“Add another release” pre-fills the selected Bottle's durable fields and submits
the same independent Bottle creation operation. It also creates a singleton;
later grouping is automatic and outside manual intervention.

Bottle pages and search results render exact fields from the independently
complete Bottle. A Bottle page may link quietly to all related releases, while
generic catalog-target links open `/bottle-groups/:id`. The group page clearly
states that the exact release is unspecified, uses group-owned presentation and
aggregate data, and lists exact member Bottles without substituting its
representative for any Bottle.

Image uploads may still be part of the visible save flow, but the server remains
authoritative for final image dimensions, encoding, and quality. Client-side
resizing should reduce upload latency without replacing server processing.

## Current Fixes

- Manual bottle creation relies on deterministic alias duplicate checks in the
  request path and queues catalog verification after creation.
- Add and edit share one concrete Bottle form with explicit shared-versus-exact
  field ownership. Shared moderator edits rematerialize the affected group,
  while exact edits affect only the selected Bottle.
- Add Bottle accepts exact release details without changing entity type or
  creating a BottleRelease.
- “Add another release” uses durable Bottle values only and never carries source
  Bottle or group authority into creation.
- Exact Bottle search and related-release rows share one Bottle-owned metadata
  renderer; BottleGroup hydration is not required for exact details.
- Moderator group merge and split use standalone, explicit forms. Merge names
  the destination whose shared identity wins and moves generic activity there;
  split requires the moved subset and representatives while generic activity,
  stable aliases, and editorial content remain on the source.
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
