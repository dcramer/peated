## 1. Schema And Moderation History

- [x] 1.1 Add nullable `removedAt`, `removedByActorId`, and `removalReason` fields to tastings, member reviews, and external reviews with actor references, valid-combination constraints, relations, and status/newest-list indexes.
- [x] 1.2 Extend the change object kinds with `member_review` and `external_review`; retain the existing `tasting` kind and add an object-and-time index needed for detail history.
- [x] 1.3 Generate the migration with `pnpm db:generate`; inspect the generated SQL and metadata without hand-editing either.
- [x] 1.4 Add a small source-aware moderation service that locks one row, validates remove or restore, resolves the administrator actor, changes current state, appends a content-free audit event, and treats repeated requests idempotently.
- [x] 1.5 Cover database state combinations, actor preservation, removal and restoration history, reason validation, row locking, missing records, and no-op transitions with integration tests.

## 2. Authoritative Removal Rules

- [x] 2.1 Inventory every direct tasting, member-review, and external-review table consumer and classify it as administrator inventory, owner deletion, internal ingestion, or ordinary visible behavior.
- [x] 2.2 Add reusable source-owned active-content predicates and apply them to ordinary list/detail APIs, Bottle and profile activity, combined review-and-tasting lists, sitemaps and public counts.
- [x] 2.3 Exclude removed records from member and external scores, tasting band counts, recommendations, public tasting-note counts, tag/category summaries, and every Bottle or BottleGroup recomputation input.
- [x] 2.4 Reject comments, toasts, image changes, and ordinary member content updates for removed targets while retaining permanent owner deletion.
- [x] 2.5 Keep external-review ingestion updates and `hidden` publication changes independent from manual removal; prove imports, Bottle assignment, source withdrawal, and source approval never clear removal fields.
- [x] 2.6 Cover anonymous, signed-in, author, follower, moderator, and administrator visibility; interaction rejection; owner deletion; and remove/restore summary recomputation with focused integration tests.

## 3. Administrator Content API

- [x] 3.1 Define strict administrator list summaries, detail payloads, status filters, identity-only search inputs, moderation state, and bounded history schemas for member reviews, critic reviews, and tastings.
- [x] 3.2 Implement newest-first member-review list and detail routes with stable paging, member and Bottle identity search, privacy labels, content excerpts, complete review detail, and removal history.
- [x] 3.3 Implement newest-first critic-review list and detail routes with stable paging, site and Bottle identity search, publication and staging context, clip and source link, and no external-review body access.
- [x] 3.4 Implement newest-first tasting list and detail routes with stable paging, member and Bottle identity search, privacy labels, content excerpts, rating bands, interactions, and removal history.
- [x] 3.5 Add explicit remove/restore routes for all three source kinds using the shared moderation service and dispatch affected Bottle summary work only after commit.
- [x] 3.6 Cover administrator authorization, non-administrator rejection, private-content access, body exclusion, query boundaries, status filters, ordering, paging, details, mutations, idempotency, auditing, and dispatch behavior with server integration tests.

## 4. Administrator Content UI

- [x] 4.1 Add a Content navigation group with Reviews and Tastings, keeping these browse tools separate from the Moderation Inbox.
- [x] 4.2 Add `/admin/reviews` with Member reviews and Critic reviews tabs, stable tab URLs, loading and empty states, status filters, identity search, and newest-first tables.
- [x] 4.3 Add member-review detail pages showing member and Bottle identities, privacy, score, notes, flavor sections, serving context, image, dates, moderation status, and history.
- [x] 4.4 Add critic-review detail pages showing critic site, Bottle match, publication and staging context, original article, native score, clip, extracted tags, dates, moderation status, and history without stored bodies.
- [x] 4.5 Add `/admin/tastings` list and detail pages showing member and Bottle identities, privacy, band, notes, tags, serving context, image, interaction counts, dates, moderation status, and history.
- [x] 4.6 Add accessible remove and restore confirmation forms with required reasons, clear impact copy, pending state, preserved input on failure, query invalidation, focus management, and live announcements.
- [x] 4.7 Add deterministic tests for navigation selection, tab and filter URLs, rows, private and removed labels, source-specific details, body exclusion, confirmation behavior, success and error states, and responsive composition helpers.

## 5. Documentation And Verification

- [x] 5.1 Update Ratings and External Reviews documentation and add a focused content-moderation guide covering access, removal, restoration, audit reasons, owner deletion, private content, and critic-body boundaries.
- [x] 5.2 Run focused backend route, visibility, aggregate, recommendation, interaction, and audit tests; run server typecheck, lint, and formatting for touched files.
- [x] 5.3 Run focused web component tests, web typecheck, lint, and formatting for touched files.
- [x] 5.4 Manually QA authenticated administrator lists and details at desktop and mobile widths, including identity search, status filters, private member content, critic links, removal, restoration, failure retention, and direct removed-detail URLs.
- [x] 5.5 Verify anonymous and ordinary signed-in users cannot read removed records or administrator payloads and that removed records no longer affect Bottle summaries after queued work completes.
