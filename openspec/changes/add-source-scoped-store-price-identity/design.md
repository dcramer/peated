## Context

Price matching has two different truths that are currently represented too similarly:

1. This exact store listing or scraped source item belongs to bottle/release X.
2. This listing name is a reusable canonical Peated identity or global bottle alias.

Those are not equivalent. A retailer can publish a generic display title such as `George Dickel Single Barrel` while the underlying page, internal store listing id, product id, article, image, or SKU identifies one age-specific bottling. The exact listing can be matchable, but the display title must not teach future scrapes that every `George Dickel Single Barrel` listing maps to the same bottle.

Current flow:

- `classifyBottleReference` returns bottle-centric actions and `identityScope = product | exact_cask`.
- Price matching maps those actions to `match_existing`, `correction`, `create_new`, or `no_match`.
- Approval calls `applyApprovedStorePriceMatchProposalInTransaction`, assigns the `store_price`, upserts one `bottle_observation`, and calls `assignBottleAliasInTransaction` with the normalized store title.
- `finalizeBottleAliasAssignment` then pushes alias-change work that can affect future store prices and reviews with the same normalized title.

The classifier already has policy language for weak generic parent avoidance, but it lacks a first-class way to say: "the source item is exact; the name is not globally reusable." That leaves the system with only unsafe choices: broad create, no-match, or a match that can globalize a generic alias.

The primary bug is the alias side effect. Matching one listing can be correct; creating a reusable alias from its generic title can be wrong for every future listing that happens to use the same title. `George Dickel Single Barrel` from two stores, or from the same store at two different times, can refer to different age-specific bottles even when the public title text is unchanged.

Scraper audit findings:

- `StorePriceInputSchema` currently accepts only `name`, `price`, `currency`, `volume`, `url`, and `imageUrl`; scraper source ids have nowhere to go.
- `scrapePrices` dedupes one run by normalized `name + volume`, which can drop same-title/different-product rows before submission.
- `store_price` has a unique URL, but ingestion upserts on `(externalSiteId, lower(name), volume)`, which can collapse same-store/same-title/different-bottle listings.
- Total Wine list pages contain URL ids such as `/p/135113175` and embedded `skuId` values; the current scraper emits only URL.
- Astor item URLs carry item ids such as `/item/16747`; the current scraper emits only URL.
- ReserveBar URLs carry grouping ids such as `GROUPING-38632`; the current scraper emits only URL.
- Wooden Cork list pages include Shopify `data-product-id`, product variant ids, and SKU values; the current scraper emits only URL.
- Healthy Spirits list pages include Lightspeed `data-pid`, add-to-cart variant ids, and JSON URLs; the current scraper emits only URL.
- SMWS has structured cask ids, but that path is already a deterministic bottle-creation flow and is less representative of generic store price matching.

The George Dickel case is the negative example. Public evidence shows George Dickel has age-specific single-barrel products, including 9-year and 15-year examples, while the submitted listing title omitted the decisive age. Without exact source-page proof for the submitted SKU, auto-creating a broad `George Dickel Single Barrel` parent would be unsafe.

## Goals / Non-Goals

**Goals:**

- Make alias safety the hard boundary: generic listing titles must never become reusable aliases.
- Represent source-specific listing identity separately from reusable canonical product identity.
- Allow exact source evidence to auto-assign a store price to an existing bottle/release without creating a global alias from a generic title.
- Keep broad create decisions blocked when evidence supports only a family or sibling set, not a reusable Peated bottle identity.
- Support future scraper listings by keying source-scoped verification to stable source identifiers, such as internal store listing ids, product ids, canonical URLs, SKUs, or source fingerprints rather than display names alone.
- Add evals that cover both positive source-specific assignment and negative generic-title broad-create prevention.
- Keep deterministic code limited to concrete validation, persistence scopes, and impossible-state blockers.

**Non-Goals:**

