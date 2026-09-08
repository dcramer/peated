# Scraper Runtime

This module controls Peated's scraper requests and saved progress. It keeps four
jobs separate:

- definitions list which websites each source may request;
- runs limit work and save enough progress to resume;
- coordination and HTTP space requests, retry temporary failures, and enforce
  limits;
- adapters read responses and pass results through the current run.

Code outside this module uses `index.ts` to initialize, queue, or execute a run.
It must not call adapters, request controls, robots checks, or scraper HTTP code
directly. The files are split by responsibility:

- `lifecycle.ts` creates runs and sends them to the worker queue;
- `runs.ts`, `session.ts`, `http.ts`, `robots.ts`, and `coordinator.ts` own core
  execution without importing production registry or worker infrastructure;
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

The database stores each source and its parsing rules. Each saved revision is
immutable. A preview reads sample pages and stores only parsed fields and errors.
It does not store fetched HTML, review text, or full product records in the
product database. Only a revision that passes its preview can become active. An
admin can return to any older revision that passed. Pausing a source stops
collection but keeps its revisions and run history.

Older rule versions remain supported so saved sources keep working. New
sources use version 8. A review source has `articles` for finding article links
and `article` for reading an article. A price source uses `products` and
`product` in the same way. `oneArticlePer` or `oneProductPer` identifies each
result on the list page. `link` finds its link, `skipWhen` can leave out a
result, and `nextPage` can continue to the next list page. Links must stay on
the source website. Code follows at most five list pages and stops at `limit`.

Each field has an ordered `try` list. A read can get text, get an attribute, or
use a fixed value. The parser uses the first non-empty result. A read can match
the selected text against up to three templates. Templates contain normal text
and three placeholders: `{anything}` ignores changing text, `{value}` keeps the
wanted text, and `{line}` matches an HTML line break. For example,
`Score: {value}/10` returns the score and
`Review {anything} - {value}` returns the writer. Matching ignores letter case.
List filters and review starts use the same templates. `addStart` and `addEnd`
can add known text after a match. Publication dates can also come from a URL
path with bounded `yyyy`, `yy`, `MM`, `dd`, and `*` parts. Scores can map up to
25 written grades to numbers.

For reviews, `article.reviews.inside` identifies the part of the article that
contains reviews. `oneReviewPer: "element"` means each selected element is one
review. `oneReviewPer: "section"` means each matching `startsAt` label starts a
review; `stopBefore` can mark where the reviews end. `inside` must select the
closest single area shared by every review start. This also works when layout
elements wrap the labels and review content. A single section must say whether
to start at its label or use the whole review area. A field read states
whether it reads inside the review or from the article, and an article-level
read states whether it applies to the first review or every review. This keeps
names, writers, and scores from leaking between reviews.

The parser uses a review's Bottle name and writer to keep it matched when other
reviews are added or moved. Repeated reviews with the same name and writer stay
separate. This is automatic and is not part of the saved rules.

The setup agent submits this same rule shape, and the saved revision and parser
use it directly. There is no setup-only translation step.
Rules do not support
scripts, custom code, arbitrary request headers, browser automation, numbered
page templates, infinite scrolling, or links to another website. Add a built-in
adapter when a source needs one of those features.

Adding a source starts AI setup. The server reads the main page, up to four
likely list pages on the same website, and any optional example review or
product pages. AI calls `check_rules` with the list, next-page, and detail rules.
Code checks the list page, one next page when present, and up to three detail
pages with the same parser used during collection. When a check fails, AI
receives the errors and inspected pages to correct its rules. Setup allows
three checks in total and saves a revision only after a check passes. Expected
final rule failures are stored on the run and shown in Admin; they do not fail
only through Sentry. Provider, database, queue, and unexpected network failures
remain system errors. The AI provider does not store request content. An admin must still
preview and activate the inactive revision. AI never changes the active
revision directly.

Before limiting model input, setup removes script and style elements from its
HTML copies so large page headers do not crowd out links and article content.
It keeps the page structure and attributes used by selectors. Rule checks and
collection still parse the original fetched HTML.

