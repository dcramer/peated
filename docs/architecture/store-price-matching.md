# Store Price Matching

Store price matching links each retailer listing to one complete Bottle. It
uses the shared [Bottle Classifier](./bottle-classifier.md) and adds saved
proposals, review, and automation rules.

`assessBottleResolution` in `apps/server/src/lib/bottleMatchingAutomation.ts`
checks matches and creation for prices, auctions, reviews, and photos. Source
type does not select identity rules. Prices own their saved proposals, review
permissions, listing attachment, and history.

Read these identity rules first:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Reference Resolution](./bottle-reference-resolution.md)
- [Bottle Reference Normalization](./bottle-reference-normalization.md)

## Saved Identity

- `store_price.bottleId` is the Bottle assigned to the listing.
- `matchedReferenceId` records a reference-derived assignment, not a guess
  from the listing name. Explicit approval or a trusted identifier clears it.
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
reference when one exists. Otherwise it queues `ResolveStorePriceBottle` once:
a listing that already has a saved proposal is not queued again by later
scrapes. A changed source fingerprint or a new barcode assignment queues a
fresh classification.

When the AI service is unavailable, classification saves nothing and the job
waits for the service, as the
[worker README](../../apps/server/src/worker/README.md) describes. A spent
budget or an outage never marks a listing `errored`.

A trusted Bottle source may emit one parsed Bottle and its retailer listing
together. After the source successfully creates or resolves that exact Bottle,
price ingestion assigns the listing to the returned Bottle ID and records the
source decision without running the classifier. If Bottle resolution is
ambiguous or conflicts, the listing stays unresolved and uses the normal queue.
Only a registered source-specific Bottle sink may use this path. A generic
configured price source cannot choose a Bottle ID. An SMWS extractor may change
how it reads JSON or HTML, but it must keep the SMWS Bottle sink as the trusted
create-and-assign boundary.

A store price is one listing for one Bottle. Bundles, gift kits and sets,
multipacks, and samplers are never recorded as prices: a scraper skips them
using the source's own markers, such as a SKU prefix or tag, the run ignores
any that still arrive, and a moderator hides any that were saved through the
price update route. Hidden listings leave Bottle pages, price lists, and price
history.

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

Generic SMWS reference parsing supplies an exact code as an identity anchor and
still uses the classifier. The SMWS catalog importers instead use the trusted
Bottle-source path above because they already created or resolved the Bottle
from the same structured source record.

## Proposal And Review

Proposal types use the classifier's action names: `match`, `create_bottle`,
and `no_match`. A `match` whose `currentBottleId` differs from its suggested
Bottle would replace the listing's current Bottle. Status values are
`pending_review`, `approved`, `ignored`, and `errored`. A decision that may
apply automatically is applied as soon as it is saved; it stays
`pending_review` only if applying fails.

Moderators can:

- approve an existing Bottle match;
- approve one complete new Bottle;
- choose a different existing Bottle; or
- ignore the proposal.

A reference correction clears only listings known to have used that reference
and reopens their proposals for review. The old suggestion and automatic
approval are not reused. For a legacy approved proposal whose price was already
cleared, `POST /prices/match-queue/{proposal}/reopen` performs the same reset.
It requires moderator access, the observed proposal update time and source
fingerprint, an unassigned price, and no active evaluation. It does not queue
model work or change the catalog. Earlier decisions and attempts remain saved.

A moderator may atomically create a complete, independently reviewed Bottle
from any reviewable proposal, including an `errored` one. An active
processing lease still blocks the write. A Bottle that needs a catalog fix
goes through a Bottle audit, not the listing queue.

The review queue lists only listings the store still shows: a price last seen
more than 7 days ago (`STORE_PRICE_VALIDITY_DAYS`) leaves the queue, its counts,
and bulk actions until a scrape sees it again. A direct link to its proposal
still opens it.

A retry run in `no_web` mode skips web search and reuses the proposal's saved
extracted facts. When no facts were saved, it extracts them again rather than
classify with none.

Approval locks and rechecks current state. It submits one Bottle ID. It never
selects a BottleGroup representative or a legacy release. Failed work can retry
only after reconciliation; stale work needs a new check or manual correction.

An approval always assigns the reviewed price to the selected Bottle. It may
also create a reusable Bottle Reference only when the saved proposal allows it
and the moderator accepts that proposal's Bottle. Choosing a different Bottle
does not create a reference. Reference propagation stays limited to the same
site, listing name, and volume.

## Automatic Changes

The classifier decides identity. Code decides only whether that decision may
apply without a moderator, using the same `deriveAutomationTier` rule as photo
creation (`assessBottleResolution`). It never uses a model-written confidence
number.

- Every unresolved risk forces review.
- A match must name a reviewed candidate and must not replace a different saved
  assignment. It needs supportive web evidence, the classifier's judgment that
  no research was needed, or facts read from the listing's own label image.
- A create needs supportive web evidence, facts read from the listing's label
  image, an exact-cask anchor such as an SMWS code, or complete structured
  scraper facts.
- A Bottle that contradicts the scraper's structured facts goes to review.
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
- shared identity checks: `apps/server/src/lib/bottleMatchingAutomation.ts`
- API: `apps/server/src/orpc/routes/prices/matchQueue/`

Scraper model and search calls can use the `SCRAPER_*` credentials. Other
requests use the application credentials. The runtime configuration owns exact
fallback behavior.
