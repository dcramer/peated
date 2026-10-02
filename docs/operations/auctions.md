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

The collector visits all pages of the two most recent auctions. The first
completed production run on October 1, 2026 took 3 hours 51 minutes, made 458
requests, and collected 8,965 one-Bottle lots. Matching also queues work.
Do not trigger a full archive backfill as part of this rollout.

## Repeat collection

Scheduled runs check open auctions first. When none is open, they check the
latest ended auction for final results. Manual runs retain the two-auction
window. Detail batches put requested live lots ahead of closed lots and wait
behind index collection; all work shares the same request limits.

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

The collector retains photo URLs already published on auction index pages. It
does not guess larger image URLs. These links appear
in the moderator-only lot response as `sourceImageUrl`, and in Source facts in
the review workspace. They are not published as Peated bottle images.

Auction matching uses the title or reviewed structured source facts for
extraction. It saves `readCandidateImages: false` and skips automatic catalog-photo
readings, including cached readings. Thumbnails do not replace the title or count
as label evidence for automatic approval. The first pilot found incorrect numeric
readings of otherwise correct catalog photos. Text-first inspection removes those
readings from new runs; it does not relax conflict or review rules.
Adding a photo link does not invalidate an accepted assignment or replace a
saved check. This is review evidence, not a new Bottle identity.

Existing checks keep their original input and evidence. Deploying text-first
inspection does not erase them, rerun the backlog, or upgrade their decisions.
The current recheck operation reuses saved evidence; it does not request a fresh
classification merely because this policy changed.

Deploy migration `0307` (the `auction_lot` decision-history enum value), the API,
worker, and review UI together. Scheduling and existing assignments do not
change during deployment.

For source details, apply migrations `0310` and `0311` before deploying the API
and worker. They add requested/checked timestamps and a scraper-run pointer,
without changing existing identities or assignments. New unmapped SWA lots
without structured facts request details before their first model check; accepted
references and saved checks still reuse their evidence. The five-minute scheduler dispatches
at most 25 requested lots per run. Requests share the source's robots checks
and rate limit with index collection. Failed runs retain their pointers rather
than starting endless retries. A detail run appears as `details` in run history,
not as a successful auction refresh in source health.

Migration `0312` removes the duplicate lot `last_seen_at` and adds the `details`
run purpose. The retained `last_checked_at` already stores the same successful
listing-check time; IDs, assignments, result history, watches, and alerts stay.
Coordinate this deployment: stop old API and worker processes before applying
the migration, then start the updated processes. Do not run old code against the
removed column. This cleanup does not change the automatic schedule.

A local live detail-run check on October 1, 2026 passed for the 157th and 183rd
auction's Ardbeg cask 3771 lots, using the real registered scraper, robots rules,
and request pacing. It verified cask, strength, volume, bottle count, and years
without refreshing lot availability. This does not verify current live-auction
availability or activate a production schedule.

A local live check on October 2, 2026 also passed discovery of the open 184th
auction and collection of its first listing page through the real registered
scraper. The bounded run saved its progress for the next page. This checks the
current page structure, not a complete refresh, final hammer prices, or the
automatic schedule. A completed current-auction run still needs to be measured.

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

For the detail-page pilot, add `"refreshSourceDetails": true` to this object
and choose only a few unresolved Scotch Whisky Auctions lots. This requests
fresh details even when a previous check or failed detail run exists. It skips
matched and ignored lots. The scheduler waits for any active source run to
finish before starting the bounded detail run; it does not scan auction indexes.
Read each lot's `sourceDetailsRequestedAt`, `sourceDetailsCheckedAt`, and
`sourceDetailsRunId` from the protected details response, then inspect that run
through the source's run API. Verify extracted facts against its source link.
Earlier checks stay saved. New facts can trigger a new match check, but a
detail read never refreshes availability or replaces hammer-price history.

The IDs above are examples. An administrator submits the real file with
`pnpm cli api post /auction-lots/recheck --input PATH`. A stale batch queues
nothing. After workers finish, verify assignments, review outcomes, History
actors, and saved checks. Ended lots must not send alerts. Check a lot-only
approval, a remembered name reused by a later occurrence, and a reference
conflict that changes neither the lot nor reference.

If dispatch fails, pending lots remain in Background work. Resubmit their
observed versions; do not clear saved checks or force new model runs. Missing
checks may require classification through the existing evidence tools.
Rechecks apply current references and saved checks on the default queue; only
missing evidence joins the models queue. A model job already queued for the same
lot becomes a no-op if the recheck finishes first.
Deploy the worker with `ApplyAuctionLotMatch` before the API starts dispatching
that job. Re-fetch unresolved pilot lots after deployment and submit their
current versions; no collection run is needed.

Stop the pilot by not submitting more lots. For rollback, pause the default and
models queues and stop source collection. Do not start code that expects
`last_seen_at` after migration `0312`; any rollback must first restore that
column from `last_checked_at` through a generated migration. Deploy compatible
API, worker, and UI versions together. Keep all saved records and enum values.
Correct confirmed errors through lot
assignment or the reference-correction API, not SQL or evidence deletion. This release does not add
automatic Bottle creation, global reprocessing, or an auction-index schedule.
Detail collection runs only for requested unresolved lots. To stop all source
requests, disable the target and deploy both processes; a null index schedule
alone does not stop requested detail work.
