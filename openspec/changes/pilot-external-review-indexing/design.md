## Context

Peated currently stores each external review as one `review` row containing a
globally unique URL, one Bottle match, a required 0-100 rating, and a required
issue. The only dedicated review scraper is Whisky Advocate. That model cannot
represent the common case where one publisher article reviews several bottles,
and it lacks the article, author, native-score, summary, and source-policy data
needed for a referral-oriented review index.

The pilot must preserve the existing public reviews while introducing a safer
boundary for review publishers. Publisher article text is needed transiently
for extraction and summarization, but Peated does not need to retain or display
the full text. Source capabilities vary independently across crawling, LLM use,
score display, summary display, and automatic publication.

## Goals / Non-Goals

**Goals:**

- Represent one review article with several Bottle reviews.
- Preserve native score semantics and current normalized rating consumers.
- Make source policy an explicit runtime prerequisite.
- Generate short, grounded, attributed summaries without retaining article
  bodies.
- Reuse Peated's existing Bottle resolution and unresolved-review moderation.
- Prove an archive source and the existing Whisky Advocate source through a
  small, measurable rollout.

**Non-Goals:**

- A generalized crawler that accepts arbitrary publisher URLs.
- Critic consensus, critic calibration, rankings, or release-news ingestion.
- Full review text, publisher excerpts, or publisher image storage.
- Publisher accounts, dashboards, billing, or referral analytics.
- Ingesting community ratings from Whiskybase, Distiller, or similar databases.

## Decisions

### Separate review articles from Bottle reviews

Add a `review_article` owned by one `external_site` and identified by its
canonical URL. It stores title, publication date, source content hash, and fetch
timestamps. An article owns zero or more existing `review` rows. Each review
stores its source key, source bottle name, reviewer name, native score,
normalized rating, optional summary, summary model, prompt version, and
generation time.

The article URL is unique within its source, not globally. Each review is unique
by article and stable source key. The source key is publisher-provided
when available and otherwise deterministically derived by a source adapter from
stable page identity; array position alone is not sufficient.

The schema migration automatically backfills legacy reviews without fetching
publisher pages. Article title, content hash, and fetch time therefore remain
null until a later enabled fetch supplies them; the migration does not invent
source metadata. Existing review URL and issue fields remain unchanged during
the additive cutover.

Keeping `review` for each Bottle assessment preserves the public domain noun and
existing Bottle relationship. Source ownership, URL, title, issue, and fetch
state move to `review_article` so those facts cannot diverge among reviews.

Alternative considered: continue duplicating the article URL on each review.
This was rejected because it preserves conflicting article metadata and cannot
express article-level refresh or removal correctly.

### Store explicit source capabilities

Add a review-source policy owned by `external_site`. It has a disabled,
review-only, or automatic publication mode plus independent booleans for
fetching public pages, processing article text with an LLM, displaying scores,
and displaying generated summaries.

All new policies default to disabled and no capability. The scheduler and
manual job boundary both check the same policy before network access. The
ingestion boundary rechecks display capabilities before making a review
visible, so a caller cannot bypass policy by directly submitting parsed data.
Changing a policy is a moderator-only operation and is audit logged.

The moderator API permits automatic mode after the source passes its quality
gate. The transition publishes staged reviews only when they have an active
resolved Bottle. Unresolved reviews remain hidden. A general policy-revision
system is deferred until multiple revisions create a proven need.

The policy records which capabilities Peated has enabled. The fetcher checks
robots.txt on each run. Robots rules can further restrict crawling but cannot
enable a stored capability.

Alternative considered: keep source controls only in documentation or scraper
constants. This was rejected because operational jobs need a single explicit
runtime boundary and capabilities must be revocable without deploying code.

### Use source-specific adapters behind a narrow ingestion contract

Each pilot adapter discovers allowed article URLs and extracts a typed article
with reviews. It does not persist data or decide Bottle identity. The shared
ingestion boundary validates the source policy, upserts the article, resolves
each review using the existing external-review Bottle resolver, and persists
the result.

WhiskyNotes is the archive adapter. Whisky Advocate is the second bounded
pilot because it already has production history and tests the legacy source
through the governed runtime. Dramface remains a later multi-bottle candidate.
Each source remains disabled until its current robots rules and public terms
are checked.

