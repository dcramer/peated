# Web cache audit — 2026-09-03

The best next steps are to remove duplicate anonymous detail reads, reconnect
the footer to shared stats caching, and cache public entity catalog summaries
and common bottle lists. Keep the recent overview hydration and loading geometry.

## Evidence and scope

The initial read-only investigation covered Sentry `peated/peated`, production
response headers, and repository commit `851708a7a`. Findings below describe that
baseline. The subsequent local implementation is recorded at the end; nothing
has been deployed.

The tables use the fixed window **2026-09-02 21:30:00 through 2026-09-03 03:30:00
UTC** (September 2, 2:30–8:30 p.m. PDT). Sentry Events API returned
`dataScanned: full`. Counts are Sentry-reported spans, not a census of traffic or
identified bots. Aggregate durations include waits and concurrent work; they
are not CPU time or projected savings. Do not add nested web, RPC, and DB
durations together.

Queries used the `spans` dataset with `project:peated` and:

- Web: `environment:vercel-production is_transaction:true span.op:http.server`,
  grouped by `transaction`.
- API: `environment:production span.op:rpc.server`, grouped by
  `span.description`. Grouping by API transaction alone hides operations under
  `POST /rpc/*`.
- Database: `environment:production span.op:db`, grouped by `span.description`.
- Storage: `environment:production span.op:[peated.read-file,peated.store-file]`,
  grouped by `span.op`.

