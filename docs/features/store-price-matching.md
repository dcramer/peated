# Store Price Matching

This document reflects the store-price matching flow as implemented on March 15, 2026.

The authoritative identity model lives in [docs/architecture/whisky-identity-model.md](/home/dcramer/src/peated/docs/architecture/whisky-identity-model.md).

The classifier contract lives in [docs/architecture/bottle-classifier.md](/home/dcramer/src/peated/docs/architecture/bottle-classifier.md).
Price matching is one consumer of that bottle-classifier boundary.

## Core Schema Rules

These rules are the anchor for matching, automation, aliases, and moderator flows.

1. `bottle` is the stable parent product.
2. `bottle_release` is optional and only exists under a bottle.
3. `store_price` should follow the same shape as tastings and collections:
   `bottleId` required when matched, `releaseId` optional.
4. Bottle identity and release identity are not interchangeable.
5. Exact source facts should be preserved as observations before they are promoted into canonical release identity.
6. Observation persistence is currently bottle-reference-only.

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

Observation-first facts:

- exact cask or barrel numbers
- outturn
- bottle numbers
- exclusive wording
- unmodeled raw maturation text

Operational rule:

- If bottle identity is clear but release identity is not, match the bottle and leave `releaseId = null`.
- Do not force a release from weak evidence.
- Preserve the exact source facts as a `bottle_observation` row instead.
- If a bottle is still carrying a single known release-like identity on itself, do not also create a child `bottle_release`. Split the parent bottle first.

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
3. auto-ignore obvious non-whisky rows plus clearly non-single-bottle listings such as multipacks, gift sets, sampler bundles, and damaged-condition sale listings
4. build local bottle and release candidates
5. ask the classifier for `match_existing`, `correction`, `create_new`, or `no_match`
6. sanitize classifier output against real candidates and resolved entities
7. compute automation eligibility from deterministic checks
8. upsert the proposal row
9. auto-create only when the deterministic gate says it is safe

## Observation Persistence

Every approved bottle-reference match writes one `bottle_observation` keyed by `store_price:<priceId>`.

That observation stores:

- the raw store title and source URL
- the parsed extracted identity
- the proposal type and creation target
- normalized release facts when they exist

This keeps exact source detail without forcing new public fields into the normal bottle or release entry flow.

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

Store-price matching is a consumer of the generic bottle classifier, not the
owner of bottle-identity policy. The older `priceMatching*` helper names remain
only as compatibility shims around the canonical bottle-classifier modules.

The classifier receives:

- generic bottle reference metadata
- the current matched bottle / release, if present
- extracted identity
- initial local candidates

It may use:

- local bottle search
- local entity search
- web search

It returns a reviewed classification result with:

- `status = ignored | classified`
- `reason` when ignored
- `decision` when classified
- `artifacts` containing extracted identity, candidates, search evidence, and resolved entities

When `status = classified`, the decision must be one of:

- `match`
- `create_bottle`
- `create_release`
- `create_bottle_and_release`
- `no_match`

Additional rules:

- `matchedBottleId` must be a known candidate bottle id when `action = match`
- `matchedReleaseId`, when present, must be a known candidate release id
- `parentBottleId`, when present for release creation, must be a known candidate bottle id
- `identityScope` is reviewed as `product | exact_cask`
- Unsupported novelty flavored-whiskey or whiskey-liqueur products should end in classifier-driven `no_match`, but a flavor-adjacent noun in the title is not enough to exclude a bottle by itself
- When re-evaluation auto-ignores a bundle or damaged-condition listing, price matching should also clear any stale `store_price.bottleId` / `releaseId` assignment instead of leaving the old match attached

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

`verified` is driven by automation policy on top of the classifier result.
For existing-match proposals, that policy should stay thin:

- deterministic blockers must be empty
- the classifier confidence must clear the shared verification threshold
- reaffirming the current bottle/release assignment uses a lower threshold because the risk is lower; today that threshold is `80`
- new unmatched matches only verify at the higher bottle-only threshold; today that threshold is `96`
- the classifier should be the layer that decides when a raw-title reaffirmation or authoritative off-retailer confirmation justifies the `96+` confidence band

Evidence such as exact aliases, raw retailer titles, or authoritative off-retailer web confirmation should raise or lower classifier confidence upstream rather than creating separate downstream verify heuristics.

## Automation

Automation is schema-first:

- bottle and release confidence are not the same thing
- existing-match verification should come from classifier confidence plus deterministic blockers, not a second layer of retailer/title/exact-match heuristics
- release-specific automation requires explicit validation of the release traits
- originating retailer evidence is never decisive for differentiating traits

Important rule:

- if bottle confidence is high and release confidence is not, persist the bottle and keep `releaseId = null`
- unmatched release-level matches should not auto-verify from confidence alone

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

Default moderation should stay bottle-first. Release creation is optional precision, not a requirement for approval.

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
