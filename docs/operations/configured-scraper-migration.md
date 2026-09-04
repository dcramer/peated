# Move an existing scraper to saved rules

Keep the existing site and record IDs when replacing a scraper with saved rules.
Prepare each site separately. These changes run only when an operator requests
them; deployment does not change existing records. Add new sites through
Admin → Scrapers.

Once a site has a saved source, it stops using its old scraper. Collection stays
stopped until the new rules pass preview and an admin enables them. Pausing the
new source also stops collection.

## Bourbon Culture

Use `POST /v1/admin/scrape-sources/prepare` with an authenticated admin account
and `{"site": "bourbonculture"}` to check records without saving. Adding
`"apply": true` updates the keys used to recognize existing reviews and adds
a paused source without rules. All changes succeed together or none are saved.

The operation keeps site, article, and review IDs, Bottle matches, hidden flags,
scores, publication approval, text, tags, clips, and run history. It also keeps
the current request limits and any wait already in progress. It makes no
requests to the publisher or AI service. The checks live in
[prepareBourbonCulture.ts](../../apps/server/src/scraper/configured/prepareBourbonCulture.ts).

1. Deploy the support to every API and worker process. Keep the old scraper code
   until the new rules have been checked.
2. Save the article URLs, review IDs, keys, Bottle matches, visibility, scores,
   and publication settings. Record review and stored-text counts and the current
   schedule. Do not copy publisher text into logs or approval notes.
3. Turn off the schedule through
   `PUT /v1/admin/external-sites/bourbonculture/schedule` with
   `{"schedule": {"runEvery": null}}`. Wait for queued and running work to finish.
   Avoid other edits to this site during the move.
4. Send this request to the intended API environment. Production uses
   `https://api.peated.com`:

   ```http
   POST /v1/admin/scrape-sources/prepare
   Content-Type: application/json

   {"site": "bourbonculture"}
   ```

   The response reports `siteId`, `reviewCount`, `applied: false`, and
   `scrapeSourceId: null`. It stops for unexpected
   URLs, missing or multiple reviews per article, unknown review keys, shared
   request settings, active runs, or an already prepared source. Investigate
   failures before continuing; do not remove checks to force it through.

5. Record approval for those records, then send the same request with:

   ```json
   { "site": "bourbonculture", "apply": true }
   ```

   The response includes the new `scrapeSourceId` and `applied: true`. The source
   records the authenticated admin as its creator. Repeating this request returns
   a conflict without changing records again.
   Compare the records with step 2. Each review must keep its ID and facts. Its
   key becomes its article URL followed by `#review-1`. Counts and related
   records must be unchanged. Save the response with the approval notes.

6. Request suggested rules with
   `POST /v1/admin/scrape-sources/{id}/suggest`, using the returned source ID.
   Save edited rules through `POST /v1/admin/scrape-sources/{id}/revisions`.
   Run a preview through
   `POST /v1/admin/scrape-sources/{id}/revisions/{revisionId}/preview` and compare
   the results with the old scraper. Keep the existing
   limit of six latest articles and one review per article. Article URLs must
   stay the same, including any ending `/`. Check names, writers, dates, scores
   as published, and the selected review text. The old scraper removes `Review`
   from the end of names; preparing the source does not add that behavior to
   the new rules.
7. Enable only rules that passed preview and review, through
   `POST /v1/admin/scrape-sources/{id}/revisions/{revisionId}/activate`.
   Run collection once through
   `POST /v1/external-sites/bourbonculture/trigger`.
   Check that it updates existing review IDs without adding duplicate
   articles or reviews. Check Bottle matches and errors in Sentry. Restore the
   saved schedule after these checks pass.

Publication settings stay the same. Follow
[External Review Sources](external-review-sources.md) for publication decisions
and current publisher access checks.

## The Whisky Study

Use the same process for The Whisky Study with `{"site": "whiskystudy"}`.
The check-only request verifies that every stored article uses the expected
`https://thewhiskystudy.com/reviews-3/...` URL without a trailing slash, has
exactly one review, and still has the key written by the code scraper. Applying
the preparation changes those review keys in place and adds a paused source
whose list page is `https://thewhiskystudy.com/reviews-3`.

Before applying, save the same records and stop the `whiskystudy` schedule as
described above. Compare all stored records after applying. Keep the existing
limit of 20 latest articles and one review per article when checking suggested
rules. Verify each article URL, name, writer, date, score, selected review text,
Bottle match, hidden state, and publication setting. The old scraper removes
`Review` or `Shelf Review` from the end of Bottle names; version 1 rules cannot
do that cleanup. Use version 2 literal suffix cleanup and confirm the names
remain unchanged before activation.

Preview and activate the chosen revision, run one manual collection through
`POST /v1/external-sites/whiskystudy/trigger`, and confirm that it updates the
same review IDs recorded before applying without adding duplicate articles or
reviews. Check the run and Sentry before restoring the saved schedule.
Preparation must not change the source's publication setting.

## The Whiskey Reviewer

