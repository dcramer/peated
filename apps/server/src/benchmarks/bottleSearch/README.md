# Bottle candidate search comparison

Compare the current GIN retrieval window, GIN plus a separate producer candidate
window, and TIN-compatible text retrieval through PlanetScale Lead. All three
use Peated's shared candidate ranker. Production rollout is described in
docs/architecture/bottle-search.md; this runner is an isolated experiment.

## Run

From the repository root:

```sh
docker compose -p peated-search -f docker-compose.search-benchmark.yml up -d --build --wait
pnpm --filter @peated/server exec tsx src/benchmarks/bottleSearch/run.ts --corpus src/benchmarks/bottleSearch/corpus.json --repeats 20 --crowding
pnpm --filter @peated/server exec tsx src/benchmarks/bottleSearch/run.ts --corpus src/benchmarks/bottleSearch/corpus.json --repeats 1 --crowding --lead
```

The Docker image pins Lead's source revision, Rust and cargo-pgrx. The service
uses loopback port 15433 and a separate `search_benchmark` database. It does not
replace the application database. The runner ignores `DATABASE_URL`, creates
temporary tables, and rolls its table/index changes back after each run.

Stop it with:

```sh
docker compose -p peated-search -f docker-compose.search-benchmark.yml down
```

## Corpus and cases

The checked-in corpus contains 832 public Bottle records with identity fields from reviewed
September 2026 catalog records, with nearby releases as distractors. The cases
record source proposal IDs and expected Bottle IDs. Created Bottles are included
to test whether future listings can retrieve them; their presence does not mean
they existed when the original proposals were created.

The 100 cases include 80 development and 20 held-out cases. Runs default to
development; use `--split held-out` after fixing ranking changes, or `--split all`
for later regression checks. Additional cases retain original retailer titles,
approved inputs, source URLs, and verified Bottle IDs.

`--crowding` adds 120 explicitly synthetic, popular releases from unrelated
brands. These reproduce the failure where a generic age name fills the global
100-row text window before the requested producer is considered.

For a larger comparison, pass a JSON array of public Bottle records obtained
through the authenticated API. All expected IDs must be present; the runner
rejects missing targets and duplicate IDs. It strips fields outside the identity
schema before loading rows. Do not use private user data. The included sample
is too small to choose a production search engine.

## Interpret results

Output reports the expected Bottle's final rank, recall at 10, retrieved count,
and warm p50/p95 for GIN retrieval plus candidate ranking. One run warms each
query; measured repetitions rotate engine order. Lead timings are deliberately
omitted: Lead scans rows and does not measure TIN's production performance.

This scratch schema reproduces the text-window cutoff and identity-fact ranking,
but stores relationships in an array and candidate facts in JSON. Production
uses normalized relationships. It excludes HTTP, Bottle serialization, accepted
reference resolution, alias inventory, cold-cache behavior, concurrency and
write load. These measurements cannot establish production latency or query
plans. The route integration tests separately cover the actual database schema
and response contract.

PlanetScale's published benchmarks are accepted for the engine choice. During
rollout, check the real endpoint and production query shapes for regressions: recall on a wider adjudicated
set, p95/p99, buffers read, index size and write cost. Include wrong relationships,
missing facts, exact cask codes, decimal strengths, punctuation, accented names,
typos, broad queries and search freshness after edits. Keep exact reference
assignment independent from search relevance.

Lead uses the `tin` extension name and exercises the TINQL operator and scoring
functions. It changes neither the deployed API nor the production schema.

References:

