# Store Price Matching

This document reflects the store-price matcher as implemented on March 15, 2026.

## Core Schema Rules

These rules are the anchor for matching, automation, aliases, and moderator flows.

1. `bottle` is the stable parent product.
2. `bottle_release` is optional and only exists under a bottle.
3. `store_price` should follow the same shape as tastings and collections:
   `bottleId` required when matched, `releaseId` optional.
4. Bottle identity and release identity are not interchangeable.

Bottle identity lives on the parent bottle:

- brand
- bottler
- distillery
- expression / `name`
- series
- category

Release identity lives on the child release:

- edition
- stated age when release-specific
- ABV
- release year
- vintage year
- single-cask
- cask-strength
- cask fill
- cask type
- cask size

Operational rule:

- If bottle identity is clear but release identity is not, match the bottle and leave `releaseId = null`.
- Do not force a release from weak evidence.

Alias rule:

- Retailer listing aliases are bottle-level evidence unless they exactly match a canonical release alias.
- Canonical release aliases should come from actual release records, not from arbitrary retailer titles.

## Goal

For each `store_price`, the matcher should decide one of four outcomes:

1. The current assignment is already correct.
2. The price should match an existing bottle or existing release.
3. The price should create a new bottle, a new release under an existing bottle, or both.
4. There is no safe match.

The system persists one `store_price_match_proposal` row per `store_price`.

## Matching Modes

There are two matching modes:

1. Deterministic trusted-source matching.
2. General matching through extraction, local retrieval, classifier decisioning, and automation checks.

Trusted structured sources should bypass the general matcher when they already provide enough identity.

## Scope

This system covers:

- initial matching during price ingestion
- re-evaluation through the admin match queue
- trusted SMWS auto-resolution
- moderator approve / ignore / create flows

This system does not keep a durable per-attempt history. Retrying a proposal overwrites the existing proposal row for that `store_price`.

## Lifecycle

### 1. Price ingestion

`POST /external-sites/{site}/prices`:

- normalizes the incoming listing name
- does an exact alias lookup with `findBottleTarget(name)`
- if an exact alias exists, pre-fills `bottleId` and, when the alias is canonical to a release, `releaseId`
- always enqueues `ResolveStorePriceBottle`
- optionally enqueues `CapturePriceImage`

### 2. Matching evaluation

`resolveStorePriceMatchProposal(priceId)` evaluates one `store_price`.

Evaluation order:

1. trusted SMWS fast path
2. extract structured identity from image or text
3. auto-ignore obvious non-whisky rows if extraction failed
4. build local bottle and release candidates
5. ask the classifier for `match_existing`, `correction`, `create_new`, or `no_match`
6. sanitize classifier output against real candidates and resolved entities
7. compute automation eligibility from deterministic checks
8. upsert the proposal row
9. auto-create only when the deterministic gate says it is safe

## Candidate Generation

Candidate search is release-aware. Results are keyed by `(bottleId, releaseId)` rather than collapsing everything to `bottleId`.

Sources:

- `current`
- `exact`
- `vector`
- `text`
- `release_text`
- `brand`

Important behavior:

- exact alias matches may target a bottle or a release
- release search vectors can surface sibling releases independently
- release metadata is used in scoring and automation, not just the candidate name

## Extraction

The extractor returns a whisky-specific identity object:

- `brand`
- `bottler`
- `expression`
- `series`
- `distillery`
- `category`
- `stated_age`
- `abv`
- `release_year`
- `vintage_year`
- `cask_type`
- `cask_size`
- `cask_fill`
- `cask_strength`
- `single_cask`
- `edition`

The extractor should prefer missing values over invented certainty.

## Classifier Contract

The classifier receives:

- store price metadata
- the current matched bottle / release, if present
- extracted identity
- initial local candidates

It may use:

- local bottle search
- local entity search
- web search

It must return one decision:

- `match_existing`
- `correction`
- `create_new`
- `no_match`

Additional rules:

- `suggestedBottleId` must be a known candidate bottle id
- `suggestedReleaseId`, when present, must be a known candidate release id
- `parentBottleId`, when present for release creation, must be a known candidate bottle id
- `creationTarget` must be explicit for `create_new`

## Proposal Types

- `match_existing`
- `correction`
- `create_new`
- `no_match`

`create_new` may target:

- `bottle`
- `release`
- `bottle_and_release`

## Statuses

- `verified`
- `pending_review`
- `approved`
- `ignored`
- `errored`

`verified` is driven by deterministic automation checks, not the model confidence alone.

## Automation

Automation is schema-first:

- bottle and release confidence are not the same thing
- model confidence is advisory
- release-specific automation requires explicit validation of the release traits
- originating retailer evidence is never decisive for differentiating traits

Important rule:

- if bottle confidence is high and release confidence is not, persist the bottle and keep `releaseId = null`

### Trusted SMWS fast path

SMWS remains a deterministic path:

- parse the SMWS listing
- derive canonical bottle identity from the parsed code
- match or create under the SMWS brand
- auto-approve when deterministic resolution succeeds

### Auto-create

Auto-create may create:

- a bottle
- a release under an existing bottle
- a bottle plus a release

Auto-create only proceeds when:

- the proposed target is schema-valid
- decisive bottle / release traits are internally consistent
- high-trust or acceptable medium-trust evidence validates the differentiating traits
- unsupported or unvalidated identity traits do not remain

## Moderator Flows

Moderators can:

- approve an existing match
- ignore a proposal
- create a bottle
- create a release
- create a bottle and release together

Current UI limitation:

- automatic release suggestions are supported
- manual override is still bottle-first in the queue and does not yet expose a full existing-release picker

## Alias Behavior

Approving a price proposal does two separate things:

1. updates the matched `store_price` rows for the same site / listing / volume
2. stores a reusable alias for the listing name

Schema-first alias rule:

- price listing aliases should stay bottle-level unless the listing name is exactly a canonical release alias
- canonical release aliases should be created from the release record itself

This prevents a retailer-specific title from globally turning into an exact release alias.

## Known Gaps

- queue manual override still needs an explicit existing-release selector
- alias embeddings and canonical release alias maintenance should continue to be audited when release naming rules evolve
