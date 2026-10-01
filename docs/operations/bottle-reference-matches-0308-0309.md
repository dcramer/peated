# Reference match history rollout

Migrations `0308` and `0309` record reference dependencies for prices and
reviews, allow later decisions for one source item, and index dependent matches.
They do not rewrite Bottle IDs or infer dependencies for old records.

## Deploy

Pause matching and reference writes during this deployment. Migration `0308`
removes the unique source index used by the old decision writer's conflict
target. That old writer is not compatible with the migrated database.

1. Stop the old worker and prevent API writes that match prices, reviews, or
   auction lots or correct references. Public reads can remain available.
2. Apply both generated migrations through the normal deployment process.
3. Deploy the API and worker from this change before resuming those writes.
4. Verify a reference-derived match, an independent manual match, a correction,
   and the later reassignment in moderation history. Repeating a completed
   assignment must not add another decision.

## Previously cleared prices

An approved proposal whose price is already unassigned can be reopened through
`POST /prices/match-queue/{proposal}/reopen`. Read its details first and submit
the observed `updatedAt` and `price.sourceFingerprint`. Use the authenticated
API client. The route returns the item to manual review; it does not run a
classifier or restore the old match. Review source evidence before resolving it.

Do not backfill `matchedReferenceId` by matching names. A legacy manual decision
may have the same name and Bottle ID as a reference-derived match.

## Rollback

Do not restart the previous API or worker against these migrations. Its decision
writer still requires the removed unique index. Keep this schema and use a
compatible application rollback, or use the approved database restore process.
Do not recreate the old unique index after later decisions have been saved;
doing so would require deleting history.
