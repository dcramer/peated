# Store Price Matching

Store price matching links each retailer listing to one complete Bottle. It
uses the shared [Bottle Classifier](./bottle-classifier.md) and adds saved
proposals, review, and automation rules.

Read these identity rules first:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Reference Resolution](./bottle-reference-resolution.md)
- [Bottle Reference Normalization](./bottle-reference-normalization.md)

## Saved Identity

- `store_price.bottleId` is the Bottle assigned to the listing.
- A null `bottleId` means unresolved. Do not guess from old release fields.
- One `store_price_match_proposal` stores the current proposal for each price.
- `store_price_match_attempt` keeps earlier attempts and review outcomes.
- A full classifier run also saves a linked `resolve_reference` Bottle check.
- Old release fields remain only for migration and audit support. New behavior
  must use Bottle IDs.

The source item is identified by its site and strongest stable product ID. Use
the product URL only when the source has no stable ID. Never use the display
title as the source identity. Variants with distinct product IDs may share one
product page URL.

Each row stores a fingerprint of Bottle-related source facts. An unchanged
fingerprint keeps a reviewed assignment. A changed fingerprint clears an
assignment that current exact evidence cannot support and queues review. A
different store or product ID never inherits the assignment.

## Resolution

Price ingestion builds the Bottle Reference key and reuses an assigned exact
reference when one exists. Otherwise it queues `ResolveStorePriceBottle`.

A full run:

1. Extracts Bottle facts from the title or image.
2. Ignores clear non-whisky, multipack, sampler, and damaged-condition listings.
3. Finds complete Bottle candidates.
4. Gives verified identity anchors, candidates, and source evidence to the
   Bottle classifier.
5. Checks the classifier result against current Bottle and Entity records.
6. Derives `auto` or `review` from action risk, evidence, and unresolved risks.
7. Saves the proposal, attempt, and linked Bottle check in one transaction.
8. Applies an automatic match or create only when all code-owned checks pass.

The classifier returns `match`, `create_bottle`, or `no_match`. A required
catalog correction stays `no_match`; a separate Bottle audit owns catalog
changes. Deterministic code can reject an unsafe result but cannot promote a
semantic result that the classifier did not make.

SMWS parsing supplies an exact code as an identity anchor. The classifier still
makes the Bottle decision.

## Proposal And Review

Proposal types are `match_existing`, `correction`, `create_new`, and
`no_match`. Status values are `verified`, `pending_review`, `approved`,
`ignored`, and `errored`.

Moderators can:

- approve an existing Bottle match;
- apply a correction to that same Bottle;
- approve one complete new Bottle;
- choose a different existing Bottle; or
- ignore the proposal.

Approval locks and rechecks current state. It submits one Bottle ID. It never
selects a BottleGroup representative or a legacy release. Failed work can retry
only after reconciliation; stale work needs a new check or manual correction.

An approval always assigns the reviewed price to the selected Bottle. It may
also create a reusable Bottle Reference only when the saved proposal allows it
and the moderator accepts that proposal's Bottle. Choosing a different Bottle
does not create a reference. Reference propagation stays limited to the same
site, listing name, and volume.

## Automatic Changes

Code derives automation eligibility. It never uses a model-written confidence
number.

- Every unresolved risk forces review.
- A match must identify an active Bottle and must not replace a different saved
  assignment.
- A create must provide one complete, valid Bottle with enough independent or
  primary label evidence for its distinguishing facts.
- Source retailer text alone cannot prove a distinguishing fact.
- Duplicate Bottle, reference, and current-state checks can only make an
  automatic result stricter.

An automatic create makes one independently complete Bottle in a new singleton
group. It creates no BottleRelease. It may reuse an active Bottle only when the
complete stored name and identity agree.

## Images And Observations

An approved match saves a `bottle_observation` for that price when supported by
the workflow. It records the selected Bottle, source URL and title, extracted
facts, and proposal result without turning retailer-only facts into public
Bottle fields.

A StorePrice image can fill an empty Bottle image. It cannot replace an image or
reuse an image URL that a moderator rejected for that Bottle.

## Owners

- schema: `apps/server/src/db/schema/stores.ts`
- ingestion: `apps/server/src/lib/createStorePrices.ts`
- resolution: `apps/server/src/lib/priceMatching.ts`
- proposals and review: `apps/server/src/lib/priceMatchingProposals.ts`
- automation checks: `apps/server/src/lib/priceMatchingAutomation.ts`
- API: `apps/server/src/orpc/routes/prices/matchQueue/`

Scraper model and search calls can use the `SCRAPER_*` credentials. Other
requests use the application credentials. The runtime configuration owns exact
fallback behavior.