- Do not auto-create generic parent bottles just because web evidence proves a brand/product family exists.
- Do not introduce domain allowlists for source truth.
- Do not make retailer-origin evidence decisive for canonical create traits by itself.
- Do not solve every dirty legacy bottle repair in this change.
- Do not make all source-scoped approvals permanent global matching rules.

## Decisions

### Decision: Add alias-safety metadata instead of overloading `identityScope`

Keep `identityScope = product | exact_cask` for bottle-vs-exact-cask modeling, and add a separate field for whether the observed listing title can safely become a reusable global alias:

- `aliasScope = global_alias | none`

Rationale: `identityScope` answers "what kind of Peated identity is this?" It does not answer "can the observed source title become a reusable alias?" A source listing can exactly match a normal product bottle while still having a generic title. The classifier does not need to categorize every reason a title is not alias-safe; `none` is enough for the alias write boundary.

Alternative considered: Add `source_listing` as a third `identityScope`. Rejected because it mixes canonical bottle modeling with evidence scope and would blur exact-cask behavior.

### Decision: Source-scoped approval must not create or update global bottle aliases

When a proposal is approved with `aliasScope = none`, price matching SHALL assign the specific `store_price` and write observation/verification metadata, but MUST skip global `assignBottleAliasInTransaction` for the generic listing title.

Rationale: This is the core safety boundary. The listing can be correct without the title being reusable.

Alternative considered: Create bottle aliases with an `externalSiteId` and rely on current alias logic. Rejected unless the alias lookup path is also source-scoped, because current alias-change jobs can update rows by normalized name and would still risk future generic matches.

Implementation note: if a title is marked generic or source-scoped, no code path should call the existing global alias assignment helper for that title. A future source-scoped lookup mechanism must be separate from `bottle_alias` unless `bottle_alias` itself gains enforceable source scoping across lookup, assignment, and alias-change jobs.

### Decision: Persist source-scoped verification as durable source identity

Use existing `bottle_observation` only if it can support lookup semantics safely. Otherwise add a purpose-built table, likely keyed by:

- `externalSiteId`
- internal store listing id when a scraper can provide one
- source product identifier when available
- canonicalized source URL or URL fingerprint
- optional listing name fingerprint
- matched `bottleId` / `releaseId`
- `aliasScope`, evidence summary/hash, model, confidence, reviewed/verified actor

Rationale: future scraper listings need to verify brand-new rows from stable source identity, not from generic display text. An internal store listing id is often the strongest source-scoped key because it can distinguish two same-title products from the same site. Observations preserve evidence, but they do not currently define reusable source-scoped matching behavior.

Alternative considered: Store all metadata only in `store_price_match_proposal`. Rejected because proposals are per-price and retryable; scraper matching needs durable source identity across future listing rows.

### Decision: Ingestion identity should prefer source keys over title keys

Extend scraper output and `StorePriceInputSchema` with source identity fields such as:

- `sourceProductId`
- `sourceVariantId`
- `sourceSku`
- `sourceFingerprint`

When at least one stable source key is present, ingestion SHALL use that source key plus `externalSiteId` as the primary identity for upsert/dedupe. The existing `(externalSiteId, lower(name), volume)` behavior can remain only as a fallback for sources without stable ids.

Rationale: a classifier flag can prevent alias creation after review, but it cannot recover listings that were already collapsed by name-volume dedupe during scraping or ingestion.

Alternative considered: Keep the DB row keyed by URL only. Rejected as the only solution because URLs can contain tracking params, can be recycled, and some sites expose stronger product/variant ids than URL text.

Implementation note: source keys must be stored and compared as `(externalSiteId, keyType, keyValue)` or a stronger equivalent composite. A SKU, UPC, product id, or variant id must never be treated as a cross-store bottle identity by itself.

### Decision: Classifier decides alias eligibility; code enforces declared scope

The classifier/review policy owns whether the observed listing title is eligible for reusable global alias storage. Deterministic code may:

- validate enum values and required ids
- block impossible candidate ids
- cap or block automation when scope and action conflict
- skip alias writes when `aliasScope = none`
- require concrete source identifiers for source-scoped reuse

