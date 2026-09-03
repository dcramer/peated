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

## Review Clips

Adapters may pass tasting text keyed by the matching review source
key to the shared import. One shared function generates clips for all sources.
Only the returned clip is published. Model input is not recorded in logs or traces.

Missing text, disabled or missing model configuration, invalid output, and
request failures produce no new clip and do not block ingestion. A failed
refresh keeps the existing clip. Live clip checks run through `pnpm evals`.

## Extracted Tasting Tags

Review imports match existing tag names and synonyms against the scraper's
tasting text, or the full body when separate tasting text is missing. Matching
ignores case, accepts hyphenated phrases, and counts each tag once per review.
Longer phrases win: "dark chocolate" does not also add "chocolate". Shared
synonyms are skipped unless they match an exact tag name.

Simple negatives such as "no smoke" and "without vanilla" skip matches until
punctuation or a word such as "but". This is best effort: unusual wording,
comparisons to other bottles, and metaphors can be misread. Plurals need their
own synonyms. A missing match does not mean a flavor is absent.

Tags are saved in `review.tags` using the same array type as tastings and member
reviews. The review API returns them as `extractedTags`. They stay separate from
community tasting counts and Bottle flavor profiles. Matching makes no model
requests and works when clips are disabled.

Importing a review with text again replaces its tags, even when nothing matches.
Imports without text keep previous tags. Existing reviews gain tags on their
next import with text; the migration does not fill them in.

## Internal Review Bodies

Each scraped review saves its full plain-text body and fetch date in
`review_body`, linked by review ID, so we can run parsers again without fetching
the website. A new body replaces the previous one; missing text keeps the saved
body and its date. Deleting a review also deletes its body. Existing reviews get
bodies on their next import when text is available.

Scrapers select each bottle's full review, including its introduction and
conclusion. For configurable sources, the setup model selects this with
`reviewItem`; older rules that select only tasting notes may need updating.
Optional `reviewText` selects narrower text for tags and clips. Articles with
several reviews save each review's own section.

Scrapers remove HTML, scripts, forms, navigation, and comments, and keep paragraph
breaks. The saved body is not cut to the clip input limit; fetch limits still
apply. Only internal server and database work can read it. Review API responses
and previews exclude bodies, including for moderators. Bodies must stay out of
logs, errors, cursors, and production-content test snapshots.

Source setup can send size-limited public HTML and extracted bodies to its model
and trace, following [Sensitive Data](../policies/sensitive-data.md).

[Ratings](../architecture/ratings.md) defines when an external
score contributes to Bottle totals. The database schema and ingestion code own
the exact stored fields.

Use [External Review Sources](../operations/external-review-sources.md) to add,
publish, stop, or remove a source.
