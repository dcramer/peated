# Whisky auctions

Auction listings belong to a sale occurrence, not a physical bottle. Peated
links each supported single-bottle lot to one existing Bottle. The same release
can have several simultaneous lots or return in a later auction without
overwriting history. Sets and multipacks are outside the initial scope.

## Stored records

- `auction`: an auction house's event, unique by external site and source key.
- `auction_lot`: an occurrence, unique by auction and source lot key. It keeps
  the source URL, lot number, title, available size and condition, source identity
  facts, matching fingerprint, assignment, source state, and successful check times.
- `auction_lot_result`: append-only reported outcomes and price corrections.
  Public lists select one latest result per lot, not one sale per revision.
- `auction_watch`: a private member subscription to one exact Bottle.
- `auction_alert`: a durable member/lot receipt, independent of notification
  deletion. Alerts and notifications are created in the same transaction.

Source lot keys are not reusable product IDs. Matching a future lot does not
assert that it is the same physical unit. Source facts never edit catalog facts.

Money is stored in integer minor units with its original currency. A current
bid is separate from a sale result. Only a reported sold outcome may have a
sale amount, currency, and price kind; those three values are supplied together.
A sold result can have an unknown price. Hammer amounts are winning bids before
fees and taxes. Aftersale amounts have a separate price kind. No fee or exchange
rate calculation is included.

## Availability and history

Source states are `upcoming`, `live`, `aftersale`, `closed`, `withdrawn`, and
`unknown`. Public availability is derived at read and notification time:

- Confirmed closed or withdrawn lots remain unavailable.
- Other states require a successful check less than 6 hours old.
- A passed deadline without confirmed closure or extension means unknown,
  not sold or unsold. Aftersale availability is not ended by the old deadline.
- When a lot has no stored deadline, it uses a known auction deadline. A
  source can explicitly report a different lot deadline, including an extension.
- Failures and missing index entries never close a lot or erase a known result.

Observations older than or equal to a lot's last successful check cannot replace
state, facts, or results. Result revisions are added only when the reported
outcome, money, kind, sale time, or qualification changes. Observation time is
not a sale time. Missing prices and dates remain null.

## Bottle matching

The collector queues unresolved lots through `ResolveAuctionLot`. Exact accepted
Bottle references can reuse a prior decision when source facts do not directly
conflict. Assignment locks and rechecks the reference and active Bottle. New
classifier decisions are saved as Bottle checks and require moderator review;
they cannot create Bottles or change catalog fields. Ignored classifications
stay out of review. No new model, prompt, or heuristic matching system is added.

Moderators use the auction match queue and assignment API. They must supply the
observed source fingerprint and previous Bottle ID. A source identity change
clears the assignment and check link. Correcting a Bottle reference invalidates
only automatic auction assignments made from it; moderator decisions remain.
Unresolved ended lots remain reviewable for history.

Bottle merges move lots, alert references, and watches to the replacement Bottle;
duplicate member watches collapse, preserving the earlier subscription time.
Results stay attached to their lots. Bottle deletion is blocked while auction
references exist. Old Bottle IDs follow existing tombstones on public list reads.

## Watches and product

The Bottle's Auctions tab shows source links, checked availability, current
bids, and the latest reported result for each occurrence. Results paginate from
most recently discovered lots. Watches require sign-in and are visible only to
their owner. Moderator matching requires moderator access.

A watch produces an in-app notification when a matched lot becomes confirmed
live. Existing live lots are not backfilled for a watch created afterward.
Notification work rechecks the watch, assignment, freshness, and deadline while
holding locks. A member receives at most one alert per lot, including after
notification dismissal. Notifications describe a past listing; they do not
promise that a lot remains open. Email alerts are not included.

## Initial collection and activation

`scotchwhiskyauctions` uses the shared scraper runtime, robots checks, request
limits, retry rules, and resumable page checkpoints. Each run traverses every
page of the 2 most recent numeric auction links, revisiting those auctions for
published closing results and corrections. Repeating a saved page is safe.
This is a recent-window collector, not a complete archive backfill.

Auction collection follows the scraper's
[responsible public-facts collection policy](../../apps/server/src/scraper/README.md#responsible-collection-of-public-facts).
We collect lot identifiers, Bottle matching facts, availability, dates, and
reported prices for discovery and history, with source attribution and links.
We do not seek explicit permission to index these public facts. We do not copy
the source's photographs, descriptions, or editorial content.

The target is enabled for manual runs and its initial automatic schedule is
null. Deploy the API and worker before triggering the first production run.
The [rollout procedure](../operations/auctions.md) covers that run and checks
before scheduling repeat collection. A closed-auction run can verify history;
live availability still needs a currently open auction's markup and measured
refresh capacity.
The dated [source audit](../research/2026-09-30-whisky-auction-sources.md) records
the checked public evidence and limits.

The initial adapter does not infer precise closing times from a date-only
heading, fetch detail-page condition or identity facts, or implement prioritized
hourly watched-lot checks. Full repeat runs reconcile the recent window;
late corrections beyond that window require an explicitly scoped collection.
Choose a repeat interval within the 6-hour freshness window only after
measuring a complete run. Automated activation is a separate operator decision.

Rollback stops the source and hides the UI; it must preserve saved lots,
results, watches, and alert receipts.