- [Lead source and compatibility boundary](https://github.com/planetscale/lead)
- [TIN setup and local testing](https://planetscale.com/docs/postgres/search/get-started)
- [TIN query shapes](https://planetscale.com/docs/postgres/search/reference/sql-shapes)

## September 20 validation

With 832 catalog rows and 120 synthetic distractors, recall at 10 was 30/80
for the original global GIN window, 79/80 for bounded producer-aware GIN, and
80/80 for Lead. Held-out recall was 14/20, 20/20, and 20/20 respectively. Every
retrieved target ranked first in this sample. These are sampled retrieval results,
not production accuracy or latency guarantees. No ranking changes were made in
response to held-out results.

## Recorded request replays

`request-replays.json` supplies six scenarios to
`src/orpc/routes/bottles/list.replay.test.ts`. These exercise the real route,
validation, normalized database relationships, search indexes, and serialization
with both GIN and Lead. Run them with:

```sh
pnpm --filter @peated/server test -- src/orpc/routes/bottles/list.replay.test.ts
```

The fixture retains the original GET paths, observed result IDs, saved response
filenames, and Sentry trace IDs/timestamps. Trace query parameters match the saved
request parameters after URL decoding. This establishes that the request shape
was used in production; it does not establish that a saved response came from
that exact trace invocation. Only public Bottle identity fields are retained.
No headers, user identifiers, tokens, or full Sentry events are included.

The cases cover:

- Thomas Moore Port: retrieve the Bottle selected by verified proposal 1063.
- Leopold Three Chamber: retain both the selected Bottle (proposal 1070) and
  the holiday release rejected during review. Search alone cannot choose safely.
- Method Madness: retain all four observed alternatives without inventing a
  single correct match.
- Booker Kentucky Tea and Booker Ronnie: return no match against the recorded
  producer inventory, then retrieve the later-created Bottle with the identical
  input. Proposals 1017 and 1265 record the creation decisions; creation timestamps
  must follow the captured searches. Approved facts never become query inputs.
- Balvenie: replay the recorded 100-result first page and cursor 2, covering all
  118 sampled Bottles without duplicates and with correct pagination metadata.

Non-pagination cases share their observed catalog rows as distractors. IDs are
mapped to local fixture IDs. The Balvenie catalog combines two saved response
snapshots; tests assert complete traversal, not historical popularity order.
Historical aliases, tombstones, search documents, and the entire catalog were
not captured. Documents are rebuilt from the recorded identity fields using
current indexing code. These are deterministic route regressions over sampled
catalogs, not a reconstruction of the complete production database or HTTP
transport timing. They do not cover POST searches or establish match precision,
production latency, or fewer searches per moderation decision.

The earlier 100-case comparison remains a **reconstructed positive retrieval
benchmark**: 94 added cases use approved creation facts and include targets
created after the original search. Its held-out split shares those limitations.
It also applies the new ranker to every retrieval strategy, so its global GIN
result is not an end-to-end measurement of the previous implementation. Keep
those numbers separate from recorded request replay results.

## Compare against the actual previous implementation

`apps/server/vitest.search-baseline.config.mts` loads the Bottle list,
create-candidates, and global search routes, candidate ranker, and text indexing
code directly from commit `923f1eca87c741839d1603081f464e4abeba847e`. It does not
rewrite their retrieval or ranking logic. Both runs use the current database
schema, serializers, and identical fixture definitions. A compatibility adapter
supplies empty values for the new text columns in the baseline run; its GIN
index uses the original indexing code. No working files are swapped or reverted.
The pinned commit must be available in the local Git repository.

Run sequentially against the local test database (the baseline intentionally
fails assertions for behaviors fixed by this change):

```sh
pnpm --filter @peated/server test -- --config vitest.search-baseline.config.mts src/orpc/routes/bottles/create-candidates.test.ts src/orpc/routes/bottles/list.replay.test.ts src/orpc/routes/bottles/list.test.ts --reporter=json --outputFile=/tmp/peated-search-before.json
pnpm --filter @peated/server test -- src/orpc/routes/bottles/create-candidates.test.ts src/orpc/routes/bottles/list.replay.test.ts src/orpc/routes/bottles/list.test.ts --reporter=json --outputFile=/tmp/peated-search-after.json
```

`implementation-comparison.json` records the September 20 comparison results.
The flag variants exercise GIN and Lead in the new implementation. The previous
implementation ignores that flag, so its duplicated variants are not separate
search engines or independent accuracy observations. Counts are regression
assertions, not a representative accuracy percentage. Recorded-request scenarios
and constructed behavioral regressions are identified separately.

This comparison can prove specific retrieval and ranking improvements locally.
It measures neither production latency nor the frequency of these failures in
the moderation backlog. Test durations include fixture setup and must not be
reported as endpoint latency.

## Local endpoint latency

`latency.test.ts` is an opt-in timing experiment using the real route, database,
ranking, and serializers. It is skipped in ordinary test runs. It builds 1,001
synthetic Bottles under one producer, warms each case five times, then measures
50 serial calls per case while rotating case order. Setup is outside the timer.
Both implementations must return the expected result counts.

```sh
BOTTLE_SEARCH_TIMING_OUTPUT=/tmp/peated-endpoint-before.json pnpm --filter @peated/server test -- --config vitest.search-baseline.config.mts src/benchmarks/bottleSearch/latency.test.ts
BOTTLE_SEARCH_TIMING_OUTPUT=/tmp/peated-endpoint-after.json pnpm --filter @peated/server test -- src/benchmarks/bottleSearch/latency.test.ts
```

The September 20 measurements are saved in `endpoint-latency.json`. Local GIN
p95 changed from 4.9 to 7.2 ms for selective candidates, 10.2 to 9.0 ms for broad
candidates, 11.1 to 12.0 ms with producer/release facts, and 1.6 to 1.9 ms for an
empty result. The 100-result Bottle list changed from 15.2 to 14.0 ms.
The added candidate work has a measurable selective-query cost; the new endpoint
is not uniformly faster. These small, warm, serial local measurements establish
neither production latency nor hosted TIN performance. HTTP/network time and
concurrent load are excluded. Each implementation was measured once; small
differences may be noise.
