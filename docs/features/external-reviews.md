# External Reviews

Peated stores facts about external whisky reviews and links readers to the
publisher's article. It can generate a short review clip, but does not republish
the article body, complete tasting notes, conclusion, or images.

## Active Critics

Peated presents the review site as the critic. A writer's name remains an
optional byline on that site's review; it is not a separate critic identity.

The Activity sidebar shows up to 5 active critics. Peated chooses the order.
It currently takes each site's newest public review linked to a Bottle that has
not been deleted, then orders the sites by publication date. Reviews do not
qualify when they are hidden, unpublished, missing a date, or missing a Bottle
match. Each site links to the original review used to place it.

## Publication

Every source starts unpublished. Collection and Bottle matching can run while
the source is unpublished so an administrator can review names, matches,
writers, dates, and scores.

Publishing a source makes its reviews public when they have an active Bottle
match. Unresolved, retired, and individually hidden reviews stay hidden. Later
matches from that source become public automatically.

Bottle matching first looks for an accepted Bottle Reference with the review's
name, then asks the Bottle classifier once. When the classifier finds no
Bottle, the review records that answer and is not sent to the classifier
again while its name stays the same. A later accepted reference for that name
still matches the review on its next import. A classifier failure records
no completed answer and fails the worker job, so a retry can ask again.

Automatic matches and creates must pass `assessBottleResolution`, the same
Bottle assessment as prices, auctions, and photos, before assigning a review or
creating a Bottle. A decision that needs review leaves the source unresolved
and keeps its saved proposal. Repairing an already assigned review uses the
same assessment; only a moderator's repair may replace the current Bottle.
Completed unresolved attempts, including ignored inputs, appear in the
Moderation Inbox. A moderator can read the saved evidence, assign an existing
Bottle, or request a new check. Reviews matched before runs were saved have no
saved decision, so the review page also lists catalog candidates for the
review's name from `GET /bottles/create-candidates`, which makes no model call. A missing Bottle can be added through the
catalog form before assignment. Assignment publishes a staged review only
when its source is approved; it never restores removed content.

`GET /external-reviews/{externalReview}/resolution` exposes the latest saved
decision to moderators. `POST /external-reviews/recheck` accepts at most 100
explicit reviews with the name and attempt timestamp observed by the caller.
A changed, assigned, removed, or never-completed review rejects the batch.
Rechecks preserve the last unresolved result and its Inbox task while work is
queued or running, including after dispatch or classifier failures. The worker
processes only the requested review version and checks it again before applying
a result. A moderator can still assign or remove the review during a recheck;
a stale result cannot overwrite that change. A completed unresolved answer
advances the attempt timestamp, and a successful assignment clears it.
Article and global batch runs queue one job per pending review. A failed review
does not block the remaining reviews in the batch.
Classifier failures reach the worker's error handler. Temporary provider outages
use the model queue's existing pause and retry handling; other errors fail the
job. Failed rechecks remain visible for manual resolution or rechecking and do
not depend on another scraper import to recover.

A review whose first match attempt failed has no completed answer, so it is not
in the Inbox and the recheck route rejects it. Scrapers do not read a finished
article again, so nothing else retries it. A moderator queues these reviews
with `POST /external-reviews/match-pending`, which takes up to 100 pending
reviews after `afterId`. Repeat with each returned `nextAfterId` until it is
null. Each queued review uses one classifier request, so check the first page's
results before queueing the rest.

Stopping publication hides its reviews without deleting them or stopping
collection. Only a moderator can change publication. Peated records the change
in the audit log.

An administrator can also remove one review from Peated. This manual removal
is independent from source publication and the review's `hidden` field. Later
imports, Bottle matching, publication approval, or visibility changes must not
restore it. Only an administrator restore action can clear the removal. See
[Content Moderation](content-moderation.md).

## Stored Facts

Peated stores the article URL, title, publication date, content hash, Bottle
match, reviewer, native score, and exact score text when supplied. An article
can contain several Bottle reviews. Use a source review ID when available. A
configured source otherwise uses the article URL and review position, so a
parser change must check that reordered reviews do not create duplicates.

## Review Clips

One shared function generates clips from saved review bodies for all sources.
Older scrapers that only return tasting text save and use that text instead.
Only the returned clip is published. Model input is not recorded in logs or
traces.

Missing text, disabled or missing model configuration, invalid output, and
request failures produce no new clip and do not block ingestion. A failed
refresh keeps the existing clip. Live clip checks run through `pnpm evals`.

Sources read their recent articles on every run. A review whose saved body is
unchanged keeps its clip without a model request. A changed body, or a review
that has no clip yet, asks for one. Each run records its clip requests as
`modelCallCount` in Admin → Scrapers.

## Extracted Tasting Tags

Review imports match existing tag names and synonyms against the saved review
body. Matching ignores case, accepts hyphenated phrases, and counts each tag
once per review.
Longer phrases win: "dark chocolate" does not also add "chocolate". Shared
synonyms are skipped unless they match an exact tag name.

Simple negatives such as "no smoke" and "without vanilla" skip matches until
punctuation or a word such as "but". This is best effort: unusual wording,
comparisons to other bottles, and metaphors can be misread. Plurals need their
own synonyms. A missing match does not mean a flavor is absent.

Tags are saved in `review.tags` using the same array type as tastings and member
reviews. The review API returns them as `extractedTags`. Published reviews feed
the same public Bottle, distillery, and region flavor summaries as public member
reviews and tastings. Matching makes no model requests and works when clips are
disabled.

Each review stores the version of the code that processed its body. When that
version changes, a worker updates its tags and clip from the saved body. Reviews
without a saved body update the next time a scraper imports their text.

## Internal Review Bodies

Each scraped review saves its full plain-text body and fetch date in
`review_body`, linked by review ID, so we can run parsers again without fetching
the website. A new body replaces the previous one; missing text keeps the saved
body and its date. Deleting a review also deletes its body. Existing reviews get
bodies on their next import when text is available.

When an admin starts a review scraper, it starts over if that site has reviews
without saved text. Long imports remember where they stopped while waiting.
Reviews that already have saved text are updated without fetching the website
again.

Scrapers select each bottle's full review, including its introduction and
conclusion. For configurable sources, `article.reviews` defines each full
review. Optional `tastingNotes` remains accepted for older rules when a full
review body is unavailable. Articles with several reviews save each review's
own section.

Scrapers remove HTML, scripts, forms, navigation, and comments, and keep paragraph
breaks. The saved body is not cut to the clip input limit; fetch limits still
apply. Only internal server and database work can read it. Review API responses
and previews exclude bodies, including for moderators. Bodies must stay out of
logs, errors, cursors, and production-content test snapshots. The administrator
review page follows the same rule: it shows the short clip and publisher link,
never the stored body.

Source setup can send size-limited public HTML and extracted bodies to its model
and trace, following [Sensitive Data](../policies/sensitive-data.md).

Each source can have a saved table that compares its scores with Peated scores.
Readers see the original score and whether it counts toward the Bottle score.
A moderator can leave scores out while continuing to publish the reviews.

[Ratings](../architecture/ratings.md) explains the comparison and when an
external score counts toward Bottle totals. The database schema and import code
own the exact stored fields.

Use [External Review Sources](../operations/external-review-sources.md) to add,
publish, stop, or remove a source.
