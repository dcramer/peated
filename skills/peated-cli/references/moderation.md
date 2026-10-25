# Price-Match Moderation

Decision rules live in the `peated-scraper-queue` skill. This reference covers
the requests.

## Read

```bash
pnpm cli api get '/prices/match-queue?state=actionable&sort=created&limit=100&cursor=1'
pnpm cli api get /prices/match-queue/PROPOSAL_ID
pnpm cli api get /prices/PRICE_ID/match-proposal
pnpm cli api get /prices/match-queue/retry-runs/active
pnpm cli api get '/bottles/create-candidates?name=Port%20Charlotte%2018&statedAge=18&limit=5'
pnpm cli api get '/bottles?query=Port%20Charlotte%2018&limit=12'
pnpm cli api get '/admin/moderation/history?category=listing&limit=100&cursor=1'
```

Queue filters: `kind=create_bottle|match|errored`,
`state=actionable|processing`, `sort=priority|created|-created`, `query`,
`site`, `cursor`, `limit` (maximum 100). `no_match` proposals appear only
without `kind`. `stats` on the list response carries the filtered counts.

`create-candidates` returns advisory Bottles with `comparison.agreements`,
`comparison.missing`, and `comparison.conflicts`; see
`docs/architecture/bottle-search.md`.

`get` prints the whole response. `select` exists only in batch files and takes
an array of dotted paths such as `price.bottle.id`.

## Batch

Use one batch file for a reviewed multi-item plan. Put a `GET` preflight
immediately before each mutation and assert the proposal's ID, status, and type
with `expect`. The runner stops at the first mismatch or API error and prints
zero-based indexes, so resume from the failed item's preflight:

```bash
pnpm cli api batch --input /tmp/peated-batch.json --yes
pnpm cli api batch --input /tmp/peated-batch.json --from 8 --yes
```

Read-only batches may run concurrently; mutation batches stay sequential:

```bash
pnpm cli api batch --input /tmp/peated-reads.json --concurrency 10
```

Never resume at a mutation after an indeterminate failure. Re-fetch first,
because the write may have committed before the response was lost.

## Write

Match body:

```json
{ "proposal": 123, "action": "match", "bottle": 456 }
```

The server compares the Bottle with the listing's saved facts. A `400` that
names fields such as `abv` or `edition` means they differ. Check the label
image and the store page. If the Bottle is still right, send the match again
with what you checked:

```json
{
  "proposal": 123,
  "action": "match",
  "bottle": 456,
  "reason": "Store page states 62.5% (125 proof); the label read of 62.9% is wrong."
}
```

A reason is saved on the decision even when nothing differs, so send one
whenever the evidence is not obvious from the listing.

Ignore body:

```json
{ "proposal": 123, "action": "ignore" }
```

```bash
pnpm cli api post /prices/match-queue/123 --input /tmp/peated-request.json --yes
```

Create body: `{ "proposal": 123, "independentBottle": ... }`. It works for a
reviewable `create_bottle`, `match`, or `no_match` proposal, including
`errored`; active processing still blocks the write.

```bash
pnpm cli api post /prices/match-queue/123/create-bottle --input /tmp/peated-request.json --yes
```

Stop on `409`. Verify proposal status, the assigned or created Bottle, and
moderation history after success.

Undo a wrong match. Read the proposal first and send what you observed. With
only a price ID, read `/prices/PRICE_ID/match-proposal`: it returns the price's
proposal in any status. Send its `id`, `updatedAt`, `price.sourceFingerprint`,
and `price.bottle.id`:

```json
{
  "proposal": 123,
  "expectedUpdatedAt": "2026-10-10T20:00:00.000Z",
  "expectedSourceFingerprint": "observed-fingerprint",
  "expectedBottleId": 456,
  "reason": "The label image shows a different release."
}
```

```bash
pnpm cli api post /prices/match-queue/123/reopen --input /tmp/peated-request.json --yes
```

The listing loses its Bottle and returns to review. A `409` that names a saved
name means a Bottle reference would assign the same Bottle again; correct the
reference first. A Bottle made by `create-bottle` is not removed.
