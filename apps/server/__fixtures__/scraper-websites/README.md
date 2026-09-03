# Scraper website fixtures

Run `pnpm evals:scraper:e2e` for the real-model creation scenarios. They use the
normal backend test database and reset it between cases. See
[backend testing](../../../../docs/development/backend-testing.md) for local setup.
The `test / scraper` CI job runs the real-model suite with its own
database and saves a `scraper-live-test-results` artifact, including failures.
It runs on relevant same-repository pull requests and every push to `main`,
using `SCRAPER_AI_GATEWAY_API_KEY` or `AI_GATEWAY_API_KEY`. Missing credentials
skip the live cases locally and fail the dedicated CI job. Fork pull requests
still run deterministic tests without secrets. CI pins the setup model, and each
saved revision records the model and prompt version used to create it.

These are authored, simplified websites with fictional bottles and reviewers.
They contain no copied article text. Their layouts cover patterns observed in
the [review source research](../../../../docs/research/review-score-conversion-pilot-2026-09.md):

| Website | What it covers |
| --- | --- |
| `decimal` | A Words of Whisky-style score block: 8.7 out of 10, counted as 87 after site settings are saved. |
| `stars` | Five-star review metadata in HTML attributes, separate from a reader rating. Source scores are preserved and excluded from totals. |
| `points` | A WhiskyNotes-style article containing two bottle scores, plus an older review reached through pagination and duplicate article links. |

The suite starts at the admin create route with only an ordinary publication
name and homepage URL. The name does not identify the score format being tested.
It discovers pages, checks proposed rules, saves a revision, previews and
activates it, approves review publication, and collects reviews. After
collection, it previews and saves score settings. It checks
dates, reviewers, original scores, Bottle assignments, totals alongside a
member score, and repeated collection.
Multi-review pages retain one shared article byline without mixing bottle scores.

A local HTTP server supplies the website HTML in the real-model suite.
Model requests go directly to the configured provider without interception;
the model chooses all parsing rules.
All parsing, setup checks, API validation, database writes, and relevant worker
jobs are real. This suite uses real request timing, Redis queues, BullMQ workers,
and registered production job handlers. Existing Bottle References keep Bottle
matching deterministic. Clip generation is disabled.

Expected fields live in `testWebsites.ts` and are used only in assertions and
database fixtures. Score conversion settings are supplied separately by the admin.

To add a live case, add small HTML pages, then list the URLs and independent
expected review fields in `testWebsites.ts`. Keep scoring distractions outside
review content so the case checks the intended score.
Use [captured review fixtures](../review-scores.md) for exact publisher markup.
