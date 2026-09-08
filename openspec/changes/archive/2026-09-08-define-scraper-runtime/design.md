## Context

Peated currently treats a scraper as a worker function. Most retailer adapters
call `getUrl`, which combines an 18-hour process-local disk cache with an Axios
GET, while a few adapters call Axios directly. `scrapePrices` owns pagination
and batching, but there is no common request budget, host allowlist, request
spacing, response bound, robots decision, or `Retry-After` behavior. All jobs
also share the default BullMQ queue.

That structure has two different domain concepts mixed together:

- An external source is a Peated integration and owns schedule, extraction,
  cursor semantics, and ingestion.
- A scrape target is a remote operator whose origins share traffic capacity,
  cooldowns, and robots policy. Several Peated sources can share one target,
  and one source can use several targets.

The runtime must coordinate across worker processes, remain inspectable after a
restart, and avoid persisting fetched publisher content. Peated's request
volume is low enough that PostgreSQL row coordination is simpler than adding a
second distributed state mechanism.

## Goals / Non-Goals

**Goals:**

- Give every scraper one narrow, testable adapter contract.
- Bound network work and pagination even when an adapter contains a bug.
- Coordinate spacing, concurrency, quotas, and server-directed cooldowns by
  remote target across all Peated workers.
- Make long waits resumable durable work rather than sleeping worker tasks.
- Enforce explicit origins, redirects, robots decisions, timeouts, response
  sizes, and a stable identifying user agent.
- Keep response bodies transient and telemetry bounded.
- Migrate existing scrapers without changing their parsed product or review
  behavior unnecessarily.

**Non-Goals:**

- A generalized crawler, URL frontier, link-discovery engine, or browser farm.
- Proxy rotation, user-agent rotation, CAPTCHA avoidance, or access-control
  evasion.
- A moderator UI for changing traffic limits or arbitrary target registration.
- Per-request database history, response-body persistence, or a shared response
  cache.
- Exactly-once remote requests. Ingestion remains idempotent because a worker
  can fail after a response but before its cursor checkpoint.
- Moving image capture, webhooks, geocoding, or other non-scraper HTTP traffic
  into this module during the initial migration.

## Decisions

### Isolate the runtime under one module

Create `apps/server/src/scraper/` with these owned concerns:

- `definitions`: strict code-owned source, target, and origin definitions
- `runs`: durable run claiming, checkpoints, deferral, completion, and recovery
- `coordinator`: SQL permits, leases, spacing, quotas, and cooldowns
- `session`: the adapter-facing request, emit, and checkpoint capabilities
- `http`: redirects, headers, timeouts, response limits, and retry translation
- `robots`: fetching, parsing, caching, and evaluating origin rules
- `adapters`: source-specific discovery and parsing

Worker routes and schedules may queue a run id, but they do not call adapter or
HTTP implementation details. Product ingestion remains in narrow source-owned
sinks registered with an adapter, so the scraper runtime does not absorb Bottle
or price business rules.

Alternative considered: add retries and sleeps to `getUrl`. This leaves direct
Axios calls, cross-worker coordination, request budgets, and resumable work
unsolved while making a legacy cache helper more important.

### Keep one public lifecycle boundary

The scraper module owns creation, dispatch state, stale-run reconciliation,
claiming, deferral, completion, and failure for `external_site_run`. API routes,
schedules, and BullMQ handlers call lifecycle capabilities exported from the
module root; they do not mutate run state or import coordinator, HTTP, robots,
session, registry, or adapter modules directly. Queue publication remains an
injected server capability because BullMQ is owned by the worker layer.

Core execution accepts a registry explicitly and has no dependency on the
production source composition. The module root composes the registered sources
with the core runtime for production. This keeps coordinator, HTTP, robots,
session, and run state testable without importing worker jobs or product
persistence code.

Legacy source implementations live under an explicit `adapters/legacy`
boundary while they still use the compatibility request and pagination bridge.
Repository checks inspect both native and legacy registered source code. Native
adapters may use only their injected session; legacy adapters may use only the
reviewed compatibility bridge and may not import raw network, queue, database,
or product-persistence clients. The compatibility boundary is removed once the
last legacy source accepts `ScraperSession` directly.

Alternative considered: a broad barrel that re-exports every runtime helper.
That makes internal mechanisms callable by unrelated server code and spreads
production composition dependencies into code that should use only lifecycle
capabilities.

### Model source, target, and origin separately

