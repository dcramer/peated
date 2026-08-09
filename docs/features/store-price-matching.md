# Store Price Matching

This document describes how store prices are resolved to independently complete
Bottles.

Authoritative policy lives in:

- [Whisky Identity Model](../architecture/whisky-identity-model.md)
- [Bottle Normalization Contract](../architecture/bottle-normalization-contract.md)
- [Bottle Creation And Alias System](../architecture/bottle-creation-alias-system.md)
- [Bottle Classifier](../architecture/bottle-classifier.md)

Price matching is one consumer of the shared Reference Classification. It
adds store-price persistence, queueing, moderation, and automation policy around
that classifier boundary.

## Local Contract

- A non-null `store_price.bottleId` is the authoritative catalog identity.
  The retained `releaseId` column is migration evidence only until its
  separately approved schema-removal gate.
- Known expression identity whose exact Bottle is uncertain may use the retained
  general Bottle. It never uses BottleGroup or substitutes a representative.
- A durable Bottle assignment is never downgraded or reconstructed from
  conflicting historical fields. Null `bottleId` is the explicit unresolved
  state.
- Preserve exact source facts as `bottle_observation` before promoting them into
  canonical Bottle identity, using the same Bottle selected by approval.
- Assigned listing aliases propagate the same Bottle id to StorePrices with the
  same site, listing name, and volume. They do not retarget cross-volume
  proposals.

## Goal

For each `store_price`, the matcher should decide one of four outcomes:

1. The current assignment is already correct.
2. The price should match an existing Bottle.
3. The price should create or safely reuse an independent Bottle.
4. There is no safe match.

The system persists one `store_price_match_proposal` row per `store_price`.

The primary match proposal remains authoritative for the listing decision.
Every full classifier run also persists a linked Bottle check with supplemental
Suggested Changes. That check does not replace or reinterpret the primary
proposal.

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
- if an assigned alias exists, writes its authoritative `bottleId`
- allows a general alias to resolve only to the retained general Bottle
- enqueues `ResolveStorePriceBottle` only when no accepted direct Bottle alias
  assignment exists
- optionally enqueues `CapturePriceImage`

### 2. Matching evaluation

`resolveStorePriceMatchProposal(priceId)` evaluates one `store_price`.

Evaluation order:

1. trusted SMWS fast path
2. extract structured identity from image or text
3. auto-ignore obvious non-whisky rows plus clearly non-single-bottle listings such as multipacks, gift sets, sampler bundles, and damaged-condition sale listings
4. build local Bottle candidates
5. ask the shared bottle classifier for Bottle-centric actions (`match`,
   `repair_bottle`, `create_bottle`, or `no_match`)
6. map and sanitize classifier output against real candidates and resolved entities
7. compute automation eligibility from deterministic checks
8. upsert the proposal row
9. record the match attempt and a linked Bottle check from the classifier result
10. auto-create only when the deterministic gate says it is safe

Every full reference run creates a `resolve_reference` Bottle check from the
same reviewed artifacts. This includes initial unresolved listings, ignored
results, and individual or bulk retries. Its Suggested Changes are
supplemental catalog work, not additional price-match outcomes. Deterministic
accepted-alias matches do not create a check because they do not run the
classifier.

The proposal, attempt, and linked check commit as one transaction before
automation begins. If the check cannot be validated or persisted, the resolver
rolls back that successful match state and records an errored proposal and
attempt for inspection or retry.

## Observation Persistence

Every approved Match writes one `bottle_observation` keyed by `store_price:<priceId>`.

That observation stores:

- the Bottle selected by approval
- the store title and source URL
- the parsed extracted identity
- the proposal type and creation target
- normalized exact Bottle facts when they exist

This keeps exact source detail without forcing new public fields into the normal
Bottle entry flow.

## Candidate Generation

Candidate search presents independently complete Bottles, keyed by `bottleId`.
Accepted aliases resolve directly to their Bottle; unassigned and ignored
aliases do not produce Bottle candidates. Retained release ids and
BottleRelease rows are not classifier candidate inputs. The durable promotion
mapping is retained only for migration, audit, merge, and cleanup internals.

Sources:

- `current`
- `exact`
- `vector`
- `text`
- `brand`

Important behavior:

- exact alias matches select a Bottle
- sibling Bottles can surface independently
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

Store-price matching is a consumer of the shared Bottle classifier, not the
owner of bottle-identity policy. The older `priceMatching*` helper names remain
only as compatibility shims around the canonical bottle-classifier modules.

The classifier receives:

- Bottle Reference metadata
- the current Bottle, if present
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
- `matchedBottleId` must be the current known candidate bottle id when `action = repair_bottle`; `proposedBottle` is the full canonical repair draft, and the price-matching adapter must not treat null or unknown values as sparse clears. Sparse field changes belong to supplemental `update_bottle` operations
- classifier decisions carry Bottle ids only; they do not expose a legacy
  release-id picker
- `create_bottle` carries one complete marketed Bottle draft, including exact
  Bottle traits; it never chooses a Bottle Group
