# External Review Indexing

Peated indexes external reviews to help readers find the publisher's full
article. Peated stores structured review facts and an optional short summary.
It does not republish the article body, tasting notes, conclusion, or images.

This document owns the runtime source-policy boundary, adapter contract, pilot
procedure, and rollback path. The [scraper runtime](../../apps/server/src/scraper/README.md)
owns request control and run execution. The
[source research](../research/external-review-content-supply.md) records the
publisher robots rules and public terms that must be checked before enablement.

## Source Policy Boundary

Every external review source starts with its content capabilities disabled.
Missing policy has the same effect as disabled policy.

The source policy has these independent capabilities:

- `allowLlmProcessing` permits publisher text to enter the summary model.
- `allowScoreDisplay` permits display of the publisher's native score.
- `allowSummaryDisplay` permits display of a current Peated summary. This also
  requires `allowLlmProcessing`.
- `publicationMode` controls public review availability.

The runtime checks source policy at each owning boundary:

| Operation                             | Owning check                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Send review text to a model           | Summary generation checks `allowLlmProcessing` immediately before model access. |
| Return a native score or summary      | The review serializer checks the matching display capability.                   |
| Return a fetched review to the public | The review must be visible and the source must use `automatic` mode.            |

The moderator policy API accepts `disabled`, `review_only`, and `automatic`.
The policy update is moderator-only and audit logged. A transition to
`automatic` publishes staged reviews only when they have an active resolved
Bottle. Unresolved and retired Bottle assignments remain hidden.

Article ingestion and policy updates serialize on the source record. A refresh
can publish a review when it gains its first active Bottle assignment. A refresh
does not make an already matched review visible after a moderator hides it.

Source policy does not control fetching. An admin can manually run a registered
scraper when its targets are enabled. The scraper runtime still enforces target
ownership, request limits, spacing, quotas, cooldowns, and robots rules.

## Source Adapter Contract

Add a publisher adapter only after checking its current robots rules and public
terms for the planned requests.

A review adapter must:

1. Register one source and its exact remote targets in the scraper registry.
2. Declare each allowed origin, robots mode, request limit, cursor schema, and
   observation schema.
3. Use only the injected scraper session for requests, observations, and
   checkpoints.
4. Emit a stable source key. Replay after a lost checkpoint must update the
   same source item.
5. Checkpoint only after the emitted work is safely stored.
6. Use deterministic parser fixtures for discovery, extraction, pagination,
   and multi-bottle articles.

The adapter emits one strict article observation with:

- canonical URL, title, optional issue, optional publication date, and content
  hash;
- one or more Bottle review observations;
- a stable key, Bottle name, optional reviewer, optional native score, and
  optional normalized compatibility rating for each review.

Review keys must be unique within the article and stable across runs. Array
position is not a stable key. One article can own several reviews.

All review adapters emit `ReviewArticleIngestionSchema` and use the shared
review sink. Do not translate a source-specific review shape in the sink.

The adapter does not access the database, select a Peated Bottle, decide public
visibility, call a model, or store records. The sink and external-review
ingestion boundary own those actions. Unresolved or invalid Bottle matches stay
hidden.

## Transient Publisher Content

Fetched HTML and publisher prose stay in process memory only. Do not put them
in article metadata, a cursor, checkpoint, log, error, database row, or test
snapshot.

If an enabled source supplies text for summary generation, keep it separate
from the strict article metadata. A source-specific in-memory observation can
carry only the text needed by its sink. The sink passes that text directly to
the ingestion boundary as `reviewTexts`, keyed by the review source key. The
scraper runtime does not persist observations.

The summary boundary sends the text to the model only when
`allowLlmProcessing` is active. It uses provider storage disabled. It returns
a validated two- or three-sentence summary with a content hash, model, prompt
version, and generation time.

Summary failure does not discard valid review metadata. An article content
change makes the old summary unavailable until regeneration succeeds. Errors
contain stable identifiers and the canonical URL, not publisher prose.

## Pilot Procedure

Use this sequence for each publisher:

1. Check the current robots rules and public terms for the planned paths and
   request pattern. Do not work around a block or rate limit.
2. Implement and fixture-test the adapter. Keep its source policy disabled
   while the code is deployed.
3. Synchronize scraper definitions. In **Admin → Scrapers**, confirm that the
   source is registered, its targets are enabled, and its robots state is safe.
4. Use the moderator review-policy API to set `review_only` with the exact
   capability flags when a hidden sample is needed.
5. Trigger one bounded manual run or let the registered bounded schedule run.
   A schedule does not bypass source policy or publish hidden reviews.
6. Record article, review, extracted-item, matched, and unresolved counts.
   Review the agreed hidden sample for extraction, multi-bottle splitting,
   Bottle matches, and any enabled summaries.
7. Require at least 90% extraction accuracy and acceptable Bottle-match
   precision. Record the result before setting the source to `automatic`.

The WhiskyNotes pilot is manual-only. It checks at most five archive pages and
20 article links on each page. Requests are at least 2.5 seconds apart. The
target allows 30 requests per hour. Each worker pass stops after 30 requests.

The Whisky Advocate pilot is also manual-only. It requests the issue index, the
newest issue, and each listed review page to collect its explicit publication
date. Requests are at least 2.5 seconds apart. Each worker pass has a 30-request
budget, and the target allows at most 20 requests per hour. The run checkpoints
each stored review and can resume for up to ten worker passes. The adapter keeps
the complete source Bottle title for classification and reads the category
before the separate price line. It does not persist review prose.

Whiskyfun runs once per day. It reads at most 20 current RSS items and skips
clear non-whisky articles before it requests article pages. Requests are at
least 2.5 seconds apart. The target allows 25 requests per hour, and each worker
pass stops after 30 requests. The adapter stores explicit feed dates, reviewer
metadata, native scores, and canonical links. Review prose stays transient.

Enable automatic publication only after the reviewed sample passes the gate.
Use the same source-specific process for each later publisher. Do not add a
generic crawler only because several sources use RSS or HTML.

## Stop And Roll Back

Set the source policy to `disabled` first. This clears content-processing and
display capabilities. Public fetched reviews disappear, and native scores and
summaries are no longer returned. The policy change stays in the audit log.
It does not block manual fetching.

To stop remote requests, disable the code-owned scraper target. Do not delete
review rows as the first response. Keep them hidden while the operator checks
the adapter, Bottle matches, and request behavior. Remove the adapter
registration in a follow-up deployment when the adapter itself is unsafe.

The article/review schema cutover is complete. Do not restore an application
version that reads the removed legacy review columns. Use an application
version that supports the current schema and use a forward migration for any
schema correction. Never reconstruct publisher facts from generated summaries.