A source definition identifies one `external_site`, its adapter, cursor schema,
run request limit, and ingestion sink. A scrape target is a stable traffic key
such as `whiskyadvocate`; it owns one shared request policy. An origin is an
exact normalized scheme, hostname, and optional port allowed for that target.

Definitions explicitly map sources to targets and targets to origins. The
runtime does not infer ownership from an effective top-level domain: `www` and
`api` hosts share capacity only when the definition says they do. Redirects are
evaluated at every hop and cannot escape the configured origins.

Alternative considered: key limits directly by hostname or registrable domain.
Hostname keys fail to share capacity across an operator's hosts, while automatic
registrable-domain grouping incorrectly combines independently operated
services. Explicit traffic groups are small and reviewable.

### Persist small coordination state in PostgreSQL

Sync code-owned definitions into three runtime-owned tables:

- `scrape_target`: stable key, enabled state, effective spacing and fixed-window
  quota, next allowed request time, shared cooldown, rate-limit streak, and the
  current short request lease
- `scrape_origin`: exact origin, target relationship, robots mode, and cached
  parsed robots state with fetch/expiry timestamps
- `external_site_scrape_target`: the explicit source-to-target relationship

Extend the existing external-site run state with a snapshotted request limit,
a current-slice request count, lifetime request/retry/rate-limit counts, a
validated continuation cursor, and the next eligible dispatch time. A run is
the durable owner of resumable work; each execution slice is bounded by the
snapshotted limit, and a target is the durable owner of remote traffic state.

The coordinator acquires a permit in a short transaction that locks one target
row. It refuses the permit when the target is disabled, leased, cooling down,
too close to its last permit, or out of quota. A granted permit increments the
target window, current-slice, and lifetime run request counters, advances
`nextRequestAt`, and writes a lease token with an expiry longer than the request
timeout. Network I/O never occurs inside a database transaction. Completion
clears only the matching lease; a crashed worker's lease expires safely.

Every network attempt, including a retry and robots refresh, consumes a permit
and the current execution-slice budget. SQL or coordination failure fails
closed before network access. The runtime stores aggregates and current
coordination state, not one row per request.

Alternative considered: Redis token buckets. Redis would be faster at high
volume, but Peated's scraper traffic is deliberately low and already needs SQL
run state. One SQL ownership boundary is easier to inspect and recover.

### Use bounded slices with validated cursors

An adapter is defined with a strict cursor schema and receives a `ScraperSession`
containing only:

- `request` for an allowed target and origin
- `emit` for validated source observations
- `checkpoint` after a safely completed page or partition
- remaining run-budget information

The adapter must checkpoint the cursor before requesting the next page. Its
sink must use stable source identity so replaying the last completed slice is
idempotent. When the execution-slice budget is exhausted or the coordinator
returns a long wait, the runtime moves the same run from running back to queued,
persists its cursor and `nextAttemptAt`, and dispatches it later. The next
successful claim resets only the slice counter; lifetime counters remain
monotonic. The active-run uniqueness rule continues to prevent a second run for
that source. A run is terminally failed before an eleventh execution claim or
after 24 hours so a bad cursor or permanent deferral cannot continue forever.

Short spacing waits may remain inside the scraper worker. `Retry-After`, target
quota exhaustion, and other waits longer than the small configured threshold
always defer durable work instead of occupying a worker.

Alternative considered: allow a large run to finish regardless of request
count. That makes a parser or pagination regression capable of generating
unbounded traffic and gives archive ingestion no safe pause point.

### Put scraper work on an isolated queue

External-site runs dispatch to a `scrapers` BullMQ queue. Its worker can process
several different sources concurrently, while SQL target leases keep each
remote operator at one in-flight request. Delays and remote failures therefore
do not block notifications, indexing, or other default-queue work.

BullMQ transports only a validated run id. PostgreSQL remains authoritative for
status, cursor, counters, retry identity, and next dispatch time. Stale-run
reconciliation checks SQL before redispatching the same run id.

Alternative considered: raise concurrency on the default queue. This couples
unrelated jobs to scraper latency and still provides no target-level control.

### Define conservative request behavior in code

The initial default policy is one in-flight request, at least two seconds
between permits, at most 100 attempts per run, and at most 300 attempts per
hour per target. Requests use a stable Peated bot user agent with a public
contact/policy URL, a 30-second timeout, and a 10 MiB response limit.

Targets may declare stricter values. A less restrictive exception must be
explicit in the code-owned definition with a short rationale. Definitions are
strictly parsed during startup and synchronized before scraper workers accept
work.

