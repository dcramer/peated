## Context

The legacy Whisky Advocate importer stored the publisher's whole-number
100-point score in `review.rating`. The article-model migration retained that
column as `legacyNormalizedScore` but left the new native-score triplet empty.
Current serializers and summary calculations intentionally ignore the legacy
column. New Whisky Advocate imports already store native scores correctly.

Production currently has 7,152 Whisky Advocate reviews, including 4,958 Bottle
matches. The repair must use the authenticated API rather than a database-backed
CLI command, preserve every review and Bottle relationship, and avoid source
requests.

## Goals / Non-Goals

**Goals:**

- Restore the publisher score for every eligible legacy Whisky Advocate review.
- Make the operation administrator-only, idempotent, source-scoped, and safe to
  retry.
- Preserve current native scores and every unrelated review field.
- Refresh saved Bottle and BottleGroup summaries for affected Bottle matches.
- Record the repair result in structured audit output.

**Non-Goals:**

- Add a preview or administrator interface.
- Fetch or enrich Whisky Advocate articles.
- Approve publication or schedule the Whisky Advocate scraper.
- Convert scores for any other review source.
- Remove the legacy rating column.

## Decisions

### Use a protected one-time API operation

Add an administrator-only POST operation under the Whisky Advocate external
site. The operation performs the repair immediately and returns changed,
unchanged, skipped, affected-Bottle, and queued-update counts. This follows the
supported production API boundary and avoids adding a legacy database CLI
command.

A generated schema migration is not appropriate because the schema does not
change, and Peated does not hand-write data migrations. A read-time fallback was
rejected because database correctness forbids silently repairing saved data
during normal reads and it would keep two score representations indefinitely.

### Restore only complete, known source facts

The transaction resolves Whisky Advocate by its stored site type and locks that
site row against concurrent ingestion. It updates only reviews owned by that
site whose legacy score is an integer from 1 through 100 and whose entire
native-score triplet is null. It sets the native value to the legacy value, the
scale to 100, and the display value to `<score>/100`.

Rows with any current native score remain unchanged. Missing, zero, or invalid
legacy values remain unknown and are counted in the response. The operation
does not change article metadata, visibility, names, Bottle matches, or the
legacy score.

### Refresh affected summaries after commit

Collect distinct non-null Bottle IDs from changed reviews. After the repair
transaction commits, queue the existing Bottle summary update for each distinct
Bottle in bounded batches. `queuedBottleUpdates` reports the number handed to
the shared dispatcher, which logs individual queue failures. A repeat call
changes no scores but retries summary updates for every eligible repaired
Whisky Advocate review, so operators can recover from a queue outage.

### Audit the bounded repair

Add a dedicated external-review score-repair audit event containing the stable
site type and aggregate result counts. Do not include review names, URLs, source
text, or user data.

## Risks / Trade-offs

- **Legacy values might not represent the source scale** → Restrict the repair
  to Whisky Advocate, whose old importer parsed the publisher's 1–100 score and
  stored it unchanged.
- **A current import could race the repair** → Take an update lock on the
  source row; current ingestion takes a shared source lock before storing.
- **Summary job dispatch can partially fail** → Use the shared logged
  dispatcher and allow an idempotent repeat call to queue affected Bottles
  again.
- **Restored scores affect Bottle totals** → This is existing scoring
  behavior: a public, matched, whole-number native score out of 100 counts when
  the source has no explicit scoring policy.

## Migration Plan

1. Deploy the protected operation and tests.
2. Call it once through `pnpm cli api post` against production.
3. Re-fetch review 1151 and Bottle 13170, then check aggregate repair and saved
   summary counts.
4. Retry the idempotent operation only if Bottle summary jobs failed to queue.
5. Remove the temporary route after production verification; retain the audit
   event, durable documentation, native scores, and legacy evidence.

Rollback does not clear scores automatically. The preserved legacy value and
the source-scoped audit counts identify the repaired population, but any rollback
must avoid deleting native scores later refreshed by the source.

## Open Questions

None.