Fields were `count()`, `p50(span.duration)`, `p95(span.duration)`, and
`sum(span.duration)`, ordered by descending sum. Storage also used
`count_unique(span.description)`. These filters can be reproduced in
[Sentry Explore](https://peated.sentry.io/explore/traces/).

| Web server transaction | Count |   Median |      p95 |
| ---------------------- | ----: | -------: | -------: |
| Bottle overview        | 2,830 |   640 ms | 2,733 ms |
| Bottle prices          | 1,531 |   666 ms | 2,522 ms |
| Entity bottle listing  | 1,164 |   697 ms | 1,797 ms |
| Entity overview        |   600 | 1,143 ms | 3,185 ms |
| Bottle browse          | 1,912 |   237 ms |   900 ms |
| Bottle tastings        |   643 |   703 ms | 2,625 ms |

| API operation           |  Count | Median |      p95 | Sum of span durations |
| ----------------------- | -----: | -----: | -------: | --------------------: |
| `bottles/details`       | 15,339 | 136 ms |   740 ms |              64.7 min |
| `bottles/list`          | 12,580 | 115 ms |   857 ms |              52.5 min |
| `stats`                 |  5,648 |  27 ms |   892 ms |              17.6 min |
| `entities/details`      |  8,270 |  60 ms |   434 ms |              17.5 min |
| `entities/catalog`      |  1,316 | 614 ms | 1,465 ms |              16.1 min |
| `bottles/flavorProfile` |  1,918 |  80 ms |   594 ms |               4.8 min |
| `entities/list`         |    816 |  89 ms |   681 ms |               2.7 min |

The initial rolling 24-hour query included a very different tail: entity
overview p95 was about 225 seconds. Release `9d1d273e5` accounted for 1,257 entity
overview spans and had p95 about 243 seconds. This is evidence of a severe
earlier latency episode, not proof that the release caused it. The six-hour
window is more useful for ranking current work; the episode still merits
separate diagnosis. Unbounded `NextNodeServer.clientComponentLoading` spans
also dominated the unfiltered duration ranking and were excluded from the
web server comparison.

Bot attribution remains incomplete. A rolling six-hour browser-name breakdown
was dominated by Chrome; `user_agent.original` was absent in the queried rows.
That does not distinguish people from browser-using crawlers. API clients also
replace user-agent with Peated client names. Cache recommendations therefore
target anonymous public reads without depending on an unreliable bot label.

## Previous work to preserve

- [#900](https://github.com/dcramer/peated/pull/900) added the one-hour public stats
  cache, disabled sibling-tab prefetch, skipped empty series queries, and added
  the reverse distiller/bottle index. Those changes remain in the checkout.
- [#904](https://github.com/dcramer/peated/pull/904) prioritized primary content
  and moved footer stats off the blocking layout path. Its layout change also
  removed the call to `getPublicStats`, leaving a cache bypass described below.
- [#943](https://github.com/dcramer/peated/pull/943) reserved bottle overview
  geometry and hydrated request-matched reviews, tastings, and series results.
- [#949](https://github.com/dcramer/peated/pull/949) reserved entity overview
  geometry and hydrated its catalog, releases, events, and relationships. Its
  recorded local Bunnahabhain navigation CLS improved from 0.168 to 0.028 on
  desktop and 0.533 to 0 on mobile. These are historical PR measurements, not
  measurements from this audit.
- [#416](https://github.com/dcramer/peated/pull/416) established anonymous clients
  and session-safe response policy, but deliberately did not enable shared HTML
  caching. [#472](https://github.com/dcramer/peated/pull/472) repaired upload-read
  error handling during SSR; it did not put images behind a shared cache.

## Recommended order

### 1. Reuse anonymous detail records in the page frames

[Bottle layout](<../../apps/web/src/app/(app)/bottles/[bottleId]/layout.tsx>)
awaits `getBottlePage`, then calls `client.bottles.details` again.
[Entity layout](<../../apps/web/src/app/(app)/entities/[entityId]/layout.tsx>)
does the same with `getEntityPage` and `entities.details`. The second call runs
even when there is no signed-in member. Every tab under these layouts pays for
the duplicated detail work.

Three sampled bottle server traces each contained two `orpc.bottles/details`
client spans, including
[trace 6c8fc95bfbcd4a1d97242595b34fe952](https://peated.sentry.io/explore/traces/trace/6c8fc95bfbcd4a1d97242595b34fe952/).

Use the canonical record for an anonymous page frame. Keep the member-specific
read for signed-in visitors, whose favorite, library, tasted, and following
state differs. Preserve canonical redirects. This removes one full detail RPC
per affected anonymous render without introducing stale data.

The existing React `cache()` wrappers deduplicate calls to the same loader
within a render; a separate direct RPC bypasses them. They also do not provide
cross-request caching. See [React's cache documentation](https://react.dev/reference/react/cache).

### 2. Restore shared stats delivery for the footer and authentication pages

[ApplicationLayout](<../../apps/web/src/app/(app)/_components/applicationLayout.stylex.tsx>)
uses `useQuery(publicHomeQueries.stats(orpc))`. Its parent layout no longer
supplies cached stats. `getPublicStats` is currently used only on the homepage
and About page. Authentication intros, search, and some sitemap handlers also
call stats directly.

Sentry corroborates the bypass: the rolling six-hour query found 5,461 web
`rpc.client` stats spans, with bottle, price, tasting, and login transactions
among the leading callers. The fixed window has 5,648 API stats calls and
5,645 executions of the external-review count query alone.

Restore consumption of the existing one-hour public snapshot through a
nonblocking server boundary and hydrate the same client query key. Ensure the
client does not immediately refetch it. Audit all stats callers; an API-level
shared snapshot is an alternative that would also cover direct browser/API
callers. Preserve `asOf`. Keep footer space stable while the boundary streams.

### 3. Cache the public entity catalog summary

[entities/catalog](../../apps/server/src/orpc/routes/entities/catalog.ts) reads
an entity and runs six aggregate queries in parallel: totals, categories,
related brands, bottlers, distilleries, and notable bottles. It does not use
member context. Each aggregate executed 1,316 times in the fixed window, with
median DB spans around 392–491 ms. Together those six query groups account for
about 59.8 minutes of DB span duration; concurrent queries explain why this is
larger than the route's elapsed-duration sum.

In [trace 2f05deea57e54ed588d4de8f55a95946](https://peated.sentry.io/explore/traces/trace/2f05deea57e54ed588d4de8f55a95946/),
captured at 2026-09-03 03:47:20 UTC, the catalog RPC took 1.67 seconds. Its
aggregate query spans ranged from 286 to 998 ms and connection-acquisition
spans also showed waits. This trace is illustrative and falls after the table's
fixed window.

Start with a short public data-cache interval, for example five minutes, keyed
by entity ID. This interval is a proposal, not a current freshness contract.
Cover invalidation for catalog edits, merges, kind changes, and changes that
affect displayed totals or rankings. Keep the overview's existing server
prefetch and hydration so its geometry remains stable.

Also investigate computing the associated bottle set once for these aggregates,
using query plans to verify the result. The reverse distiller index already
exists in the repository; this audit did not inspect the production index or
query plan, so it cannot claim an index is missing.

### 4. Cache common anonymous lists and public detail data

Start with the fixed popular/recent bottle lists on entity overviews, same-series
lists on bottle pages, and the first page of an entity's bottle catalog. Entity
lists themselves are a smaller measured target than bottle lists and the entity
catalog aggregate.

The relevant query shapes are centralized in
[entityOverviewQueries](<../../apps/web/src/app/(app)/entities/[entityId]/entityOverviewQueries.ts>)
and [bottleOverviewQueries](<../../apps/web/src/app/(app)/bottles/[bottleId]/bottleOverviewQueries.ts>).
Cache anonymous results with every effective filter, sort, limit, and cursor in
the key. Reuse normalized catalog inputs. Begin with bounded, common query
shapes before caching arbitrary search strings and deep pagination.

Do not wrap the request-aware client in a global cache: its output can include
member flags. Retain request-matched reads for signed-in hydration, or separate
public data from member state explicitly. Bottle details also contain latest
price and aggregate tasting data, so caching the whole record requires a
freshness decision and invalidation for those dependencies. Keep edit-form reads
fresh and preserve merged-ID behavior.

For the current architecture, the existing stats data-cache pattern offers a
small starting point. Next's documentation confirms cross-request caching and
prohibits reading cookies/headers inside the cache scope; its newer recommended
API is `use cache`. A wider Cache Components migration is a separate decision.
See [Next data caching](https://nextjs.org/docs/app/api-reference/functions/unstable_cache).

### 5. Reduce repeated geography serialization

The single-ID country lookup ran **54,190 times**, totaling 20.1 minutes of DB
span duration; the equivalent region lookup ran 22,192 times.
[EntitySerializer](../../apps/server/src/serializers/entity.ts) loads countries
and regions, then [RegionSerializer](../../apps/server/src/serializers/region.ts)
loads countries again. Bottle and group serialization also reuse entities.

Reuse country rows within a request/serialization operation first. A small
shared public geography cache is another option, but those serialized objects
include changing totals, so they cannot be treated as permanently static.

### 6. Put public image delivery behind an effective shared cache

The fixed window contains 421 `peated.read-file` spans across 262 descriptions,
with median 190 ms, p95 575 ms, and 97.7 seconds of total span duration. There
were 32 storage writes, with median 713 ms and p95 1.33 seconds. Reads may also
include model/worker access; these are not all proven HTTP image requests.

Both HEAD and a subsequent GET of
`https://api.peated.com/uploads/bottles-leecd8rgt2uaffx02hk0x5wp.webp` returned:

```text
HTTP/2 200
Cache-Control: public, max-age=86400
CF-Cache-Status: DYNAMIC
Vary: Origin
```

The GET body was 40,842 bytes. Neither response exposed an ETag or Last-Modified
header. This proves a cache gap for the sampled object, not every image or CDN
location. The upload GET handler downloads the complete object into a buffer
before responding.

The current plain `img` elements request original upload URLs directly,
bypassing Next.js image optimization. Adopting the optimizer would need measured
bandwidth and latency benefits to justify its hosting cost. Image optimization
and a separate Render cache are outside this change. Keep upload storage and
URLs unchanged; mutating upload requests must not be cached.

`BottleVisual` also serves the original image in small rows without `srcset` or
lazy loading. Sized derivatives and lazy loading below the fold could reduce
bytes, while retaining the fixed frames introduced to prevent layout shifts.
Measure before changing above-the-fold loading priority.

## Boundaries and follow-up validation

Production HEAD checks of `/bottles/1`, both anonymous and with a dummy `_session`
cookie, returned private/no-store and `x-vercel-cache: MISS`. This matches the
[web caching policy](../architecture/web-caching.md). The dummy-cookie check
does not substitute for testing a real signed-in account. Public data caching
can proceed while HTML remains dynamic; shared HTML still needs the policy's
session-isolation verification.

For implementation, verify one detail RPC per anonymous render, separate member
state, cache hits across requests, invalidation after edits/merges, and stable
desktop/mobile direct-load and navigation CLS. Compare the same Sentry operation
groups and time windows after deployment. Add low-cardinality cache hit/miss and
anonymous/member attribution if needed to measure results.

## Local implementation follow-up

The repository changes address the first five areas and add image lazy loading:

1. Anonymous Bottle and Entity frames reuse fresh canonical details; member
   frames retain their personalized read.
2. Public stats consumers share the existing one-hour snapshot.
3. Anonymous entity catalog summaries revalidate every five minutes.
4. Simple first-page entity/series bottle lists use the same five-minute policy.
   Members, search, additional filters, and later pages bypass it.
5. Entity serialization passes country rows to RegionSerializer through its
   existing context argument. Only missing countries are fetched; totals stay
   fresh on later requests. No global geography cache was added.
6. Bottle row images load lazily while detail images remain eager. Image frame
   geometry is preserved. Images continue to use plain `img` elements.

The cache and freshness boundaries live in [web caching](../architecture/web-caching.md).
No infrastructure setting has been changed.

Validation:

- All 397 web tests pass after rebasing onto current main, including real Next
  cache and request contexts, sealed member cookies, cache refresh, list keys,
  errors, layout data, and canonical routes.
- Nine backend integration tests pass in an isolated local database: geography
  reuse/freshness and Entity details.
- All six targeted desktop Playwright workflows pass across focused runs:
  Bottle redirects, invalid/missing IDs, Entity redirects, owner navigation,
  and distillery bottle-view switching. Initial runs timed out while compiling;
  the local rewrite loop was resolved by using the documented hostname setup.
  No application routing changes or test timeout increases were needed.
- Agent-browser checks cover Entity overview/listing and Bottle overview at
  1440×900 and 390×844. The sampled desktop and mobile overview loads recorded
  CLS 0. These are local mock-data checks, not production performance claims.
- Three additional local `/api/stats` requests returned identical data with no
  extra upstream stats read.
- Server/web typechecks, focused lint, formatting, and `git diff --check` pass.
  The full repository test suite remains a PR CI gate.

No deployment or production cache-hit improvement is claimed. Image optimization
is optional future work and requires a cost/benefit assessment. No new lint rules
or infrastructure settings are required for this change.