Alternative considered: build a configurable LLM-only arbitrary-page crawler.
This was rejected because discovery, rate limits, identity keys, score scales,
and site rules are source-specific and deserve code review during the pilot.

### Treat article text as transient processing data

Fetched HTML and extracted article text remain in job memory only. Peated stores
the canonical metadata, content hash, structured review facts, Bottle match,
and generated summary, but not the source body or source photography. Logs and
errors must not include article bodies.

Summary generation is optional. A failed or disallowed summary does not discard
an otherwise valid metadata/score review. Each generated summary records
its model and prompt version, and a content-hash change makes the old summary
stale until regeneration succeeds.

Alternative considered: retain raw HTML for debugging and future regeneration.
This was rejected because it creates unnecessary rights, retention, security,
and deletion obligations.

### Preserve native scores and normalize only for compatibility

An article review may be unscored. A scored review stores the native value,
native maximum, and display text. A source adapter may use the shared
deterministic normalizer to produce the existing integer 0-100 rating. Public
source rows show the native display score; normalized ratings remain an
internal compatibility and future aggregation input.

The pilot does not compare or average sources. This avoids presenting a simple
linear conversion as critic calibration.

### Roll out hidden before automatic publication

The first backfill for each source uses review-only mode. Extracted
reviews remain hidden and appear in moderation until a reviewed sample
demonstrates at least 90% article/review extraction accuracy, correct
multi-bottle splitting, and acceptable Bottle-match precision. Automatic mode
can then publish reviews with resolved active Bottles; unresolved or
invalid Bottle assignments always remain hidden.

Disabling a source stops fetching immediately and hides source reviews when the
current policy no longer permits display.

Policy updates and article ingestion serialize on the source record. This keeps
the publication mode used by an ingestion transaction consistent with a
concurrent moderator update. A refresh can publish a previously unresolved
review after it gains its first active Bottle assignment. It does not make an
already matched review visible after a moderator hides it.

Native article scrapers use the article ingestion boundary. The legacy
single-review source and the moderator API retain their existing entry point
because they have different source metadata and failure behavior. Both entry
points use the same persistence helpers for source locking, article identity,
Bottle validation, and review conflict behavior.

## Risks / Trade-offs

- **Robots rules or public terms prohibit the planned requests** → Keep the
  source disabled and select another pilot.
- **LLM summary is inaccurate or too close to source prose** → Use a constrained
  prompt, provenance, deterministic length checks, reviewed pilot samples, and
  keep summaries optional and hidden until enabled.
- **A source page changes structure** → Use content hashes, stable source keys,
  fixture-backed adapter tests, extraction metrics, and fail the run without
  deleting prior reviews.
- **Bottle matching creates false associations at archive scale** → Reuse the
  existing resolver, publish only active resolved Bottles, and sample both
  matched and unresolved outcomes before automatic mode.
- **Native score conversion implies false comparability** → Display native
  scores and defer cross-source consensus/calibration.
- **Source rules change** → Enforce robots rules on every run and recheck public
  terms before expanding source use.
- **Migration affects current Whisky Advocate reviews** → Backfill articles
  before switching reads, preserve public API fields through serialization,
  and verify counts and Bottle associations before removing legacy columns.

## Migration Plan

1. Generate additive schema changes for review-source policy, review articles,
   and nullable review fields.
2. Create a disabled policy record for every existing external review source.
3. Backfill one review article per existing review URL and link each review;
   preserve its source, issue, URL, normalized rating, visibility, and Bottle.
4. Switch ingestion, queries, serializers, moderation, and the Whisky Advocate
   job to the article/review boundary.
5. Verify review counts, visible Bottle review counts, unresolved counts, and
   canonical URLs before enforcing article relationships and removing the
   duplicated legacy URL, issue, and source columns.
6. Deploy pilot adapters disabled. Enable review-only mode only after checking
   current robots rules and public terms.
7. Run a bounded backfill, review the sample, then explicitly choose whether to
   enable automatic publication.

Before legacy-column removal, rollback uses the prior application and untouched
legacy fields. After hard cutover, rollback requires the forward migration and
restored application version rather than reconstructing data from summaries.

## Open Questions

- Which source provides the best first bounded sample?
- Do current Whisky Advocate robots rules and public terms permit its existing
  ingestion and proposed LLM use?
- What reviewed sample size is sufficient alongside the 90% extraction gate?
