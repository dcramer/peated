# External Review Indexing

Peated indexes external reviews to help readers find the publisher's full
article. Peated stores structured review facts. It does not republish the
article body, tasting notes, conclusion, or images.

This document owns review publishing, the adapter contract, source approval,
and rollback. The [scraper runtime](../../apps/server/src/scraper/README.md)
owns request control and run execution. The
[source research](../research/external-review-content-supply.md) records the
publisher robots rules and public terms that must be checked before enablement.

## Review Publishing

Every external review source starts unapproved. Scraping and Bottle matching
can run while a source is unapproved. Admins can inspect the collected names,
Bottle matches, writers, dates, and scores before they approve publication.

Approval publishes reviews that have an active Bottle match. It also publishes
future matches from that source. Unresolved, retired, and individually hidden
reviews stay hidden.

Stopping publication removes fetched reviews from public results. It does not
delete them or stop fetching. The update is moderator-only and audit logged.
Article ingestion and publication updates lock the same source row before they
decide visibility.

The scraper runtime still enforces target ownership, request limits, spacing,
quotas, cooldowns, and robots rules.

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

For a bounded current-review list, use the shared current-review lifecycle. It
removes stale cursor URLs, emits before checkpointing, and checkpoints an item
that the source parser explicitly identifies as a non-review. A malformed
review-shaped page must still fail without a checkpoint.

Read each publisher fact from the smallest element that owns it. Do not read a
container when it can include fallback markup, scripts, captions, or unrelated
metadata. Prefer structured date attributes and canonical URL components when
the publisher supplies them. Use the shared date parser after the adapter
extracts the publisher value and any fallback year.

The adapter emits one strict article observation with:

- review URL, title, optional issue, required publication date, and content
  hash;
- one or more Bottle review observations;
- a stable key, Bottle name, optional reviewer, optional native score, and
  exact source display text for each scored review.

Review keys must be unique within the article and stable across runs. Array
position is not a stable key. One article can own several reviews.

All review adapters emit `ExternalReviewArticleIngestionSchema` and use the
shared external-review sink. Do not translate a source-specific review shape
in the sink.

### Review source acceptance rules

Apply these rules to each review publisher. Shared runtime rules are tested
once in the scraper module. Each adapter test owns only publisher behavior.

1. Name the exact discovery page or feed and its maximum result count. Exclude
   archives, search, APIs, feeds, or pagination that are outside the source
   plan.
2. Set a request limit and target quota that allow discovery plus at least one
   article request. A normal run must complete or save cursor progress under
   those limits.
3. Test discovery with current publisher markup and unrelated links. The
   adapter must select only planned review URLs.
4. Test one normal article. Verify its canonical URL, title, publication date,
   writer, Bottle name, native score, and source display text.
5. Test every source shape that can contain several reviews. Include repeated
   Bottle names or writers when the publisher can show them. Review keys must
   stay stable and unique without using array position alone.
6. Use the shared date and rating parsers when they cover the publisher value.
   Test the publisher's short, full, decimal, or missing values. Do not make the
   shared observation schema accept invalid output.
7. Return `null` only for an item that is clearly not a review. A review-shaped
   page with missing required facts must throw and must not checkpoint.
8. Test resume behavior. A completed article must not be requested again while
   it remains in the current discovery window. A failed parse or sink call must
   remain eligible for replay.
9. Keep publisher prose transient. Parser setup can inspect the planned review
   section, but collection must not store it or send it to another service.
10. Before merge, run the registered source through the local scraper runtime
    against the current public pages. Inspect the terminal status, request
    count, emitted article and review counts, cursor, and observations. Replace
    only the sink with an in-memory collector when model or product writes are
    not part of the check.
11. After deployment, inspect the first run in Admin → Scrapers and Sentry. A
    successful parser test is not enough if the run defers without progress or
    fails after partial ingestion.

The production registry test requires every external site marked as review
content to use `ExternalReviewArticleIngestionSchema` and the shared
external-review sink.

The adapter does not access the database, select a Peated Bottle, decide public
visibility, call a model, or store records. The sink and external-review
ingestion boundary own those actions. Unresolved or invalid Bottle matches stay
hidden.

## Transient Publisher Content

Fetched HTML and publisher prose stay in process memory only. Do not put them
in article metadata, a cursor, checkpoint, log, error, database row, or test
snapshot.

Parser setup can use transient review text to prove that its selectors found
the review body. The collection sink discards that text and stores only the
structured article and review facts.

## Pilot Procedure

Use this sequence for each publisher:

1. Check the current robots rules and public terms for the planned paths and
   request pattern. Do not work around a block or rate limit.
2. Implement and fixture-test the adapter. Keep publication unapproved while
   the code is deployed.
3. Synchronize scraper definitions. In **Admin → Scrapers**, confirm that the
   source is registered, its targets are enabled, and its robots state is safe.
4. Trigger one bounded manual run or let the registered bounded schedule run.
   A schedule does not publish reviews from an unapproved source.
5. Record article, review, extracted-item, matched, and unresolved counts.
   Review the agreed hidden sample for extraction, multi-bottle splitting,
   Bottle matches, and native scores.
6. Require at least 90% extraction accuracy and acceptable Bottle-match
   precision. Record the result before you approve and publish the source.

