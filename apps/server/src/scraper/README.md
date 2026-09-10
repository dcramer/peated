# Scraper Runtime

This module controls Peated's scraper requests and saved progress. It keeps four
jobs separate:

- definitions list which websites each source may request;
- runs limit work and save enough progress to resume;
- coordination spaces requests and enforces limits;
- HTTP rejects non-public destinations and retries temporary failures;
- adapters read responses and pass results through the current run.

Code outside this module uses `index.ts` to initialize, queue, or execute a run.
It must not call adapters, request controls, robots checks, or scraper HTTP code
directly. The files are split by responsibility:

- `lifecycle.ts` creates runs and sends them to the worker queue;
- `runs.ts`, `session.ts`, `http.ts`, `networkPolicy.ts`, `robots.ts`, and
  `coordinator.ts` own core execution without importing production registry or
  worker infrastructure;
- `runTimeout.ts` keeps the database and queue timeouts together. It also says
  how often a worker extends the database timeout during slow work such as AI
  setup;
- `registry.ts` lists the built-in sources and request settings;
- `adapters/legacy/` contains migrated source implementations that still use
  the old helpers in `legacy/`;
- newer adapters use only the current run passed to them;
- `adapters/dates.ts` parses common publisher date formats;
- `adapters/currentReviews.ts` shares the common steps for reading current
  reviews and saving progress;
- `sinks/` saves parsed results.

Registered source implementations must not import raw HTTP, queue, database,
or product-saving clients. Tests check every source listed in the production
registry, including sources in subfolders.

External review sources must also follow the
[external review source procedure](../../../../docs/operations/external-review-sources.md).
It covers review publishing, source approval, and rollback.

## Registering a source

1. Define a target in `registry.ts`. A target groups sources that must share a
   request pace. List every website address it may use and either enforce
   robots.txt or record why robots.txt does not apply.
2. Define the source with its external-site key, allowed targets, schemas for
   saved progress and parsed results, adapter, and save function.
3. Make the adapter use only its current run. After saving a page, save the
   place where the next run should continue. Repeating the prior page must be
   safe.
4. Give every parsed result a stable source key. Saving the same result again
   must not create a duplicate if a worker stops between saving the result and
   saving its place.
5. Synchronize definitions before accepting scraper work. Production dispatch
   has one entry point: the `RunScraper` job with a run id.

Existing retailer sources may use `legacy/scraper.ts` only from
`adapters/legacy/`. It connects their old helper calls to the current run; new
sources must not use it. When converting an old source, remove those helpers
and move the source out of `adapters/legacy/`.

Give sources the same target only when the same organization runs them and they
must share one request pace. A target may list several web addresses when that
organization uses more than one host. Do not group sites from their domain
names alone.

Set `requestsPerHour` for each target. Requests are spread evenly across the
hour: 120 means one request every 30 seconds. A value above 120 needs a short
reason.

## Scrape sources

Admins can add a review or store-price source in Admin → Scrapers. These
sources use the same runs, requests, robots.txt checks, limits, retries,
validation, and saving code as built-in sources.

To replace an existing scraper, follow
[Move an existing scraper to saved rules](../../../../docs/operations/configured-scraper-migration.md).
Keep the existing site and record IDs when switching to the new rules.

The database stores each source and its rules. A saved version cannot be edited.
Testing runs the collection crawler without importing records. Its saved preview
contains extracted fields and errors, not downloaded HTML or review text. The
agent tests during setup; an admin can also test a saved version again. Only a
version that passed testing can be used. An admin can return to any older
version that passed. Pausing a source fails queued collection runs and stops
active work at the next request, save, or checkpoint. Saved versions and run
history stay. Rule testing and AI setup still work.

Before saving a preview or AI version, code checks that the worker still owns
the run. The check and save happen together. If another worker has taken over,
the old worker cannot overwrite the preview or add another version.

Older rule versions remain supported so saved sources keep working. New
sources use version 11. Most rule fields are CSS selectors supported by Cheerio,
including relational selectors such as `:has()`. `list.links` finds article or
product links. `list.nextPage` can find the next page of links. Links must
stay on the source website. Code reads at most five list pages and stops at
`list.limit`. It reads `href` from HTML links and text from XML links.

Each stored rule version has a decoder in `configured/compatibility/`. The
decoder validates the saved JSON and returns the executable contract used by
the runtime. Historical meaning, including review source keys, belongs to that
version's decoder instead of being inferred from the JSON shape. Current rule
generation uses the current schema directly. Source-specific URL behavior is
registered in `configured/sourceCompatibility.ts`; generic parsing must not
identify a source by name or host.

Move a source to the current rule format by creating a new revision, previewing
it, and activating it. Never change a saved revision's version or rules in
place: completed runs keep their revision ID. Remove a compatibility decoder
only after production has no active or runnable revisions that use it.

