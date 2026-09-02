# External Reviews

Peated stores facts about external whisky reviews and links readers to the
publisher's article. It can generate a short review clip, but does not republish
the article body, complete tasting notes, conclusion, or images.

## Publication

Every source starts unpublished. Collection and Bottle matching can run while
the source is unpublished so an administrator can review names, matches,
writers, dates, and scores.

Publishing a source makes its reviews public when they have an active Bottle
match. Unresolved, retired, and individually hidden reviews stay hidden. Later
matches from that source become public automatically.

Stopping publication hides its reviews without deleting them or stopping
collection. Only a moderator can change publication. Peated records the change
in the audit log.

## Stored Facts

Peated stores the article URL, title, publication date, content hash, Bottle
match, reviewer, native score, and exact score text when supplied. An article
can contain several Bottle reviews. Use a source review ID when available. A
configured source otherwise uses the article URL and review position, so a
parser change must check that reordered reviews do not create duplicates.

Normal review ingestion does not save fetched HTML or publisher prose in the
database, cursors, logs, errors, or test snapshots. Configured-source setup can
send bounded public HTML to its setup model and trace under the rules in
[Sensitive Data](../policies/sensitive-data.md).

## Review Clips

Adapters may pass temporary review text keyed by the matching review source
key to the shared import. One shared function generates clips for all sources.
Only the returned clip is stored; complete review text stays temporary and is
not recorded in logs or traces.

Missing text, disabled or missing model configuration, invalid output, and
request failures produce no new clip and do not block ingestion. A failed
refresh keeps the existing clip. Live clip checks run through `pnpm evals`.

[Ratings](../architecture/ratings.md) defines when an external
score contributes to Bottle totals. The database schema and ingestion code own
the exact stored fields.

Use [External Review Sources](../operations/external-review-sources.md) to add,
publish, stop, or remove a source.
