# Bottle Entry Workflow

## Current Direction

Bottle saves should complete after Peated persists the bottle. Slow duplicate
review, catalog verification, indexing, and similar work should run after the
save unless it is required for deterministic correctness.

Image uploads may still be part of the visible save flow, but the server remains
authoritative for final image dimensions, encoding, and quality. Client-side
resizing should reduce upload latency without replacing server processing.

## Current Fixes

- Manual bottle creation relies on deterministic alias duplicate checks in the
  request path and queues catalog verification after creation.
- Bottle and tasting image uploads avoid GCS resumable-session startup for small
  processed images.
- Browser-side image blobs keep a high-quality intermediate image capped at a
  1600px edge before the server creates canonical derivatives.
- Moderators can update bottle images for bottles they did not create.

## Improvement Plan

- Align add and edit bottle fields. Decide which legacy bottle-level release
  fields stay visible, which move to child bottlings, and which need moderator
  warnings.
- Separate parent bottle creation from exact bottling creation more clearly when
  a user enters batch, vintage, cask, ABV, or release-year details.
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