Fields on an article or product page are CSS selectors too. Code reads text by
default. It reads `href` from links, `src` from images, `datetime` from dates,
`content` from meta tags, and `value` from form fields. It also trims spaces,
makes full URLs, and reads prices, scores, dates, volumes, strength, ages, and
release years. A selector may match a short group of facts; code finds values
beside familiar labels such as `70cl`, `46% ABV`, `10 Year Old`, and `91 points`.
A price source can use a number of milliliters as a fixed volume. Rules do not
contain general cleanup steps. Put unusual cleanup for one source in a small
named function.

For reviews, `detail.reviews.area` selects the one area containing the review
text. Set `item` to the HTML element around each review. When reviews have no
separate elements, set `item` to null; each match of `name` starts a review.
When an article has one review and its title is the Bottle name, set `name` to
null. When fixed text surrounds that name, use a match such as
`{"selector": null, "match": "Review of {value}"}`. Code uses the article title
and removes a trailing `review` by default. A review's
writer may be inside that review or shared by the article. Scores and tasting
notes are read inside each review. For a score, `outOf` is the highest possible
score.

Code uses a review's Bottle name and writer to keep it matched when other
reviews are added or moved. Repeated reviews with the same name and writer stay
separate. This is automatic and is not part of the saved rules.

Setup saves exactly the rules it checks. Rules do not support scripts, custom
code, request headers, browser automation, numbered page patterns, endless
scrolling, or links to another website. Write source-specific code when a
source needs one of those features.

Adding a source starts AI setup. The server reads the main page, up to four
likely list pages on the same website, and any optional example review or
product pages. The agent can use `read_page` to inspect more pages on the same
website. It submits v11 rules to `test_rules`, which runs the collection crawler
without importing anything. Ordinary setup tests sample at most 20 detail pages;
repair tests use the full collection limit so they can reach the failing page.
Code preserves the active rules' collection limit, or uses 99 for new or unreadable
rules. The agent cannot change that limit to make a test cheaper or easier to pass.
The tool returns extracted examples, visited pages, and any errors. The agent
inspects successful results too: valid fields do not guarantee the right content.
`finish` saves exactly the last passing rules and their test results. An admin
turns on versions requested through setup; no separate preview is required.
An admin can request a fresh setup regardless of the saved rules' version or
test status.
The active rules stay in place until the replacement is tested and activated.

Setup keeps old rules and previous matches as context even when their saved
format cannot be decoded. Only executable old rules can enforce the same list
filters; their replacements still have to pass the collection test.

Each setup or repair run allows three rule tests, four page reads, and eight
model calls total. The saved conversation, pending tool, crawl progress, and
model count survive worker restarts. An HTTP wait resumes the pending test
without another model call. When a run succeeds, fails, or reaches its execution
limits, code discards its temporary setup conversation and crawl. Cost counts
and repair history stay. Final rule errors are saved with the run and shown
in Admin. Problems with the AI service, database, job runner, or network remain
system errors. The AI service does not store request content.

A collection failure caused by broken rules marks the active version failed,
which stops further collection. The source gets one automatic repair attempt.
The agent receives the failing page, errors, saved rules, and previous matches.
Its test must reach the failing page; dropping it from the crawl is not a repair.
Passing repair rules activate automatically unless an admin paused the source
or changed its active version. Network failures do not start repairs.

If repair fails, or its replacement rules fail collection, collection stays
stopped for admin review. Run history allows another automatic repair only after
a complete successful collection—not after time passes, a preview passes, or a
new version is saved. An admin can still request another suggestion.

Before shortening pages for AI, setup removes scripts and styles from its copy.
This keeps links and article content from being cut off. Rule checks and
collection still read the full downloaded HTML.

For reviews, each selected review is the full body saved internally and used for
tags and clips. Older rules can use `tastingNotes` when a full body is not
available. [External Reviews](../../../../docs/features/external-reviews.md)
defines what is saved, who can read it, and when it is deleted. New rules can
read a writer inside one review or reuse one writer shown for the article.
Older saved rules keep their own writer settings.

Setup records may contain AI instructions, size-limited public HTML, tool
arguments, extracted preview fields, errors, and opaque model continuation data.
Only internal server and database work can read saved setup conversations; run
APIs omit them. Setup traces follow the tracing service's access and retention
rules. These records must not include credentials, request headers, cookies, or
private admin data. Normal collection must keep page bodies and website writing
out of logs and traces. Follow
[Sensitive Data](../../../../docs/policies/sensitive-data.md).

`pnpm evals:scraper:e2e` runs the [live create-scraper checks](./configured/createScraper.eval.test.ts).
A local HTTP server serves [small website fixtures](../../__fixtures__/scraper-websites/README.md).
AI requests go directly to the configured service. Each check starts with a
main page URL, lets AI build and test rules, turns them on, then collects
reviews and checks saved fields, score totals, and repeated collection. No
rules or expected answers are given to AI. The checks require the local test
database and an AI service key; missing keys skip them locally. They use real
request timing and the same background jobs as production. Clip generation
stays disabled.