WhiskyNotes runs once per day. It checks the current archive page and advances
at most four historical archive pages. Each page supplies at most 20 article
links. A new run continues from the last successful run cursor. When the
archive ends, later runs check only the current page. Requests are at least 2.5
seconds apart. The target allows 30 requests per hour, and each worker pass
stops after 30 requests. After this date fix, the scraper starts the archive
from the beginning once so it can correct dates already in Peated.

The Whisky Advocate pilot is also manual-only. It checks one magazine issue at
a time and reads the date from each review page. Later manual runs continue
with older issues. This corrects reviews that were saved without their original
date. Requests are at
least 2.5 seconds apart. Each worker pass has a 30-request budget, and the
target allows at most 20 requests per hour. The run checkpoints each stored
review and can resume for up to ten worker passes. The adapter keeps the
complete source Bottle title for classification and reads the category before
the separate price line. It does not persist review prose.

Whiskyfun runs once per day. It reads at most 20 current RSS items and skips
clear non-whisky articles before it requests article pages. It then advances
one historical archive page from its last successful cursor. The first history
run discovers the newest archive from the homepage. Each later page supplies
the next older link. Historical articles keep the publisher's daily date anchor
and date. When the archive ends, later runs check only the current feed.
Requests are at least 2.5 seconds apart. The target allows 25 requests per hour,
and each worker pass stops after 30 requests. The scraper saves dates, reviewer
names, scores, and review links. It does not save review text. After this date
fix, the scraper starts the old archive from the beginning once.

Dramface runs once per day. It reads at most 20 current links from the public
review index. It does not request Squarespace feeds, JSON views, APIs, search,
or author query pages. Requests are at least 2.5 seconds apart. The target
allows 25 requests per hour, and each worker pass stops after 30 requests. The
adapter splits multi-bottle and multi-writer articles into scored reviews. It
stores exact dates, published reviewer names, native scores, and canonical
links. Review prose stays transient, and Dramface's TL;DR text is excluded.

Words of Whisky runs once per day. It reads at most 20 current tasting-note
articles from the public homepage. It does not request the full tasting-notes
archive, RSS, WordPress APIs, search, or the load-more endpoint. Requests are
at least 2.5 seconds apart. The target allows 25 requests per hour, and each
worker pass stops after 25 requests. The adapter splits multi-bottle articles
into scored reviews. It stores exact timestamps, the published writer, native
scores, and canonical links. Tasting notes stay transient and are discarded
after parsing.

The Whiskey Reviewer runs once per day. It reads only the five links in the
public homepage Recent Reviews list. It does not request the alphabetical
archive, category pages, sitemaps, feeds, search, or WordPress APIs. Requests
are at least five seconds apart. The target allows 10 requests per hour, and
each worker pass stops after six requests. The adapter stores the writer,
canonical link, displayed letter grade, and required URL date. Tasting-note
paragraphs stay transient and are discarded after parsing.

Bourbon Culture runs once per day. It reads only the six links under Latest
Whiskey Reviews on the public homepage. It does not request archives, ratings
pages, sitemaps, feeds, search, or WordPress APIs. Requests are at least five
seconds apart. The target allows 10 requests per hour, and each worker pass
stops after seven requests. The adapter stores the writer, exact publication
timestamp, canonical link, and native 10-point score. Tasting-note paragraphs
stay transient and are discarded after parsing.

Fred Minnick runs once per day. It reads the public sitemap index and only the
newest two post sitemaps. It does not request the empty Reviews page, the main
news feed, older sitemaps, search, pagination, or WordPress APIs. It selects at
most five single-Bottle review URLs. Requests are at least 30 seconds apart.
The target allows 10 requests per hour, and each worker pass stops after eight
source requests plus the governed robots request when its cache is stale. The
adapter stores the explicit date, canonical link, and Fred
Minnick reviewer attribution. Native scores stay absent. Tasting paragraphs
stay transient and are discarded after parsing.

Whisky Saga runs once per day. It reads the 20 current article cards on the
public Scotland category page, then advances one public Older Posts page from
its last successful cursor. It follows only the publisher's Scotland category
links with `offset` and `category` parameters. It does not request the full
sitemap, search, other query filters, or Squarespace APIs. Requests are at
least 2.5 seconds apart. The target allows 25 requests per hour, and each worker
pass stops after 22 requests. The scraper saves the exact date and time, author,
review link, and 100-point score. It does not save review text. After this date
fix, the scraper starts the old pages from the beginning once.

The Whisky Study runs once per day. It reads only the 20 article cards on the
first public Scotch review index page. It does not request older pagination,
the sitemap, search, query filters, or Squarespace APIs. Requests are at least
2.5 seconds apart. The target allows 25 requests per hour, and each worker pass
stops after 21 source requests plus the governed robots request when its cache
is stale. The adapter stores the exact publication timestamp, author, canonical
link, and native 100-point score. Review text stays transient and is discarded
after parsing.

Approve publication only after the reviewed sample passes the gate.
Use the same source-specific process for each later publisher. Do not add a
generic crawler only because several sources use RSS or HTML.

## Stop And Roll Back

Stop review publishing first. Public fetched reviews disappear. Stored reviews
and scores remain available to admins. The change stays in the audit log and
does not block manual fetching.

To stop remote requests, disable the code-owned scraper target. Do not delete
review rows as the first response. Keep them hidden while the operator checks
the adapter, Bottle matches, and request behavior. Remove the adapter
registration in a follow-up deployment when the adapter itself is unsafe.

The article/review schema cutover is complete. Do not restore an application
version that reads the removed legacy review columns. Use an application
version that supports the current schema and use a forward migration for any
schema correction.
