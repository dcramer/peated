# Whisky auctions

Auction listings belong to a sale occurrence, not a physical bottle. Peated
links each supported single-bottle lot to one existing Bottle. The same release
can have several simultaneous lots or return in a later auction without
overwriting history. Sets and multipacks are outside the initial scope.

## Stored records

- `auction`: an auction house's event, unique by external site and source key.
- `auction_lot`: an occurrence, unique by auction and source lot key. It keeps
  the source URL, lot number, title, available size and condition, source identity
  facts, matching fingerprint, assignment, source state, and one availability
  check time.
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

The collector queues unresolved lots through `ResolveAuctionLot`. Matching first
reuses an exact accepted Bottle reference unless source facts conflict. Otherwise
it saves the classifier decision as a Bottle check. A match can apply automatically
under the same evidence rules as store prices: the chosen Bottle must be a
retrieved, active candidate, supporting evidence must justify the match, and
populated facts must not conflict. Missing evidence or unresolved risks require
review. Exact-reference classifier shortcuts keep their reference dependency.

Auction classification sets `readCandidateImages: false` in its saved request.
It uses the listing title, supplied structured source facts, catalog fields,
references, observations, and bounded source research. It does not automatically
read catalog photos or load their saved label readings. Published thumbnails
remain moderator review links, not extraction inputs. Missing batch or cask
evidence still requires review; a generic candidate's photo cannot fill that gap.

For a new Scotch Whisky Auctions lot without an accepted reference, a saved check,
or structured source facts, matching requests one detail-page read before the
first classification. The lot stays pending while those facts are collected.
Existing references and checks still reuse their evidence without another read.
The scheduler batches at most 25 requested lots per run and puts live lots before
historical lots. Index refreshes run first. All requests share the same robots
rules, 30-second spacing, and saved progress.

Details supply explicit cask numbers, strength, volume, distillation and bottling
years, cask-strength wording, and bottle counts. An individual bottle number is
not a release identifier. Descriptions and price graphs are not saved. A completed
read without useful facts, including a removed page, allows the normal title-based
check; missing identity evidence still requires review.

Detail facts never refresh availability or change prices. Changed facts produce
a new matching fingerprint and check; earlier checks and results stay saved.
Each request records the lot version, check ID, request time, and source URL to
reject old responses. Assignments made during a read stay intact. The saved
`details` run can resume interrupted work; a failed run requires an explicit
admin retry. Detail runs do not count as listing refreshes in source health.
Deployment does not request details for existing review lots.

Moderators review unresolved lots, including ended lots, in the Inbox. Protected
lot details and saved-run APIs provide source facts and evidence. The UI sends
the observed fingerprint, previous Bottle ID, and check ID. "Assign this lot"
changes only the lot. "Assign and remember name" also accepts a normalized Bottle
reference, but requires a current `global_alias` match and its suggested Bottle.
A different Bottle choice or missing reuse scope cannot remember a name.
Both writes commit together; an ignored or conflicting reference rejects the
whole save. The moderator can still assign just the lot.

A source identity change clears the assignment and check link. Correcting a
reference invalidates assignments made from it, not direct moderator decisions.
Completed matches appear in History with their actor and saved-check locator.
Pending matching belongs in Background work, not Inbox.

Administrators can recheck 1–100 explicit imported lots with expected source,
Bottle, and check versions. The whole batch is validated before work is saved;
matched and ignored lots are skipped. Workers reuse references and saved checks
on the default queue through `ApplyAuctionLotMatch`, so this work does not wait
behind new classifications. Missing checks wait for requested source facts or
queue `ResolveAuctionLot` on the models queue. Dispatch failures leave pending
work that can be submitted again. Rechecks do not collect auction indexes.
Setting `refreshSourceDetails` requests fresh Scotch Whisky Auctions details
instead of applying
the old check. This also retries a terminally failed detail run for the selected
unresolved lots. The same batch versions and administrator access are required.

Auction matching never creates Bottles, edits catalog facts, or automatically
accepts new references. Creation proposals need separate catalog review; ignored
classifications stay out of the Inbox.

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
limits, retry rules, and resumable page checkpoints. Manual runs traverse every
page of the two recent auction links. Scheduled runs select open auctions from
their explicit headings; when none is open, they check the latest ended event
by its reported date for final results. Repeating a saved page is safe. This is
recent collection, not a complete archive backfill.

Auction collection follows the scraper's
[responsible public-facts collection policy](../../apps/server/src/scraper/README.md#responsible-collection-of-public-facts).
We collect lot identifiers, Bottle matching facts, availability, dates, and
reported prices for discovery and history, with source attribution and links.
We do not seek explicit permission to index these public facts. We do not copy
the source's photographs, descriptions, or editorial content.

The target is enabled for manual runs and its initial automatic schedule is
null. Deploy the API and worker together.
The [rollout procedure](../operations/auctions.md) covers deployment, manual
checks, and scheduling repeat collection. A closed-auction run can verify history;
live availability still needs a currently open auction's markup and measured
refresh capacity.
The dated [source audit](../research/2026-09-30-whisky-auction-sources.md) records
the checked public evidence and limits.

The adapter does not infer precise closing times from a date-only
heading, fetch detail-page condition descriptions, or implement prioritized
hourly watched-lot checks. An unmet reserve during live bidding is not an unsold
result. Closing confirmation is required for that outcome. Sites may extend
the whole auction or individual lots, so a scheduled deadline never proves a sale.
Late corrections outside the selected event require an explicitly scoped collection.
Choose a repeat interval within the 6-hour freshness window only after
measuring a complete run. Automated activation is a separate operator decision.

Rollback stops the source and hides the UI; it must preserve saved lots,
results, watches, and alert receipts.
