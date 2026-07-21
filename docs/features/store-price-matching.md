# Store Price Matching

This document describes how store prices are resolved to independently complete
Bottles or generic BottleGroup targets.

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
  exact Bottle is uncertain uses the generic BottleGroup target rather than a
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
2. The price should match an existing concrete Bottle.
3. The price should create or safely reuse an independent concrete Bottle.
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
4. build local concrete Bottle candidates
5. ask the generic bottle classifier for bottle-centric actions (`match`, `repair_bottle`, `create_bottle`, or `no_match`)
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
- normalized exact Bottle facts when they exist

This keeps exact source detail without forcing new public fields into the normal
Bottle entry flow.

## Candidate Generation

Candidate search presents independently complete Bottles, keyed by `bottleId`.
Text and brand retrieval require an exact CatalogTarget for the ordinary
Bottle. Accepted exact aliases resolve through their authoritative target;
generic, targetless, and ignored aliases do not produce Bottle candidates. An
explicit historical release id can contribute only by resolving through its
completed promotion mapping to the promoted Bottle, never through retained
BottleRelease metadata.

Sources:

- `current`
- `exact`
- `vector`
- `text`
- `brand`

Important behavior:

- exact alias matches select a concrete Bottle target
- sibling concrete Bottles can surface independently
- exact Bottle metadata is used in scoring and automation, not just the
  candidate name

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
- the current exact Bottle or generic BottleGroup target, if present
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
- `no_match`

Additional rules:

- `matchedBottleId` must be a known candidate bottle id when `action = match`
- `matchedBottleId` must be the current known candidate bottle id when `action = repair_bottle`; the proposed bottle draft is a sparse repair draft and unknown fields must not clear existing bottle facts
- a retained `matchedReleaseId`, when present during staged compatibility, must
  map to the known concrete Bottle candidate and is never a new picker choice
- `create_bottle` carries one complete marketed Bottle draft, including exact
  Bottle traits; it never chooses a parent Bottle or BottleGroup
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

New proposals emit `create_new` with `creationTarget = bottle` and one complete
`proposedBottle`. No live producer emits the historical `release` or
`bottle_and_release` proposal shapes. The staged approval adapter still consumes
and translates persisted historical shapes until its explicit removal task;
those shapes are not a supported producer contract.

### Correction repair compatibility

`proposedBottle` on a same-bottle correction remains a sparse compatibility
draft. Live classifier correction producers persist `statedAgeScope: exact`.
With that marker, a non-null `statedAge` is an exact edit for only the selected
Bottle. Historical unmarked proposals retain their original shared-age
interpretation, and approval applies that value through the canonical
BottleGroup update service so it atomically rematerializes every concrete
Bottle in the group.

Required name and brand, non-null series, category, and bottler, and non-empty
distillers are shared catalog edits. Non-null edition, ABV, single-cask and
cask-strength flags, vintage and release years, and canonical cask size, type,
and fill are exact edits for only the selected Bottle.

Null fields and empty distillers mean unknown and preserve existing catalog
facts; marked and unmarked null age never clears or changes either scope. False
and zero remain explicit values. After pending historical correction proposals
are drained or migrated, OpenSpec task 9.7 removes the marker and unmarked
shared-age fallback together.

## Statuses

- `verified`
- `pending_review`
- `approved`
- `ignored`
- `errored`

`verified` is driven by automation policy on top of the classifier result.
The shared code-derived tier is `auto | review`; it never reads a
model-supplied numeric score. It maps the action to a match/create/repair risk class, forces
review for unresolved risks, and evaluates structured evidence and explicit
identity anchors. Proposal-specific deterministic blockers may narrow an
`auto` result further but cannot upgrade a `review` result.

An unassigned correction that only assigns an existing Bottle may be eligible
for automatic assignment when the match tier and downstream blockers allow it.
Any proposed Bottle repair fields remain review-only and must not be applied by
that assignment.

## Automation

Automation is schema-first and code-derived:

- every unresolved model risk forces `review`
- an existing match requires a concrete target, must not replace a different
  current assignment, and needs an explicit anchor such as reaffirmed current
  identity, deterministic exact identity, an accepted exact alias, primary
  label/image evidence, or supportive reviewed evidence
- create and repair actions require supportive reviewed evidence, a
  deterministic identity anchor, or primary label/image evidence
- originating retailer evidence is never decisive for differentiating traits
- downstream policy may impose additional deterministic blockers for a
  particular write path

Classifier eval fixtures assert this behavior with
`expected.expectedTier: auto | review`. `expected.verifyEligible` is retained
only for deliberate downstream compatibility assertions about existing-match
verification; it is not the primary automation contract.

### Trusted SMWS fast path

SMWS remains a deterministic path:

- parse the SMWS listing
- derive canonical bottle identity from the parsed code
- match or create under the SMWS brand
- auto-approve when deterministic resolution succeeds

### Auto-create

Auto-create receives one complete `proposedBottle`. It creates an independently
complete Bottle in an automatic singleton group and one exact CatalogTarget,
writes the retained `(bottleId, null)` projection, and creates no BottleRelease.
A safe duplicate may be reused only when its canonical `fullName` exactly
matches and its exact target is active.

Auto-create only proceeds when:

- the proposed target is schema-valid
- decisive Bottle identity traits are internally consistent
- high-trust or acceptable medium-trust evidence validates the differentiating traits
- unsupported or unvalidated identity traits do not remain

## Moderator Flows

Moderators can:

- approve an existing match
- apply a same-bottle correction repair
- ignore a proposal
- approve complete Bottle create-new input

This input creates or safely reuses one independently complete concrete Bottle
and exact target. The staged compatibility route writes no BottleRelease and
returns `{ bottle, release: null }` after a successful
translatable request. A non-null legacy image URL is rejected because image
creation must use the canonical upload boundary.

Applying a correction commits its canonical shared/exact Bottle update and
proposal approval in one database transaction. Canonical update jobs run only
after that transaction commits. The correction path retains its Bottle response
for the current queue UI, but it does not maintain a separate Bottle updater or
mutate staged legacy BottleRelease rows.

The moderation queue presents complete Bottle suggestions and the manual
override selects a complete existing Bottle. Retained BottleRelease identity is
staged compatibility data, not a suggestion type or picker choice.

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

- alias embeddings and canonical exact-Bottle alias maintenance should continue
  to be audited when Bottle naming rules evolve