The dedicated `test / scraper` CI job runs on relevant
same-repository pull requests and every push to `main`. It uses its own test
database and uploads results. It reads `SCRAPER_AI_GATEWAY_API_KEY`, falling
back to `AI_GATEWAY_API_KEY`, fails if neither is configured, and requires no
label. Fork pull requests run the ordinary tests without secrets.

`pnpm evals:scraper` checks rule generation with fixed website fixtures and the
live AI service, including the full creation scenarios. Normal test runs exclude
these checks. The `trigger-evals` label runs the broader eval suite in CI.

Before saving replacement rules, check them locally. The command uses
`.env.local` and the same website settings, robots.txt rules, request limits,
reading code, and checks used in production. It records the local run but does
not save reviews or prices:

```bash
pnpm cli scrapers preview --site whiskystudy --input /tmp/revision.json --limit 3
```

The input has the same `listUrl` and `rules` fields accepted by the API. Set
`rulesVersion` to `11` for new rules. An omitted version means version 1 so
existing preview files keep their original behavior. If the site exists only
in production, the command creates the local records needed for the preview:

```json
{
  "rulesVersion": 11,
  "listUrl": "https://example.com/reviews",
  "rules": {
    "kind": "review",
    "list": {
      "links": "article a[href]",
      "nextPage": null,
      "limit": 3
    },
    "detail": {
      "url": null,
      "title": "h1",
      "date": "time",
      "reviews": {
        "area": "main",
        "item": "article.review",
        "name": "h2",
        "reviewer": null,
        "tastingNotes": null,
        "score": null
      }
    }
  }
}
```

Omit `--limit` for a full check. A small check is useful while editing rules;
the complete rules still need a full local check before they are used in
production. If request limits pause a run, the command prints when it can
continue and resumes from its saved page automatically.

## Checks for every source

Every new or changed source must pass these checks. Test shared request rules
once in the runtime instead of repeating them in every source test.

| What to check                                                                                                           | Where it is checked                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| The source requests only its listed websites.                                                                           | Registry and import tests.                                                                             |
| The source has a fixed page or item limit and cannot crawl the whole website.                                           | The source's fixture tests.                                                                            |
| Every request uses the current run, so robots rules, spacing, retries, and response-size limits apply.                  | Import and HTTP tests.                                                                                 |
| A run can finish or save its place before its request allowance runs out. Waiting between requests repeats no old work. | Registered runtime tests.                                                                              |
| The saved place points to the next safe item. Results are saved before progress, and repeating work is safe.            | The source's resume and repeat-work tests.                                                             |
| Each result has a stable source key that is unique where it is stored.                                                  | Parser tests for stable keys and known collisions.                                                     |
| Parsed output passes the source's strict schema and is saved by its registered save function.                           | Registry and saving tests.                                                                             |
| A planned wait keeps the run active. Bad markup, invalid data, and failed saves fail the run.                           | Runtime and source tests.                                                                              |
| A source change passes fixture tests and one local run against the public website.                                      | Inspect its saved progress, request count, and parsed results. Use the CI label for live model checks. |
| The first production run is checked in Admin → Scrapers and Sentry.                                                     | Confirm its status, counts, saved progress, robots state, and any final error.                         |

Keep source-specific facts in the adapter tests and the owning feature or
research document. Update a fixture when the publisher changes markup. Do not
weaken a shared schema or runtime rule to accept one malformed page.

[Captured review score fixtures](../../__fixtures__/review-scores.md) exercise
source parsing, review storage, site conversion settings, and Bottle totals
without website or AI calls. They retain publisher scores and the markup needed
to distinguish multiple reviews on one page. Their capture notes explain how
to refresh them without keeping full articles.

## Run outcomes

- `succeeded` means the source finished after its valid results and latest
  progress were saved.
- `queued` with `nextAttemptAt` means the same run is saved and waiting for its
  next request time. It is not a failure.
- `failed` means invalid data, robots rules, settings, saving, or the remote
  website stopped that run. Stored errors are brief; detailed unexpected
  failures belong in Sentry.

`sliceRequestCount` counts requests in the current worker attempt and resets
when a waiting run starts again. The other request and result counts cover the
full run. A null request-error count means the run finished before error
tracking was added. Records without a saved type or new/seen result appear as
not tracked in Admin. Preview and source suggestion runs do not appear in the
Admin overview.

Every network attempt, including robots refreshes and retries, counts toward
the current worker's request limit. Response bodies are read only up to the
configured size and are never stored by the runtime.

Planned waits do not count as failed attempts. Other restarts do. A run may last
up to three days. This gives a historical review import time to finish while
still stopping work that cannot make progress.

## Bot identity

Outbound requests identify as `PeatedBot/1.0 (+https://peated.com/bot)`. The
public page explains Peated's purpose, request controls, and contact path. Do
not replace it with a browser identity or add credential/cookie forwarding.
When `PEATED_BOT_PRIVATE_JWK` is configured, the shared HTTP transport signs
each request with Cloudflare Web Bot Auth. Follow the
[PeatedBot request signing runbook](../../../../docs/operations/peated-bot.md)
for deployment, registration, checks, and key rotation.
