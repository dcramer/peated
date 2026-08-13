## 1. Normalized Scraper Evidence

- [x] 1.1 Export the normalized Bottle identity contract for server ingestion.
- [x] 1.2 Persist optional `sourceBottleIdentity` on store prices and refresh it
      during upsert.
- [x] 1.3 Seed price classification from fresh persisted source Bottle facts.
- [x] 1.4 Generate the additive store-price migration.
- [x] 1.5 Use complete, conflict-free scraper facts as an auto-create evidence
      anchor while retaining review for partial, contradictory, or unresolved
      identities.

## 2. Douglas Laing Evidence

- [x] 2.1 Map provider-owned vendor, product type, ABV, explicit age/cask
      markers, and finish wording into normalized Bottle identity facts.
- [x] 2.2 Add a production-derived Gauldrons Eclipse regression fixture without
      invented bottler or release-year claims.

## 3. Cost-Bounded Web Verification

- [x] 3.1 Split search-query and page-read allowances within the per-run web
      evidence budget.
- [x] 3.2 Reduce the default and per-turn search maximum to two queries.
- [x] 3.3 Reserve one basic-proxy page read and allow `reference.url` as its
      target.
- [x] 3.4 Add generalized tests proving exhausted search cannot consume page
      verification.

## 4. Documentation And Validation

- [x] 4.1 Document normalized scraper evidence and independent cost allowances
      in the owning classifier architecture.
- [x] 4.2 Validate the OpenSpec change and format all touched files.
- [x] 4.3 Run targeted classifier and server tests, lint, and typechecks.
- [x] 4.4 Review the final diff against correctness, interface, runtime-boundary,
      error, agent-design, eval, comment, observability, and redaction policies.
