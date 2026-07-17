# Store Price Matching

This document describes how store prices are resolved to bottles and releases.

Authoritative policy lives in:

- [Whisky Identity Model](../architecture/whisky-identity-model.md)
- [Bottle Normalization Contract](../architecture/bottle-normalization-contract.md)
- [Bottle Creation And Alias System](../architecture/bottle-creation-alias-system.md)
- [Bottle Classifier](../architecture/bottle-classifier.md)

Price matching is one consumer of the generic bottle-reference classifier. It
adds store-price persistence, queueing, moderation, and automation policy around
that classifier boundary.

## Local Contract

- A non-null `store_price.targetId` is the authoritative catalog identity. The
  retained `bottleId` / `releaseId` pair is migration compatibility and is
  written atomically with that target.
- Exact intent uses a concrete Bottle target. Known expression identity whose
  exact release is uncertain uses the generic BottleGroup target rather than a
  representative Bottle.
- A durable target is never downgraded or reconstructed from a conflicting
  retained pair. Targetless rows are limited to explicit staged or unresolved
  compatibility states.
- Preserve exact source facts as `bottle_observation` before promoting them into
  canonical Bottle identity, using the same target selected by approval.
- Target-aware listing aliases assign the same target and retained projection
  to StorePrices with the same site, listing name, and volume. They do not
  retarget cross-volume proposals.

## Goal

For each `store_price`, the matcher should decide one of four outcomes:

1. The current assignment is already correct.
2. The price should match an existing bottle or existing release.
3. The price should create or safely reuse a concrete Bottle, either independently or in a trusted existing BottleGroup.
4. There is no safe match.

The system persists one `store_price_match_proposal` row per `store_price`.

## Matching Modes

There are two matching modes:

1. Deterministic accepted-source matching.
2. General matching through extraction, local retrieval, classifier decisioning, and automation checks.

Accepted structured sources should bypass the general matcher when they already provide enough identity.

## Scope

This system covers:

- initial matching during price ingestion
- re-evaluation through the admin match queue
- trusted SMWS auto-resolution
- moderator approve / ignore / create flows

The system retains one current proposal per `store_price` and a durable
`store_price_match_attempt` history. Moderation writes its outcome to the
approved proposal's latest attempt without overwriting older attempts.

## Lifecycle

### 1. Price ingestion

`POST /external-sites/{site}/prices`:

- normalizes the incoming listing name
- builds the deterministic alias key from the listing name
- does an exact alias lookup for that accepted key
- if a target-aware alias exists, writes its authoritative `targetId` and
  retained compatibility pair together
- enqueues `ResolveStorePriceBottle` only when no exact alias target exists
- optionally enqueues `CapturePriceImage`

### 2. Matching evaluation

`resolveStorePriceMatchProposal(priceId)` evaluates one `store_price`.

Evaluation order:

1. trusted SMWS fast path
2. extract structured identity from image or text
3. auto-ignore obvious non-whisky rows plus clearly non-single-bottle listings such as multipacks, gift sets, sampler bundles, and damaged-condition sale listings
4. build local bottle and release candidates
5. ask the generic bottle classifier for bottle-centric actions (`match`, `repair_bottle`, `create_bottle`, `create_release`, `create_bottle_and_release`, `repair_parent_and_create_release`, or `no_match`)
6. map and sanitize classifier output against real candidates and resolved entities
7. compute automation eligibility from deterministic checks
8. upsert the proposal row
9. auto-create only when the deterministic gate says it is safe

## Observation Persistence

Every approved bottle-reference match writes one `bottle_observation` keyed by `store_price:<priceId>`.

That observation stores:

- the exact or generic CatalogTarget selected by approval
- the store title and source URL
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

Web search should stay narrow and targeted at a concrete unresolved trait. In normal cases the classifier should stop after one web search call; a second call is reserved for weak or contradictory first-pass results.

It returns a reviewed classification result with:

- `status = ignored | classified`
- `reason` when ignored
- `decision` when classified
- `artifacts` containing extracted identity, candidates, search evidence, and resolved entities

When `status = classified`, the decision must be one of:

- `match`
- `repair_bottle`
- `create_bottle`
- `create_release`
- `create_bottle_and_release`
- `repair_parent_and_create_release`
- `no_match`

Additional rules:

- `matchedBottleId` must be a known candidate bottle id when `action = match`
- `matchedBottleId` must be the current known candidate bottle id when `action = repair_bottle`; the proposed bottle draft is a sparse repair draft and unknown fields must not clear existing bottle facts
- `matchedReleaseId`, when present, must be a known candidate release id
- `parentBottleId`, when present for release creation, must be a known candidate bottle id
- `repair_parent_and_create_release` must include a known-candidate
  `parentBottleId`, a parent repair draft in `proposedBottle`, and a child
  release draft in `proposedRelease`
- `repair_parent_and_create_release` means the classifier found a supported
  child release but the local parent must be repaired first; price matching
  currently records this as a review-safe unresolved/no-match proposal rather
  than persisting a compound repair-and-create operation
