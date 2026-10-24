## Context

Peated stores three related kinds of content:

- a tasting records one member's experience and may use a fixed rating band;
- a member review records one member's considered 0-100 opinion about a Bottle;
- an external review records a critic site's opinion, source metadata, native score, generated clip, and Bottle match.

The public product combines eligible records where useful, but the source records and their write rules remain separate. The current administrator surfaces do not offer a complete content inventory:

- tastings have public list and detail routes, and administrators can permanently delete a tasting if they already know its ID;
- member reviews can be listed only for a Bottle, private-member visibility still applies to administrators, and only the owner can delete a review;
- external reviews can be listed for moderator matching, but the administrator table is scoped to one site and does not expose moderation status;
- external-review `hidden` state also represents staging, unresolved identity, and publication behavior. Approving a source can unhide eligible rows, so that field cannot safely represent a durable manual removal.

External review bodies are intentionally restricted to internal parser work. Even administrator API responses exclude them. The new interface therefore shows critic clips and source links, not stored article bodies.

The existing Moderation workspace owns queued human decisions, completed decision history, and operational recovery. Content browsing is an ordinary administrator tool and should not turn every review or tasting into an Inbox task.

## Goals / Non-Goals

**Goals:**

- Let administrators find recent member reviews, critic reviews, and tastings without knowing a Bottle or source first.
- Make the content, attribution, Bottle, rating, privacy, and current moderation state easy to inspect.
- Provide reversible removal with an explicit reason and durable actor history.
- Preserve member privacy outside the narrow administrator boundary.
- Make removal authoritative across public reads, interactions, and stored Bottle summaries.
- Keep critic ingestion and publication behavior independent from manual moderation.

**Non-Goals:**

- Editing a member's notes, score, tags, rating band, or attribution.
- Republishing or returning stored external-review bodies.
- Automatically detecting abusive content or creating moderation Inbox tasks.
- Suspending members, blocking future posts, or adding reports and appeals.
- Replacing member-owned permanent deletion or adding recovery after an owner deletes a record.
- Physically purging uploaded files from storage. Removing content stops Peated from returning or linking its image; file-retention cleanup remains owned by upload storage.

## Decisions

### 1. Group by the moderator's concept, then preserve source differences

Admin navigation adds an ordinary Content group:

```text
Content
├── Reviews
│   ├── Member reviews
│   └── Critic reviews
└── Tastings
```

`/admin/reviews` opens member reviews by default. `/admin/reviews/critics` shows critic reviews. Tastings remain at `/admin/tastings` because their intent, rating bands, repeated-entry behavior, and interactions differ from reviews.

Member and critic reviews share the Reviews heading because both are considered opinions about exact Bottles. Separate tabs keep source-specific fields and actions clear without creating unrelated top-level navigation items.

This Content group remains separate from Moderation. The Inbox continues to contain work that currently requires a disposition; Content is a searchable inventory that administrators visit when investigating a report or checking records.

### 2. Use source-specific administrator read models

The server adds strict administrator-only list, detail, and moderation contracts for each source kind. List responses are narrow summaries for tables; detail responses contain the fields necessary to inspect that kind. They do not reuse public routes because public privacy and removal filters are intentionally different.

The list routes support:

- newest-first paging with ID as the stable tie-breaker;
- active, removed, or all status;
- a bounded query over stable ID, member name, critic site, and Bottle identity;
- source-specific display fields such as member score, tasting band, critic native score, privacy, and content excerpt.

Search does not match private notes or clips. This avoids placing fragments of private content into URLs, access logs, or telemetry. Administrators inspect the content on the returned rows and detail pages after locating it through identity fields.

The detail routes return full tasting or member-review notes, tasting-note tags, rating data, image URL, member identity, privacy label, Bottle identity, dates, current removal information, and bounded moderation history. Critic details return their public clip, extracted tags, source and article facts, original URL, native score, Bottle match, publication and staging state, and removal information. They never return `review_body.body`.

All reads require administrator authority. Components and API telemetry must not log response content, query results, notes, clips, usernames, or image URLs.

### 3. Store manual removal separately on every source record

Each source table receives the same nullable fields:

- `removedAt` records whether manual moderation currently removes the record;
- `removedByActorId` identifies the administrator actor responsible for the current removal;
- `removalReason` stores the administrator's concise reason.

All three values are null for active records and set together for removed records. Database constraints enforce that valid combination. Indexes support status plus newest-first administrator lists. Existing rows need no backfill because null means active.

External reviews keep their existing `hidden` field. `hidden` continues to own ingestion staging, unresolved matches, individual publication visibility, and source publication behavior. Public visibility requires both the existing publication rule and `removedAt IS NULL`. Scraper imports, Bottle assignment, and source approval may change `hidden`, but they never clear `removedAt`, `removedByActorId`, or `removalReason`.

`deletedAt` was rejected because member-owned deletion still permanently deletes a record. The visible action is `Remove from Peated`, and the stored name `removedAt` describes reversible moderation without confusing it with deletion.

### 4. Record current state and append-only history

Each source has an explicit administrator moderation mutation accepting:

```text
removed: boolean
reason: non-empty bounded string
```

The mutation locks the source row, validates the requested transition, resolves the authenticated user's stable actor, updates the three current-state fields, and appends a `change` row in one transaction. The change data contains only the moderation action and reason; it does not copy notes, clips, image URLs, usernames, or other content.

