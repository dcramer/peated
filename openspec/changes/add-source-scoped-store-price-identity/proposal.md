## Why

Store-price matching currently treats an approved listing assignment and a reusable bottle alias as the same kind of truth. That breaks down for scraper listings with generic retailer titles, where a source page can identify one exact item while the displayed name is too broad to reuse for future listings.

This matters now because classifier automation is starting to approve more production misses. We need the classifier and downstream matcher to separate alias eligibility from exact listing assignment without creating unsafe canonical bottles, aliases, or deterministic shortcuts.

The central invariant is alias safety: a generic listing title MUST NOT become a reusable bottle alias, even when the exact listing can be verified and matched.

## What Changes

- Add explicit alias-safety metadata for store-price classification outcomes.
- Let the classifier say whether the observed listing title is safe as a reusable global alias, without categorizing every reason it is unsafe.
- Add persistence semantics for source-scoped listing assignments so an exact source item can be matched while forbidding global alias creation from generic listing names.
- Extend automation policy so source-scoped assignments can be trusted only when the exact source evidence is concrete, while generic creates remain review-only or no-match.
- Add production-miss and curated eval coverage for generic-title cases, including negative coverage that prevents broad parent creation from family evidence alone.
- Preserve deterministic policy: code may validate concrete enum values and impossible states, but alias eligibility remains a classifier/review-policy decision.

## Capabilities

### New Capabilities

- `source-scoped-store-price-identity`: Classifier and price-matching behavior for source-specific listing identity, generic listing titles, source-scoped assignments, and alias safety.

### Modified Capabilities

- None. No current OpenSpec capability exists for classifier or store-price matching; this change introduces the capability and references the existing architecture docs as policy.

## Impact

- `packages/bottle-classifier`: decision schema, prompts/instructions, review policy, eval fixture schema, production-miss fixtures, and replay recordings.
- `apps/server/src/lib/priceMatching*`: proposal mapping, automation assessment, approval application, alias assignment behavior, and observation metadata.
- `apps/server/src/db/schema`: likely migration for source-scoped listing identity or equivalent durable verification metadata if existing `bottle_observation` cannot safely carry it, including internal store listing ids when scrapers can provide them.
- `docs/features/store-price-matching.md` and `docs/architecture/bottle-classifier.md`: document the distinction between reusable global aliases and source-specific listing identity.
- Scraper ingestion paths that create `store_price` rows: future matching should be able to use stable source identifiers, URL/product ids, and source fingerprints without globalizing generic titles.
