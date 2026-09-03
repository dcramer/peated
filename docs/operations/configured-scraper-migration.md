# Move an existing scraper to saved rules

Keep the existing site and record IDs when replacing a scraper with saved rules.
Prepare each site separately. These changes run only when an operator requests
them; deployment does not change existing records. Add new sites through
Admin → Scrapers.

Once a site has a saved source, it stops using its old scraper. Collection stays
stopped until the new rules pass preview and an admin enables them. Pausing the
new source also stops collection.

## Bourbon Culture

Use `POST /v1/admin/scrape-sources/prepare-bourbon-culture` with an authenticated
admin account. An empty JSON object checks the records without saving. Sending
`{"apply": true}` updates the keys used to recognize existing reviews and adds
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
   POST /v1/admin/scrape-sources/prepare-bourbon-culture
   Content-Type: application/json

   {}
   ```

   The response reports `siteId`, `reviewCount`, `applied: false`, and
   `scrapeSourceId: null`. It stops for unexpected
   URLs, missing or multiple reviews per article, unknown review keys, shared
   request settings, active runs, or an already prepared source. Investigate
   failures before continuing; do not remove checks to force it through.

5. Record approval for those records, then send the same request with:

   ```json
   { "apply": true }
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

## If something goes wrong

A request without `apply: true` leaves records unchanged. After applying, keep the
source paused while fixing its rules. Do not restart the old scraper against
the new review keys. Switching back needs a separate reviewed change that also
handles reviews added after the switch. Do not delete source or run history.

## Other sources

Prepare each source using its own rules for recognizing existing records.
Articles with several reviews need a verified match for each review. Store
prices must keep their product IDs, URLs, names after cleanup, bottle sizes, and
supporting facts so existing Bottle matches remain valid.
