# Auction rollout

Scotch Whisky Auctions (`scotchwhiskyauctions`) is enabled in the scraper
registry for manual runs. Its initial schedule is null. The target enforces
robots rules and allows at most 120 requests per hour, spaced at least 30
seconds apart. Collection follows the scraper's
[public-facts policy](../../apps/server/src/scraper/README.md#responsible-collection-of-public-facts).

## First production run

1. Deploy both the API and worker with the enabled target. Their startup sync
   applies the registry settings; changing the schedule does not enable a target.
2. Check authenticated API access and source health:

   ```sh
   pnpm cli auth status
   pnpm cli api get /admin/external-sites/scotchwhiskyauctions/health
   ```

   Confirm the target is enabled and the schedule remains null.

3. Trigger one manual run:

   ```sh
   pnpm cli api post /external-sites/scotchwhiskyauctions/trigger
   pnpm cli api get '/admin/external-sites/scotchwhiskyauctions/runs?limit=5'
   ```

   Keep the returned run ID. An active run is a conflict, not a reason to queue
   another. Rate-limit waits and saved-page resumes are expected.

4. Wait for that run to succeed. Check its duration, request and item counts,
   errors, and saved sold/unsold outcomes. Check a few source links and hammer
   prices, and review Bottle matches before relying on public history. A closed
   auction must not produce live-lot alerts.

The collector visits all pages of the two most recent auctions. The September
2026 sample suggests roughly four hours per full run at this request limit;
that estimate is not a measured production duration. Matching also queues work.
Do not trigger a full archive backfill as part of this rollout.

## Repeat collection

Before setting an automatic interval, verify a currently open auction with the
real parser and measure a completed run. Check that page ordering, bids, closed
results, and pagination still match the source. The repeat interval must keep
live lots within the six-hour freshness window, including delays during a run.
Hourly full scans are not supported by the current request budget.

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

Deploy migration `0307` (the `auction_lot` decision-history enum value), the API,
worker, and review UI together. Scheduling and existing assignments do not
change during deployment.

For a small pilot, choose up to 100 unresolved lots from
`GET /auction-lots/match-queue`. Read each through `GET /auction-lots/{lot}` and
keep its `fingerprint`, `lot.bottleId`, and `matchCheckId`. Both reads require a
moderator. Prefer lots with current saved checks to avoid new classification
requests. Put their observed versions in a temporary JSON file:

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

The IDs above are examples. An administrator submits the real file with
`pnpm cli api post /auction-lots/recheck --input PATH`. A stale batch queues
nothing. After workers finish, verify assignments, review outcomes, History
actors, and saved checks. Ended lots must not send alerts. Check a lot-only
approval, a remembered name reused by a later occurrence, and a reference
conflict that changes neither the lot nor reference.

If dispatch fails, pending lots remain in Background work. Resubmit their
observed versions; do not clear saved checks or force new model runs. Missing
checks may require classification through the existing evidence tools.

Stop the pilot by not submitting more lots. For rollback, pause the models worker
while deploying the previous API, worker, and UI together. Keep migration `0307`
and all saved records. Correct confirmed errors through lot assignment or the
reference-correction API, not SQL or evidence deletion. This release does not add
detail collection, automatic Bottle creation, global reprocessing, or scheduling.
