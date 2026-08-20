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

Every external review source starts disabled. Missing policy has the same
effect as disabled policy. Robots rules can restrict a request, but they never
enable a capability.

The source policy has these independent capabilities:

- `allowFetching` permits public-page requests.
- `allowLlmProcessing` permits publisher text to enter the summary model.
- `allowScoreDisplay` permits display of the publisher's native score.
- `allowSummaryDisplay` permits display of a current Peated summary. This also
  requires `allowLlmProcessing`.
- `publicationMode` controls public review availability.

The runtime checks source policy at each owning boundary:

| Operation                              | Owning check                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Queue a manual or scheduled review run | The scraper lifecycle requires `allowFetching`.                                 |
| Make each remote request               | The scraper session checks `allowFetching` again, then checks robots rules.     |
| Send review text to a model            | Summary generation checks `allowLlmProcessing` immediately before model access. |
| Return a native score or summary       | The review serializer checks the matching display capability.                   |
| Return a fetched review to the public  | The review must be visible and the source must use `automatic` mode.            |

The moderator policy API accepts `disabled`, `review_only`, and `automatic`.
The policy update is moderator-only and audit logged. A transition to
`automatic` publishes staged reviews only when they have an active resolved
Bottle. Unresolved and retired Bottle assignments remain hidden.

Article ingestion and policy updates serialize on the source record. A refresh
can publish a review when it gains its first active Bottle assignment. A refresh
does not make an already matched review visible after a moderator hides it.

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
   capability flags.
5. Trigger one bounded manual run from the source page. Do not enable a
   schedule for the first sample.
6. Record article, review, extracted-item, matched, and unresolved counts.
   Review the agreed hidden sample for extraction, multi-bottle splitting,
   Bottle matches, and any enabled summaries.
7. Require at least 90% extraction accuracy and acceptable Bottle-match
   precision. Record the result before setting the source to `automatic`.

The WhiskyNotes pilot is manual-only. It checks at most five archive pages and
20 article links on each page. Requests are at least 2.5 seconds apart. The
target allows 30 requests per hour. Each worker pass stops after 30 requests.

Enable automatic publication only after the reviewed sample passes the gate.
Repeat the robots, terms, and review-only process for the second publisher
before adding shared adapter behavior.

## Stop And Roll Back

Set the source policy to `disabled` first. This clears all capabilities. It
blocks new runs and the next request in an active run. A request already in
flight can finish. Public fetched reviews disappear, and native scores and
summaries are no longer returned. The policy change stays in the audit log.

Do not delete review rows as the first response. Keep them hidden while the
operator checks the adapter, Bottle matches, and request behavior. Disable the
code-owned target or remove the adapter registration in a follow-up deployment
when the adapter itself is unsafe.

The article/review schema cutover is complete. Do not restore an application
version that reads the removed legacy review columns. Use an application
version that supports the current schema and use a forward migration for any
schema correction. Never reconstruct publisher facts from generated summaries.