Deterministic code MUST NOT infer source specificity from brand strings, title shape, domain, search rank, "single barrel" wording, vector similarity, or family-page snippets.

Rationale: The user's policy is to trust the agent as much as safely possible, while reserving determinism for 100% concrete rules.

### Decision: Automation gates split create safety from assignment safety

Existing-match or correction assignment can become automation-eligible when:

- the target bottle/release is a known candidate
- classifier confidence clears the existing-match threshold
- deterministic blockers are empty
- exact source evidence exists and `aliasScope = none`

Create-new automation remains stricter:

- `aliasScope` must be `global_alias` or a valid exact-cask bottle identity must be supported by concrete source evidence
- required canonical traits must be externally validated or otherwise concretely supported
- generic or underspecified listing identity blocks auto-create

Rationale: assigning one listing is lower blast radius than creating a reusable bottle or alias.

### Decision: Evals encode behavior, not the same bottle-specific tweak

Add evals that use real production-miss provenance when based on production cases, but cover behavior with different examples where possible:

- Generic-label classifier eval: expected output must explicitly mark the listing label as not eligible for global alias storage. The eval should fail if the classifier only returns a match/create decision without the alias-safety metadata.
- Negative production-miss eval: the George Dickel-style case remains `no_match` or pending create review because broad parent creation is unsafe from generic title plus sibling/family evidence.
- Positive source-specific eval: a different real listing with a generic display title but source-page/article/SKU evidence that pins an existing bottle. Expected result is existing match with `aliasScope = none` and no-global-alias handling.
- Alias-safety integration test: approving a source-scoped match assigns only the one store price, does not create or rebind a `bottle_alias` row for the generic label, and does not update future same-name listings from the same or different stores.
- Scraper reuse test: a later row with the same stable internal listing id or source product id can reuse the source-scoped verification; a later row with only the same generic display title but different source id/URL/SKU cannot.

Rationale: This avoids overfitting to the exact miss while still preserving the observed production artifact, DB outcome, and verified sources required by repo policy.

## Risks / Trade-offs

- Source metadata is incomplete for some scrapers -> Prefer scraper-provided internal listing ids when available; otherwise require fallback to review/no-match when no stable source id, canonical URL, or durable fingerprint exists.
- Source pages can change under the same URL -> Store evidence hashes/timestamps and allow revalidation or expiration before reuse.
- New metadata fields may be ignored by older proposal rows -> For new classifier decisions, missing alias-safety metadata must default to no global alias and review-required automation. Legacy/manual approval paths may keep existing behavior only when they are outside the new alias-safety classifier flow.
- Source-scoped matching could hide bad assignments if overused -> Require high confidence, known candidates, observation evidence, and explicit scope in decision artifacts.
- More schema surface increases eval churn -> Add schema tests and focused fixtures before changing prompts broadly.

## Migration Plan

1. Extend classifier and server schemas with alias-safety metadata, defaulting legacy decisions to conservative behavior.
2. Extend scraper output, input schemas, and ingestion persistence to carry stable source ids where available.
3. Add source-scoped persistence, either through safe `bottle_observation` extensions or a new source identity table.
4. Update approval flow to skip global alias assignment when `aliasScope = none`.
5. Update ingestion/matching to consult source-scoped verification only by stable source identity, never by display title alone.
6. Add eval schema expectations and fixtures before enabling automation gates.
7. Enable automation only after targeted tests and evals pass.

Rollback strategy: keep the new metadata ignored by automation behind conservative defaults. If source-scoped matching causes issues, disable lookup/automation while preserving observations for review.

## Open Questions

- Which scraper fields are reliably available across sites: internal store listing id, product id, canonical URL, SKU, page hash, image URL, or another stable source key?
- Should source-scoped verification live in `bottle_observation` facts or a new table with first-class lookup indexes?
- Should source-scoped assignment be visible in the admin queue as a distinct proposal subtype or only as proposal metadata?
- How long should source-scoped verification remain reusable before requiring revalidation?
- Do we need source-scoped aliases for user reviews as well, or only store-price scraper rows?