For reviews, each selected review is the full body saved internally and used for
tags and clips. Older rules can use `tastingNotes` when a full body is not
available. [External Reviews](../../../../docs/features/external-reviews.md)
defines what is saved, who can read it, and when it is deleted. Each review can
read its own writer. An article-level writer is used only when the rules
explicitly apply it to the first review or every review.

Setup traces may record the complete model instructions, public website input,
model output, and rule-check arguments and results. They must not include
credentials, request headers, cookies, or private admin data. Normal collection
must keep page bodies and publisher prose out of logs and traces. Follow
[Sensitive Data](../../../../docs/policies/sensitive-data.md).

`pnpm evals:scraper:e2e` runs the [real-model create-scraper suite](./configured/createScraper.eval.test.ts).
A local HTTP server serves [small website fixtures](../../__fixtures__/scraper-websites/README.md).
Model requests go directly to the configured AI provider without interception. Each case
starts with a homepage URL, lets the model build rules, previews and activates
them, then collects reviews and checks stored fields, score totals, and repeated
collection. No parsing rules or expected answers are supplied to the model.
The suite requires the local test database and a gateway key; missing credentials
skip the live cases locally. It uses real request timing, Redis queues, BullMQ
workers, and registered production job handlers. Clip generation stays disabled.

The dedicated `test / scraper` CI job runs on relevant
same-repository pull requests and every push to `main`. It uses its own test
database and uploads results. It reads `SCRAPER_AI_GATEWAY_API_KEY`, falling
back to `AI_GATEWAY_API_KEY`, fails if neither is configured, and requires no
label. Fork pull requests run the ordinary tests without secrets.

`pnpm evals:scraper` checks rule generation with fixed website fixtures and the
live AI service, including the full creation scenarios. Normal test runs exclude
these checks. The `trigger-evals` label runs the broader eval suite in CI.

Before saving replacement rules, run the revision input through the local
runtime. The command uses `.env.local`, the registered target, robots policy,
request controls, production parser, and validators. It records the local run
for inspection but does not save reviews or prices:

```bash
pnpm cli scrapers preview --site whiskystudy --input /tmp/revision.json --limit 3
```

The input has the same `listUrl` and `rules` fields accepted by the revision
API. Set `rulesVersion` to `8` when testing current operations. An omitted
version means version 1 so existing preview files keep their original behavior:

```json
{
  "rulesVersion": 8,
  "listUrl": "https://example.com/reviews",
  "rules": {
    "kind": "review",
    "articles": {
      "oneArticlePer": "article",
      "link": "a[href]",
      "skipWhen": null,
      "nextPage": null,
      "limit": 3
    },
    "article": {
      "canonicalUrl": null,
      "title": {
        "try": [
          {
            "get": "text",
            "selector": "h1",
            "take": "first",
            "match": null,
            "addStart": null,
            "addEnd": null
          }
        ]
      },
      "publishedDate": {
        "try": [
          {
            "get": "attribute",
            "selector": "time",
            "attribute": "datetime",
            "match": null,
            "addStart": null,
            "addEnd": null
          }
        ]
      },
      "reviews": {
        "inside": "main",
        "oneReviewPer": "element",
        "selector": "article.review",
        "name": {
          "try": [
            {
              "get": "text",
              "from": "review",
              "selector": "h2",
              "take": "first",
              "match": null,
              "addStart": null,
              "addEnd": null
            }
          ]
        },
        "reviewer": null,
        "tastingNotes": null,
        "score": null
      }
    }
  }
}
```

Omit `--limit` for a full acceptance preview. A bounded preview is useful while
editing rules; the complete rules still need a full local acceptance run before
production activation. If request controls pause a run, the command prints the
next eligible time and resumes from its saved page automatically.

## Source acceptance rules

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

A planned wait between saved-rule requests does not count toward the
ten-attempt safety limit. Other restarts do. Every run must finish within 24
hours, so invalid saved progress or a permanent wait cannot live forever.

## Bot identity

Outbound requests identify as `PeatedBot/1.0 (+https://peated.com/bot)`. The
public page explains Peated's purpose, request controls, and contact path. Do
not replace it with a browser identity or add credential/cookie forwarding.
