## 1. Runtime Contracts

- [x] 1.1 Create the isolated `apps/server/src/scraper/` module with explicit public exports and an ownership note covering definitions, runs, coordination, sessions, HTTP, robots, and adapters
- [x] 1.2 Define strict code-owned schemas for sources, traffic targets, exact origins, request policies, and cursor registrations
- [x] 1.3 Define the narrow adapter and sink contracts for request, emit, checkpoint, stable source identity, and remaining-budget access
- [x] 1.4 Add definition validation tests for shared targets, multiple origins, stricter policies, reviewed exceptions, undeclared origins, and unknown fields

## 2. Durable State

- [x] 2.1 Add the target, origin, and source-to-target schema with constraints for exact normalized origins, lease identity, cooldowns, spacing, and fixed-window quota state
- [x] 2.2 Extend external-site runs with snapshotted slice request limits, current-slice and lifetime counters, validated continuation cursors, and next-attempt time while preserving the active-run uniqueness rule
- [x] 2.3 Generate and inspect the additive database migration rather than hand-writing SQL
- [x] 2.4 Synchronize valid code-owned definitions idempotently at scraper-worker startup and fail before accepting work when synchronization or validation fails
- [x] 2.5 Add focused schema and synchronization tests, including safe handling of a removed or disabled definition without deleting coordination history

## 3. Target Coordinator

- [x] 3.1 Implement the short PostgreSQL permit transaction that locks one target, checks the run budget and target state, grants a tokenized lease, advances spacing and quota state, and commits before network access
- [x] 3.2 Implement matching-token lease release and bounded lease expiry so stale workers cannot clear newer leases
- [x] 3.3 Implement typed no-network outcomes for disabled targets, active leases, spacing waits, exhausted windows, shared cooldowns, exhausted run budgets, and SQL failures
- [x] 3.4 Implement shared `Retry-After` and bounded rate-limit-streak cooldown updates without holding a transaction during a wait
- [x] 3.5 Add fake-clock and concurrent integration tests for single-flight behavior, spacing, quotas, request accounting, cooldown sharing, crash expiry, stale release, and fail-closed database errors

## 4. HTTP And Robots Boundary

- [x] 4.1 Implement one streaming HTTP boundary with the stable Peated user agent, safe source headers, exact-origin checks on every redirect, a 30-second timeout, and a 10 MiB response limit
- [x] 4.2 Implement typed response and transport outcomes with at most two jittered retries for eligible transient failures, reacquiring a permit and consuming run budget for every attempt
- [x] 4.3 Parse delta-seconds and HTTP-date `Retry-After` values and turn 429 or applicable 503 responses into shared durable deferrals
- [x] 4.4 Implement exact-origin robots retrieval, parsing, bounded SQL caching, missing-file behavior, fail-closed unavailable behavior, and reviewed `not_applicable` mode
- [x] 4.5 Add fixture-driven HTTP and robots tests for redirects, undeclared origins, timeouts, oversized and streamed responses, permanent statuses, transient retries, invalid `Retry-After`, disallowed paths, stale rules, and robots fetch accounting
- [x] 4.6 Verify request and failure diagnostics redact credentials, signed query values, request and response bodies, and unrestricted headers, and never persist fetched page content

## 5. Bounded Run Execution

- [x] 5.1 Implement durable run claiming, strict cursor parsing, checkpoints, counters, completion, terminal failure, deferral, and stale-run reconciliation around one authoritative run id
- [x] 5.2 Implement `ScraperSession` so adapters can only request declared targets, emit validated observations through their registered sink, checkpoint safe progress, and inspect remaining budget
- [x] 5.3 Add the dedicated `scrapers` BullMQ queue with run-id-only payloads and dispatch rules that treat PostgreSQL as authoritative
- [x] 5.4 Defer long target waits by persisting `nextAttemptAt` and redispatching the same run instead of sleeping in a worker; keep only short spacing waits in process
- [x] 5.5 Add a fixture-only adapter and idempotent sink to test complete execution, cursor replay, duplicate queue delivery, budget exhaustion, deferral, and recovery
- [x] 5.6 Record only bounded run aggregates and operational deferrals, allowing unexpected terminal failures to reach the worker error boundary without reporting expected rate limits to Sentry

## 6. Incremental Adapter Migration

- [x] 6.1 Inventory every scraper HTTP entry point, source-to-origin mapping, pagination shape, and current fixture/item-count baseline, including direct Axios and `fetch` bypasses
- [x] 6.2 Migrate one small retailer source through the runtime and compare its request fixtures, parsed observations, item counts, limits, and failure behavior before switching its registration
- [x] 6.3 Migrate the remaining legacy-helper adapters in reviewable groups based on their shared pagination or provider behavior
- [x] 6.4 Migrate direct-HTTP adapters and add a repository check preventing raw HTTP clients, queues, database clients, or product persistence imports in runtime-managed adapter directories
- [x] 6.5 Connect external-review adapters through the same target, request, and robots controls as other sources
- [x] 6.6 Remove the legacy response-body disk cache and fetch path only after no registered scraper consumes them, then require runtime registration for every scraper adapter

## 7. Documentation And Verification

- [x] 7.1 Document how to register a source, choose shared traffic targets, declare origins and policy exceptions, design a replay-safe cursor and sink, and interpret run outcomes
- [x] 7.2 Document the stable bot identity and public contact/policy URL before production requests use the runtime
- [x] 7.3 Run targeted coordinator, HTTP, robots, run-lifecycle, queue, and migrated-adapter tests plus server typecheck, lint, formatting, and migration checks
- [x] 7.4 Exercise the fixture adapter and first migrated source through manual QA, confirming bounded requests, visible counters, durable deferral, shared cooldown, and no persisted response content
- [x] 7.5 Run strict OpenSpec validation and use pull request CI as the required full-repository test gate

## 8. Encapsulation Correction

- [x] 8.1 Move scraper run creation, dispatch-failure handling, and stale-run reconciliation into the scraper-owned lifecycle module
- [x] 8.2 Move every registered legacy source implementation and its fixture tests under an explicit `scraper/adapters/legacy` boundary
- [x] 8.3 Narrow the scraper module root to lifecycle capabilities and public result/error contracts while requiring core execution to receive registry state explicitly
- [x] 8.4 Strengthen repository checks so native and legacy registered adapters cannot bypass their allowed dependency boundaries
- [x] 8.5 Update module documentation and run targeted tests, server typecheck, lint, formatting, Knip, and strict OpenSpec validation