The HTTP boundary retries only expected transient transport failures and
502/503/504 responses, at most twice, using bounded exponential backoff with
jitter. Each attempt reacquires a permit. It does not retry 400, 401, 403, or 404. A 429, or a 503 with `Retry-After`, updates the target's shared
`blockedUntil` and defers the run. A missing or invalid `Retry-After` uses a
bounded cooldown derived from the target's consecutive rate-limit streak.

Alternative considered: configurable policies in the database. Runtime-editable
limits create an administrative surface before there is a demonstrated need;
code review is the appropriate control for the current number of sources.

### Treat robots and permission as independent restrictions

Public HTML origins require robots evaluation for the stable Peated user agent.
Parsed rules are cached with a bounded expiry in `scrape_origin`; article or
catalog bodies are never stored. A missing robots document permits access, an
explicit disallow refuses it, and an unavailable robots document without a
fresh cached decision defers access rather than guessing.

An origin may be marked `not_applicable` only for a reviewed non-crawler API and
must include a code comment explaining why. Robots can restrict a permitted
source but cannot grant publisher permission. Review content policy is enforced
at its processing and display boundaries.

Alternative considered: treat robots as the review content policy. Robots
describes automated access preferences, not display or LLM processing.

### Keep fetched content transient and telemetry bounded

The runtime replaces the process-local response-body disk cache. Adapter
responses remain in memory only and are discarded after parsing. This avoids
persisting publisher articles and removes cross-process cache ambiguity.

Run completion stores request, retry, rate-limit, emitted-item, and duration
counts. Telemetry may include source id, target key, origin, status class,
counts, and bounded error categories. It must not include response bodies,
authorization headers, signed URLs, request bodies, or unrestricted response
headers. Expected deferrals and rate limits are operational events, not Sentry
errors; only terminal unexpected failures reach the worker error boundary.

Alternative considered: persist every request for debugging. Per-request rows
and payloads add retention and privacy obligations without improving the
runtime's correctness contract.

## Risks / Trade-offs

- **SQL coordination adds a write per network attempt** → Deliberately low
  quotas keep volume small; keep transactions short and index target/run keys.
- **A two-second minimum makes large legacy runs slower** → Move scrapers to a
  separate queue and require cursors rather than weakening shared limits.
- **Existing adapters rely on direct Axios behavior** → Migrate source by
  source with recorded request fixtures and prevent bypass only after each
  adapter moves.
- **A worker crashes while holding a target lease** → Use lease tokens and a
  bounded expiry greater than the request timeout; reconciliation never clears
  a newer owner's lease.
- **A cursor checkpoint replays one page after failure** → Require stable
  source keys and idempotent sinks; do not promise exactly-once requests.
- **Robots changes while cached** → Use a bounded expiry and conditional
  refresh metadata; an explicit disallow or unavailable refresh never widens
  access.
- **A source legitimately needs more than the default quota** → Split work with
  a cursor first; document any code-reviewed policy exception.

## Migration Plan

1. Add the scraper module, strict definitions, SQL target/origin state, and
   additive external-site run fields without changing active adapters.
2. Add deterministic coordinator, HTTP, robots, cursor, deferral, and recovery
   tests using fake time and fixture responses.
3. Add the scraper queue and route one fixture-only test adapter through the
   complete runtime.
4. Migrate `getUrl`-based retailer adapters in small groups, preserving their
   parsing fixtures and comparing item counts before and after cutover.
5. Migrate direct-Axios adapters and add a repository check that forbids direct
   Axios or `fetch` imports inside migrated adapter directories.
6. Migrate the external-review adapter with the runtime request controls and
   robots enforcement; do not use persistent response caching for review
   bodies.
7. Remove the legacy disk-cache/fetch path when no registered scraper consumes
   it, then make the new runtime mandatory for scraper registration.
8. Consolidate run lifecycle operations and registered source implementations
   under the scraper module, narrow its public exports, and enforce both native
   and transitional adapter boundaries before merge.

Rollback is per source: its definition can route back to the legacy job while
the additive SQL state remains unused. Once all sources are migrated and the
legacy path is removed, rollback restores the prior application version; no
product records need reconstruction because runtime state is coordination data.

## Open Questions

- Which small existing retailer scraper is the best first production migration
  after the fixture-only adapter?
- Should the public bot policy/contact URL live at `/bot` or under the existing
  documentation site?
