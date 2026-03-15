# Store Price Matching

This document reflects the store-price-to-bottle matching system as implemented on March 14, 2026.

## Goal

Given a `store_price` row from an external retailer, Peated tries to do one of four things:

1. Confirm the current bottle assignment is already correct.
2. Suggest a different existing bottle.
3. Suggest creating a new bottle.
4. Conclude there is no safe match.

The output of evaluation is a single `store_price_match_proposal` row per `store_price`.

## Matching modes

The system has two matching modes:

1. Deterministic trusted-source matching.
2. Heuristic matching through extraction, candidate search, and classifier decisioning.

The expected rule is:

- If the source gives us enough native identity to determine the bottle safely, we should not use the general matcher.
- If the source does not give us enough native identity, we fall back to the general matcher.

In other words, the heuristic matcher is the fallback path, not the default for trusted structured sources.

## Scope

This system covers:

- Initial matching during price ingestion.
- Re-evaluation via the admin match queue.
- Auto-resolution for trusted SMWS listings.
- Moderator approval, ignore, and create-bottle flows.

This system does not maintain a durable per-attempt history. Retrying a proposal overwrites the existing proposal row for that `store_price`.

## Lifecycle

### 1. Price ingestion

When prices are created in `POST /external-sites/{site}/prices`:

- The incoming name is normalized.
- `findBottleId(name)` does an exact alias lookup only.
- If that exact alias lookup succeeds, the `store_price` is created with an initial `bottle_id`.
- A `ResolveStorePriceBottle` worker job is always enqueued afterward.
- If an image URL is present and the price does not already have an image, `CapturePriceImage` is also enqueued. When the image is later stored, it enqueues `ResolveStorePriceBottle` again.

### 2. Matching evaluation

`resolveStorePriceMatchProposal(priceId)` evaluates one `store_price`.

It skips work when:

- The price does not exist.
- There is already a closed proposal with status `approved` or `ignored`, unless `force: true` is passed.

Evaluation order is:

1. Trusted SMWS fast path.
2. Extract structured bottle details from image or text.
3. Auto-ignore obvious non-whisky listings if extraction failed.
4. Generate local bottle candidates.
5. Ask the classifier to choose `match_existing`, `correction`, `create_new`, or `no_match`.
6. Sanitize the classifier output against known candidates and resolved entities.
7. Upsert the proposal row.
8. Auto-create a new bottle only for very high-confidence `create_new` decisions.

### 3. Moderator queue

The moderator queue only shows proposals with status:

- `pending_review`
- `errored`

Queue state is split into:

- `actionable`: no active retry lease
- `processing`: active retry lease

Retries operate on the full filtered actionable result set, not just the current page.

### 4. Resolution

A moderator can:

- Approve a proposal against an existing bottle.
- Ignore a proposal.
- Create a new bottle from a `create_new` proposal.

These actions close the proposal and remove it from the queue.

## Candidate generation

Candidate search combines several local strategies and merges the results by `bottleId`.

Sources today:

- `current`: the currently assigned bottle, if one exists
- `exact`: exact match against `bottle_aliases.name`
- `vector`: embedding similarity over bottle aliases
- `text`: full-text search over bottle search vectors
- `brand`: exact brand lookup plus `ILIKE` on bottle full name

After merging:

- Candidate metadata is filled opportunistically from the best available source.
- Candidates are re-ranked with small structured adjustments from extracted label data.
- If a brand was extracted and at least one candidate matches that brand, candidates from other brands are dropped unless they came from `exact` or `current`.

## Extraction

Structured extraction comes from:

- OCR / image extraction when the price has an image
- Text extraction from the retailer title otherwise

Extracted fields include:

- `brand`
- `expression`
- `series`
- `distillery`
- `category`
- `stated_age`
- `abv`
- `cask_type`
- `cask_strength`
- `single_cask`
- `edition`
- `vintage_year`
- `release_year`

The extraction schema is intentionally whisky-specific. `category: "spirit"` is normalized to `null`.

## Classifier contract

The classifier receives:

- Store price metadata
- The current bottle, if assigned
- Extracted label details
- Initial local candidates

It can use:

- local bottle search
- local entity search
- OpenAI web search

It must return exactly one decision:

- `match_existing`
- `correction`
- `create_new`
- `no_match`

The returned `suggestedBottleId` must be one of the known candidate bottle IDs. If it is not, the evaluation is converted into an `errored` proposal.

`create_new` is additionally sanitized:

- Proposed entities are kept only if they match resolved entities of the expected type.
- `proposedBottle.name` has duplicate brand prefixes stripped.
- `category: "spirit"` is normalized to `null`.
- `series.id` is always cleared before persistence.
- Confidence is capped below the auto-create threshold unless the result has both corroborating web evidence and a concrete whisky category.

