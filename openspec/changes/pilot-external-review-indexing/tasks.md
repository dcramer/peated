## 1. Source Policy Boundary

- [x] 1.1 Add the external-review source policy schema with disabled defaults,
      capability flags, publication mode, policy evidence, review date, approval
      reference, and approving actor
- [x] 1.2 Generate and inspect the database migration for source policy and add
      fixtures for disabled and approved policies
- [x] 1.3 Add moderator-only policy reads and updates with audit logging and
      tests for enablement, revocation, and unauthorized access
- [x] 1.4 Enforce fetch policy at scheduled jobs, manual jobs, and the review
      worker immediately before network access
- [ ] 1.5 Enforce LLM-processing and review-visibility capabilities when those
      consumers are introduced

## 2. Article And Review Model

- [x] 2.1 Add the review-article schema and nullable review fields for
      stable source key, reviewer, native score, and summary provenance
- [x] 2.2 Generate and inspect the additive database migration and relations
- [x] 2.3 Implement idempotent review-article and multi-review upserts with
      transaction-level tests
- [x] 2.4 Allow unscored reviews and preserve native score value, scale,
      display text, and normalized compatibility rating
- [x] 2.5 Prove that article bodies, HTML, tasting notes, conclusions, and images
      are absent from persistence and error logs

## 3. Existing Review Migration

- [x] 3.1 Automatically backfill one review article for every existing review
      in the schema migration while preserving source, URL, issue, rating,
      Bottle assignment, and visibility without fetching publisher pages
- [x] 3.2a Switch review ingestion and fixtures to the article/review model
- [x] 3.2b Switch review queries, serializers, and moderation to article-owned
      metadata
- [x] 3.3 Migrate the Whisky Advocate job to the shared article ingestion
      boundary without expanding its current collection or summary behavior
- [x] 3.4 Add migration verification for total, visible, unresolved, Bottle-linked,
      and canonical-URL counts
- [x] 3.5 Enforce article relationships and remove duplicated legacy review URL,
      issue, and source fields after the hard cutover

## 4. Extraction And Summary Boundary

- [ ] 4.1 Define the narrow source-adapter output contract for article metadata
      and stable reviews
- [ ] 4.2 Reuse external-review Bottle resolution for every review and keep
      unresolved or invalid Bottle assignments hidden
- [ ] 4.3 Add transient summary generation with a constrained two- or
      three-sentence prompt, content hash, model, prompt version, and generation
      time
- [ ] 4.4 Make summary failure non-destructive and invalidate summaries when the
      source content hash changes
- [ ] 4.5 Add deterministic tests for multi-bottle splitting, idempotency, native
      scoring, summary policy enforcement, and redacted failures

## 5. Public Review Index

- [x] 5.1 Extend review API output with article metadata, reviewer, native score,
      and permitted summary while preserving existing clients during cutover
- [x] 5.2 Update Bottle review presentation with publisher, reviewer, date,
      native score, attributed Peated summary, and a prominent canonical link
- [x] 5.3 Omit missing or unapproved fields without fallbacks and keep normalized
      compatibility ratings out of native-score presentation
- [x] 5.4 Add deterministic component and route tests for complete, partial,
      unscored, summary-free, revoked, and multi-source reviews

## 6. Approved Publisher Pilots

- [ ] 6.1 Record written permission and exact capabilities for the first pilot
      publisher before implementing or enabling its adapter
- [ ] 6.2 Implement and fixture-test the first approved source adapter with
      bounded discovery and stable source keys
- [ ] 6.3 Run the first approved backfill in review-only mode and capture article,
      review, extraction, matched, and unresolved counts
- [ ] 6.4 Review the agreed sample for at least 90% extraction accuracy,
      multi-bottle splitting, summary quality, and Bottle-match precision
- [ ] 6.5 Explicitly enable or reject automatic publication based on the recorded
      pilot results
- [ ] 6.6 Repeat permission capture and the bounded review-only pilot for the
      second publisher before generalizing shared adapter behavior

## 7. Verification And Documentation

- [ ] 7.1 Document the runtime permission boundary, source adapter contract,
      transient-content rule, rollback path, and pilot operating procedure
- [ ] 7.2 Run targeted server tests, web tests, server and web typechecks, lint,
      and formatting for the touched surface
- [ ] 7.3 Manually QA moderator policy changes, hidden pilot reviews, and
      Bottle-page referral links without fetching an unapproved source
- [ ] 7.4 Validate the OpenSpec change and record remaining publisher-dependent
      tasks without weakening the disabled-by-default boundary