- `identityScope` is reviewed as `product | exact_cask`
- Unsupported novelty flavored-whiskey or whiskey-liqueur products should end in classifier-driven `no_match`, but a flavor-adjacent noun in the title is not enough to exclude a bottle by itself
- When re-evaluation auto-ignores a bundle or damaged-condition listing, price
  matching clears the complete stale `store_price` identity tuple
  (`targetId`, `bottleId`, and `releaseId`) together rather than leaving a
  partial old match attached

## Proposal Types

- `match_existing`
- `correction`
- `create_new`
- `no_match`

`no_match` may carry a complete review-only parent repair plus release draft
when the classifier returned `repair_parent_and_create_release`; the row remains
unresolved because price matching cannot yet apply that compound operation.

`create_new` may target:

- `bottle`
- `release`
- `bottle_and_release`

### Correction repair compatibility

`proposedBottle` on a same-bottle correction remains a sparse compatibility
draft for the old parent/stable Bottle layer. Required name and brand, non-null
series, category, stable stated age, and bottler, and non-empty distillers are
shared catalog edits. Approval applies them through the canonical BottleGroup
update service, so they atomically rematerialize every concrete Bottle in the
group. Non-null edition, ABV, single-cask and cask-strength flags, vintage and
release years, and canonical cask size, type, and fill are exact edits for only
the selected Bottle.

Null fields and empty distillers mean unknown and preserve existing catalog
facts; false and zero remain explicit values. The legacy draft cannot express
an exact-age repair, and approval does not infer one from group size, null
fields, or current catalog data. A later explicit contract may replace this
sparse draft.

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
- an unassigned `correction` that only assigns an existing bottle may verify at
  the same high bottle-only threshold, but any proposed bottle repair fields
  remain review-only and must not be applied by that assignment
- the classifier should be the layer that decides when listing-title
  reaffirmation, official confirmation, or agent-reviewed corroborating web
  evidence justifies the `96+` confidence band

Evidence such as exact aliases, retailer titles, official pages, or
agent-reviewed corroborating web confirmation should raise or lower classifier
confidence upstream rather than creating separate downstream verify heuristics.

## Automation

Automation is schema-first:

- bottle and release confidence are not the same thing
- existing-match verification should come from classifier confidence plus deterministic blockers, not a second layer of retailer/title/exact-match heuristics
- release-specific automation requires explicit validation of the release traits
- originating retailer evidence is never decisive for differentiating traits

Important rule:

- if expression confidence is high and exact-release confidence is not, persist
  the generic BottleGroup target with the retained compatibility projection;
  do not choose a representative Bottle as exact identity
- unmatched release-level matches should not auto-verify from confidence alone

### Trusted SMWS fast path

SMWS remains a deterministic path:

- parse the SMWS listing
- derive canonical bottle identity from the parsed code
- match or create under the SMWS brand
- auto-approve when deterministic resolution succeeds

### Auto-create

Auto-create may receive retained proposal shapes for:

- a bottle
- a release under an existing bottle
- a bottle plus a release

All three shapes translate to canonical concrete Bottle creation. Bottle-only
and combined input create an independently complete Bottle in a singleton
group. Release-only input requires a trusted source Bottle and creates the new
Bottle in that source's group. Approval creates one exact CatalogTarget, writes
it with the retained `(bottleId, null)` projection, and creates no
BottleRelease. A safe duplicate may be reused only when its canonical
`fullName` exactly matches and its exact target is active.

Auto-create only proceeds when:

- the proposed target is schema-valid
- decisive bottle / release traits are internally consistent
- high-trust or acceptable medium-trust evidence validates the differentiating traits
- unsupported or unvalidated identity traits do not remain

## Moderator Flows

Moderators can:

- approve an existing match
- apply a same-bottle correction repair
- ignore a proposal
- approve retained bottle-only, release-only, or combined create-new input

These retained input variants all create or safely reuse one independently
complete concrete Bottle and exact target; they do not write BottleRelease. The
compatibility route returns `{ bottle, release: null }` after a successful
translatable request. A non-null legacy image URL is rejected because image
creation must use the canonical upload boundary.

Applying a correction commits its canonical shared/exact Bottle update and
proposal approval in one database transaction. Canonical update jobs run only
after that transaction commits. The correction path retains its Bottle response
for the current queue UI, but it does not maintain a separate Bottle updater or
rewrite child BottleRelease names.

Current UI limitation:

- automatic release suggestions are supported
- manual override is still bottle-first in the queue and does not yet expose a full existing-release picker

## Alias Behavior

Approving a price proposal does two separate things:

1. assigns the authoritative target and retained pair to matching `store_price`
   rows for the same site / listing name / volume
2. stores a reusable target-aware alias for the accepted listing key

Schema-first alias rule:

- an exact Bottle alias resolves directly to that Bottle's exact target
- a generic expression alias remains a BottleGroup target and never selects the
  representative Bottle
- matching propagation preserves the same site / listing name / volume scope
  and does not retarget cross-volume proposals

This prevents a retailer-specific title from globally choosing an arbitrary
exact Bottle.

## Known Gaps

- queue manual override still needs an explicit existing-release selector
- alias embeddings and canonical release alias maintenance should continue to be audited when release naming rules evolve
