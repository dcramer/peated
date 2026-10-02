# Auction rollout

Scotch Whisky Auctions (`scotchwhiskyauctions`) is enabled in the scraper
registry for manual runs. Its initial schedule is null. The target enforces
robots rules and allows at most 120 requests per hour, spaced at least 30
seconds apart. Collection follows the scraper's
[public-facts policy](../../apps/server/src/scraper/README.md#responsible-collection-of-public-facts).

## Deploying this change

Apply generated migration `0310_auction_details` with the API and worker deployment.
It adds detail-request tracking and removes the duplicate `last_seen_at` column.
The retained `last_checked_at` stores the same listing-check time.

Stop old API and worker processes before applying the migration. Start the
updated worker before the API accepts requests; it must know the
`ApplyAuctionLotMatch` job. Do not run old code against the removed column.
Deployment preserves saved checks, assignments, results, and the source schedule.
It does not rerun the matching backlog.

## Collection checks and scheduling

The first completed production run on October 1, 2026 took 3 hours 51 minutes,
made 458 requests, and collected 8,965 one-Bottle lots. Automatic collection
remains off. After deployment, check source health and recent runs:

```sh
pnpm cli auth status
pnpm cli api get /admin/external-sites/scotchwhiskyauctions/health
pnpm cli api get '/admin/external-sites/scotchwhiskyauctions/runs?limit=5'
```

Verify the target is enabled and its schedule remains null. Startup sync applies
registry settings; changing the schedule does not enable a disabled target.
Check saved outcomes, source links, hammer prices, and Bottle matches. Closed
lots must not send live-lot alerts.

Scheduled runs check open auctions first. When none is open, they check the
latest ended auction for final results. Manual runs retain the two-auction
window. Detail batches put requested live lots ahead of closed lots and wait
behind index collection; all work shares the same request limits.

For a manual run, submit
`pnpm cli api post /external-sites/scotchwhiskyauctions/trigger` and track the
returned run ID. An active run is a conflict, not a reason to queue another.
Rate-limit waits and saved-page resumes are expected. Do not start an archive
backfill as part of this rollout.

Before setting an automatic interval, verify a currently open auction with the
real parser and measure a completed run. Check that page ordering, bids, closed
results, and pagination still match the source. The repeat interval must keep
live lots within the six-hour freshness window, including delays during a run.
Hourly full scans are not supported by the current request budget.

Bounded checks on October 1–2, 2026 verified Ardbeg cask 3771 detail facts and
the first page of the open 184th auction through the real scraper. They did not
measure a complete current-auction refresh or activate automatic collection.

Use the admin schedule API only after these checks. It accepts
`{"schedule":{"runEvery":MINUTES}}` at
`PUT /admin/external-sites/scotchwhiskyauctions/schedule`; put the JSON in a
temporary file and pass it through `pnpm cli api put ... --input PATH`.
Enabling a schedule makes the source due immediately. Read health again after
changing it. Set `runEvery` to null to stop automatic runs; this does not cancel
an active run. To stop collection entirely, disable the target in the registry
and deploy both processes. Preserve lots, results, watches, and alert receipts.

See the [auction model](../features/auctions.md) for freshness, matching,
result history, and notification rules.

## Matching rollout

Matching uses listing text and explicit facts, not automatic photo readings.
Source photo links remain available to moderators; they are not copied into
the catalog. See the [auction model](../features/auctions.md#bottle-matching)
for matching and detail-collection rules.

Choose up to 100 unresolved lots from `GET /auction-lots/match-queue`. Read each
through `GET /auction-lots/{lot}` and keep its `fingerprint`, `lot.bottleId`, and
`matchCheckId`. Both reads require a moderator. Prefer lots with saved checks
to avoid new model calls. Put their current versions in a temporary JSON file:

```json
{
  "lots": [
    {
      "lotId": 123,
      "fingerprint": "observed-fingerprint",
      "expectedBottleId": null,
      "expectedCheckId": 456
    }
  ]
}
```

The IDs are examples. An administrator submits the real file with
`pnpm cli api post /auction-lots/recheck --input PATH`. A changed lot rejects
the whole batch. Matched and ignored lots are skipped. Default rechecks reuse
current references and saved checks; missing evidence may need a model call.
They do not scan auction indexes or create Bottles.

To read fresh details or retry a failed detail run, select a few unresolved
Scotch Whisky Auctions lots and add `"refreshSourceDetails": true`. The scheduler
collects requested details in batches of at most 25 after any active source run.
Read `sourceDetailsRequestedAt`, `sourceDetailsCheckedAt`, and `sourceDetailsRunId`
from each lot response, then inspect the linked run through the source run API.
Verify the facts against the source link. A detail read must not change lot
availability or hammer-price history.

After workers finish, check assignments, review outcomes, History actors, and
saved checks. Ended lots must not send alerts. Check a lot-only approval, a
remembered name reused by a later lot, and a reference conflict that changes
neither the lot nor reference.

If dispatch fails, re-fetch pending lots and resubmit their current versions.
Do not clear saved checks or force new model runs. Failed detail runs keep their
lot links until an administrator explicitly requests fresh details.

## Stop or roll back

Stop the matching pilot by not submitting more lots. A null index schedule does
not stop requested detail reads. To stop all source requests, disable the target
and deploy both processes. Pause the default and models queues before rollback.

Old code expects `last_seen_at`. Restore it from `last_checked_at` through a
generated migration before starting old code. Deploy compatible API, worker,
and UI versions together. Preserve saved records and enum values. Correct
confirmed errors through lot assignment or the reference-correction API,
not SQL or evidence deletion.