Use the preparation endpoint with `{"site": "whiskeyreviewer"}`. The check-only
request verifies that each stored article has one review, uses the expected
dated Whiskey Reviewer URL without a trailing slash, and still has the key
written by the code scraper. Applying changes those review keys in place and
adds a paused source whose list page is `https://whiskeyreviewer.com/`.

Before applying, save the same review and run records and stop the
`whiskeyreviewer` schedule. Version 3 rules must select only the five links in
the Recent Reviews widget. They must read and remove the ending slash from the
canonical link, derive the publication date from the dated URL, remove `Review`
or the publisher's known `Rview` typo from the Bottle name, and map every
publisher letter grade from A+ through F to its existing 100-point value. Run a
full local no-write preview and compare all five current names, writers, dates,
grade displays, selected tasting evidence, and review bodies with the code
scraper.

After applying, save and preview the reviewed version 3 revision. Activate only
exact output, trigger one manual collection, and confirm that it updates the
same article and review IDs without adding trailing-slash duplicates. Check
Bottle matches, the run, and Sentry before restoring the saved schedule.

## Words of Whisky

Use the preparation endpoint with `{"site": "wordsofwhisky"}`. The check-only
request locks and verifies every stored article and review. It accepts only the
publisher's canonical article URLs without a trailing slash, requires at least
one review per article, and verifies each legacy review key from its stored
article URL, Bottle name, and writer. Applying changes only those keys to the
version 4 positional form and adds a paused source whose list page is
`https://wordsofwhisky.com/`.

Before applying, save article URLs, review IDs and order, Bottle matches,
visibility, scores, writers, publication settings, stored-body counts, and the
current schedule. Stop the schedule and wait for active runs. Compare every
record after applying; multi-Bottle articles must keep the same review order
and IDs.

Version 4 rules must select only tasting-note articles from the homepage. On
detail pages, use each direct `h2` Bottle heading to start a sibling review
section. Select the canonical URL without its trailing slash, exact publication
time, writer, Bottle name, tasting paragraphs, and score out of 10. Run the
rules through a full local no-write preview and compare single- and multi-Bottle
articles with the code parser before applying.

Activate only a production preview with exact output. Trigger one manual
collection and confirm it updates the same review IDs without adding articles
or reviews. Check Bottle matches, review bodies, the run, and Sentry before
restoring the saved daily schedule. Preparation must not change publication.

## Compass Box

Use the same preparation endpoint with `{"site": "compassbox"}`. The check-only
request locks and inventories every stored price without changing it. It reports
the total, visible, and Bottle-matched price counts. It stops if a price has an
unexpected product URL, external product ID, name prefix, currency, or volume.
Applying transfers the existing request settings to administrator ownership and
adds a paused price source whose list page is
`https://www.compassboxwhisky.com/collections`. It does not update price rows or
history.

Before applying, stop the `compassbox` schedule and wait for active runs. Save
the price IDs, product URLs, names, prices, currencies, volumes, image URLs,
Bottle matches, hidden states, histories, request limits, and run history. Run
the version 2 rules through the local no-write preview without an item limit.
The current catalog must match the code scraper, including excluding sold-out
cards.

After applying, save the reviewed version 2 revision and run its production
preview. Activate only exact output, trigger one manual collection, and confirm
that it updates the same price IDs and Bottle matches. Check the run and Sentry
before restoring the saved schedule.

## Kilchoman

Use the preparation endpoint with `{"site": "kilchoman"}`. The check-only
request locks and inventories every stored price without changing it. It reports
the total, visible, and Bottle-matched price counts. It stops if a price does not
use the expected Kilchoman product URL, null external product ID, `Kilchoman`
name prefix, GBP currency, or 700 ml volume. Applying transfers the existing
request settings to administrator ownership and adds a paused price source whose
list page is `https://www.kilchomandistillery.com/whisky-shop/`. It does not
update price rows or history.

Before applying, stop the `kilchoman` schedule and wait for active runs. Save
the same price and run records listed for Compass Box. Run the version 2 rules
through the local no-write preview without an item limit. Compare every current
product with the code scraper. The list rules must omit sold-out products and
gift packs; the detail rules must keep the `Kilchoman` name prefix, GBP price,
700 ml volume, canonical product URL, and product image.

After applying, save the reviewed version 2 revision and run its production
preview. Activate only exact output, trigger one manual collection, and confirm
that it updates the same price IDs and Bottle matches. Check the run and Sentry
before restoring the saved schedule.

## If something goes wrong

A request without `apply: true` leaves records unchanged. After applying, keep the
source paused while fixing its rules. Do not restart the old scraper against
the new review keys. Switching back needs a separate reviewed change that also
handles reviews added after the switch. Do not delete source or run history.

## Other sources

The preparation API is shared. It currently supports Bourbon Culture, Compass
Box, Kilchoman, The Whiskey Reviewer, Whisky Saga, The Whisky Study, and Words
of Whisky. Other sites are rejected without changing records. Add each site's
conversion behind this route as its existing records are reviewed.

Prepare each source using its own rules for recognizing existing records.
Articles with several reviews need a verified match for each review. Store
prices must keep their product IDs, URLs, names after cleanup, bottle sizes, and
supporting facts so existing Bottle matches remain valid.