The existing `object_type` enum already contains `tasting`; it gains `member_review` and `external_review`. Removal and restoration are recorded as updates so the source record remains present. The current row supports fast visibility checks, while append-only changes preserve prior removals after a restoration clears the current fields.

A request that asks for the already-current state returns that state without adding a duplicate audit event or dispatching duplicate work. Restoration also requires a reason so the history explains why content returned.

A generic moderation mutation was rejected. Three explicit source mutations make authorization, identity, side effects, and tests easy to follow, while a small internal helper may share the transaction-safe audit shape.

### 5. Make removal authoritative but preserve owner deletion

Removed records are readable only through the administrator content routes. Ordinary list and detail reads treat them as absent, including for the author. Activity feeds, profile pages, Bottle pages, sitemaps, comments, toasts, badges, recommendations, public counts, rating summaries, and tasting-note summaries exclude them.

New comments, toasts, image changes, and ordinary content updates reject a removed target. A member may still permanently delete their own removed tasting or review. This preserves the member's existing data-deletion control and does not restore public visibility.

For a removed member review, the one-review-per-member-and-Bottle row remains reserved. Saving the Bottle review again does not clear removal or publish replacement text; the API rejects the update until an administrator restores the review or the member permanently deletes it. A new tasting remains a separate record under the existing model; this change does not act as a member suspension system.

External ingestion may continue refreshing source-owned metadata and parser output on a removed external review, but it cannot clear manual removal. This preserves scraper idempotency without republishing the record.

### 6. Recompute derived data after moderation transitions

Removal and restoration dispatch the existing Bottle summary recomputation after the transaction commits. The source ID and the locked row's current Bottle ID determine the affected Bottle. External-review rows without a Bottle do not dispatch Bottle work.

All authoritative summary queries add the removal predicate:

- member review scores and critic scores;
- tasting rating-band counts and recommendation inputs;
- combined public review-and-tasting counts and lists;
- tasting-note tag and category summaries;
- source-specific totals shown publicly.

The implementation audits direct table consumers instead of relying on the web UI to hide rows. Focused integration tests prove both immediate row visibility and recomputed summary behavior for removal and restoration.

### 7. Use list and detail pages with explicit actions

The administrator lists show identity first: member or critic source, Bottle, rating, bounded content excerpt, date, privacy or publication context, and status. Selecting a row opens a stable detail URL. Removed rows remain findable with the Removed or All filter.

The detail view presents content before system metadata. `Remove from Peated` opens a confirmation form that requires a reason and explains that the content will disappear from Peated but remain available to administrators. Removed records offer `Restore to Peated` with the same reason requirement. Mutation errors remain on the page with the entered reason preserved.

The UI does not offer administrator editing. It may link to the member profile, Bottle, critic site settings, and original critic article where access is valid. Private member content is clearly labeled Private so administrators do not mistake its absence from public pages for a bug.

Desktop uses the existing administrator table and detail patterns. Mobile keeps filters reachable, presents rows without horizontal overflow, uses full-width confirmation actions, moves focus to mutation results, and announces success or failure.

## Risks / Trade-offs

- **[A missed direct query could leak removed content]** → Inventory every use of the three tables, centralize reusable visibility predicates where practical, test public details and combined lists, and add summary recomputation tests before enabling the UI action.
- **[Administrator access broadens visibility into private member content]** → Keep dedicated reads behind `requireAdmin`, return only necessary fields, label privacy, exclude body search, and prohibit response-content telemetry.
- **[External `hidden` and moderation removal can be confused]** → Return them as separate administrator fields, keep public visibility predicates explicit, and test scraper import and source publication against a removed review.
- **[A removed member review can block the member's one-review row]** → Reject ordinary updates with a clear conflict while retaining permanent owner deletion; do not let an upsert silently republish it.
- **[Saved summaries can lag after a transition]** → Change row visibility immediately, dispatch recomputation after commit, expose mutation success independently from job completion, and retain the existing Maintenance rebuild as repair.
- **[Soft removal does not physically erase an uploaded file]** → Stop returning or linking the image from ordinary reads. Keep physical deletion and retention in the upload-storage boundary rather than claiming removal purges a file.
- **[Audit reasons can accidentally contain private content]** → Keep reasons short, instruct administrators to describe the policy reason rather than quote content, and never attach source text automatically.

## Migration Plan

1. Generate nullable moderation columns, combination constraints, status/list indexes, actor references, and new change object kinds. Existing null rows remain active.
2. Add source-owned removal predicates and update public reads, interactions, and derived summary queries before exposing mutations.
3. Add administrator list/detail/history reads and source-specific moderation mutations with authorization, locking, auditing, and recomputation tests.
4. Add Content navigation, Reviews tabs, Tastings list, detail pages, filters, loading and empty states, and removal/restoration forms.
5. Update documentation and run focused server tests, web tests, typechecks, lint, formatting, and authenticated desktop/mobile browser QA.

Rollback removes the administrator UI and mutations first. Leaving nullable columns and inactive enum values in place is safe; destructive schema cleanup is a separate migration only after verifying no removed rows or audit history require preservation.

## Open Questions

None block implementation. Reports, member suspension, appeals, bulk actions, and physical media purge should be driven by demonstrated moderation needs rather than added to this first content inventory.