- `identityScope` is reviewed as `product | exact_cask`
- Unsupported novelty flavored-whiskey or whiskey-liqueur products should end in classifier-driven `no_match`, but a flavor-adjacent noun in the title is not enough to exclude a bottle by itself
- When re-evaluation auto-ignores a bundle or damaged-condition listing, price
  matching clears the stale `store_price.bottleId` and retained `releaseId`
  rather than preserving a conflicting identity pair

## Proposal Types

- `match_existing`
- `correction`
- `create_new`
- `no_match`

New proposals emit `create_new` with one complete `proposedBottle`. Live writers
clear the historical release ids, parent id, `creationTarget`, and
`proposedRelease` columns. Immutable attempt rows may retain those values as
audit evidence, but a release-shaped current proposal must be reclassified
before approval; it is not translated into a live picker choice.

### Correction repair compatibility

`proposedBottle` on a same-bottle correction remains a sparse compatibility
draft. Live classifier correction producers persist `statedAgeScope: exact`.
With that marker, a non-null `statedAge` is an exact edit for only the selected
Bottle. Historical unmarked proposals retain their original shared-age
interpretation, and approval applies that value through the canonical
BottleGroup update service so it atomically rematerializes every Bottle in the
group.

Required name and brand, non-null series, category, and bottler, and non-empty
distillers are shared catalog edits. Non-null edition, ABV, single-cask and
cask-strength flags, vintage and release years, and canonical cask size, type,
and fill are exact edits for only the selected Bottle.

Null fields and empty distillers mean unknown and preserve existing catalog
facts; marked and unmarked null age never clears or changes either scope. False
and zero remain explicit values. After pending historical correction proposals
are drained or migrated, separately approved cleanup removes the marker and
unmarked shared-age fallback together.

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
- an existing match requires a Bottle, must not replace a different
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
complete Bottle in an automatic singleton group and creates no BottleRelease.
A safe duplicate may be reused only when its canonical `fullName` exactly
matches and the Bottle is active.

Auto-create only proceeds when:

- the proposed Bottle is schema-valid
- decisive Bottle identity traits are internally consistent
- high-trust or acceptable medium-trust evidence validates the differentiating traits
- unsupported or unvalidated identity traits do not remain

## Moderator Flows

Moderators can:

- approve an existing match
- apply a same-bottle correction repair
- ignore a proposal
- approve complete Bottle create-new input

Incoming Listings owns only the primary listing decision. Once that decision is
complete, an actionable linked check appears in Audits under the
Incoming Listings source and the completed proposal leaves the listing queue.
This keeps supplemental catalog findings and Review Operations in the same
inbox as other Bottle audit work without exposing them before their primary
listing decision is settled.

Each Review Operation is read-only until separately approved. Approval never
means “apply the whole agent result”: selected `update_bottle`,
`merge_bottles`, `update_entity`, and `merge_entities` operations execute
independently through canonical services. Failed operations may be retried
through reconciliation; blocked or stale work requires manual correction or a
new check.

The route accepts one complete Bottle input, creates or safely reuses one
independently complete Bottle, and returns that Bottle directly. It has no
staged response wrapper and writes no BottleRelease. A non-null legacy image URL
is rejected because image creation must use the canonical upload boundary.

Applying a correction commits its canonical shared/exact Bottle update and
proposal approval in one database transaction. Canonical update jobs run only
after that transaction commits. The correction path retains its Bottle response
for the current queue UI, but it does not maintain a separate Bottle updater or
mutate staged legacy BottleRelease rows. Repair is available only when the
proposal's current and suggested identities are the same non-null active
Bottle; that Bottle id is locked and revalidated before the update
commits.

The moderation queue renders current and suggested Bottles independently or an
explicit unknown state. Approval submits one Bottle id. A general-expression
suggestion is approvable only when it identifies the retained general Bottle;
it never selects a representative. The manual override searches complete
existing Bottles and submits the selected Bottle id without a second resolver.
Retained BottleRelease identity is staged compatibility evidence, not a picker
choice or assignment authority.

## Price Presentation

Price reads and changes render the assigned independently complete Bottle.
Bottle-specific price lists and history include only rows assigned to that
Bottle. Unresolved prices remain unresolved; BottleGroup is not a display or
activity identity.

## Alias Behavior

Approving a price proposal does two separate things:

1. assigns the authoritative Bottle id to matching `store_price` rows for the
   same site / listing name / volume
2. stores a reusable Bottle alias for the accepted listing key

Schema-first alias rule:

- every assigned alias resolves directly to one Bottle id
- a general expression alias resolves to the retained general Bottle and never
  selects the representative Bottle
- no BottleGroup alias identity or second resolver remains
- matching propagation preserves the same site / listing name / volume scope
  and does not retarget cross-volume proposals

This prevents a retailer-specific title from globally choosing an arbitrary
exact Bottle.

## Known Gaps

- alias embeddings and canonical exact-Bottle alias maintenance should continue
  to be audited when Bottle naming rules evolve