## Proposal types and statuses

### Proposal types

- `match_existing`: attach to an existing bottle, usually where there was no bottle before
- `correction`: replace an existing bottle assignment with a different bottle
- `create_new`: create a new bottle
- `no_match`: no safe match was found

### Statuses

- `verified`: current bottle already matches and confidence is high enough
- `pending_review`: needs moderator action
- `approved`: moderator or automation approved the result
- `ignored`: intentionally dismissed
- `errored`: evaluation failed or produced invalid output

`verified` is only produced when:

- the price already has a `bottle_id`
- the decision is `match_existing`
- the suggested bottle equals the current bottle
- confidence is at least `80`

Everything else with a valid decision becomes `pending_review` unless overridden.

## Automation rules

### Trusted SMWS fast path

For external sites with type `smws`:

- The source is treated as trusted structured input, not a fuzzy matching problem.
- The retailer title is parsed with the SMWS code parser.
- The SMWS bottle code is the authoritative source identity.
- A deterministic match only proceeds if the parser can determine both the distillery and a supported category.
- The brand is forced to `The Scotch Malt Whisky Society`.
- The bottle identity is derived from SMWS metadata, not the classifier.

If a matching SMWS bottle already exists:

- The proposal is written with confidence `100`.
- The decision is `match_existing` or `correction`.
- The proposal is auto-approved.

If no SMWS bottle exists yet:

- The proposal is written with confidence `100`.
- The decision is `create_new`.
- The bottle is auto-created and the proposal is auto-approved.

If trusted SMWS auto-resolution fails, the proposal is persisted as `errored`.

Important implementation note:

- Today the code follows the deterministic SMWS path and bypasses the classifier, but it does not yet persist a first-class SMWS code on bottles.
- The current implementation parses the SMWS code from the listing title, derives normalized bottle identity from that metadata, and then matches an existing SMWS bottle by normalized bottle name under the SMWS brand.
- The current invariant is that the parsed SMWS cask code must be preserved in the canonical `bottle.name`.
- Example: `SMWS RW6.5 Sauna Smoke` must normalize to canonical `bottle.name = "RW6.5 Sauna Smoke"`.
- If that invariant is broken, deterministic SMWS matching will not find the existing bottle and will create a new one with the correctly normalized name instead.
- The intended future contract is stricter: SMWS should match by the authoritative SMWS code itself once we store that identifier explicitly.

### Non-whisky auto-ignore

If structured extraction fails completely and the normalized retailer title contains non-whisky spirit keywords without whisky keywords, the proposal is auto-marked `ignored`.

### High-confidence auto-create

A `create_new` proposal is auto-created only when:

- action is `create_new`
- `proposedBottle` is present
- confidence is at least `90`
- at least one web search query returned results

Otherwise the proposal stays in `pending_review`.

## Moderator approval behavior

Approving a proposal does two things:

1. Assigns a bottle alias for the exact `store_price.name`.
2. Marks other queue proposals with the same case-insensitive `store_price.name` as approved too.

Important current behavior:

- This approval fanout is name-based, not site-based.
- It is also not volume-aware.
- As of this document, active `processing` proposals are excluded from that fanout.

Ignoring a proposal only affects the selected proposal.

## Retry and processing leases

Retries do not reuse the original BullMQ job identity. A retry claims a DB lease and enqueues a tokenized job.

Lease behavior today:

- Lease is stored on the proposal row.
- Default lease length is `30 minutes`.
- The worker refreshes the lease once when the retry job starts.
- On normal completion, the worker clears the lease if the token still matches.
- If enqueue fails, the lease is cleared immediately.
- If the worker never runs or crashes without cleanup, the proposal becomes actionable again once the lease expires.

Processing proposals are not reviewable through the moderator resolution routes.

## Operator expectations

- The admin queue is an operator inbox, not a full audit log.
- One `store_price` has at most one current proposal row.
- Retrying recomputes and overwrites the proposal instead of appending a new attempt.
- `errored` means the evaluation failed, not necessarily that no bottle exists.
- `no_match` means the classifier could not safely select or create a bottle.
- `verified` is not shown in the moderator queue.
- `approved` and `ignored` are terminal for queue purposes.

## Known limitations

- Retry leases are refreshed only once at worker start. A genuinely long-running job can outlive its lease and become actionable again before it finishes.
- Proposal history is lossy because retries overwrite the existing proposal row.
- Approval fanout is currently driven only by exact case-insensitive store price name, which may be broader than intended across sites or package sizes.
- Trusted SMWS matching is deterministic today, but the system still derives identity from parsed metadata in the title because bottles do not yet have a dedicated SMWS code field.
- Candidate generation is still a blend of exact alias lookups, heuristic search, and LLM reasoning rather than a fully explicit deterministic rules engine.
