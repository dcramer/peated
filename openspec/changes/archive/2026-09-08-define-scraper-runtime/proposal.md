## Why

Peated's scrapers share pagination and caching helpers, but outbound requests are
not governed by one enforceable contract: adapters can make unbounded requests,
bypass shared HTTP code, and react independently to rate limits. Expanding from
retailer prices into publisher content makes a polite, inspectable request
boundary necessary before adding more sources.

## What Changes

- Add an isolated scraper runtime that owns source registration, bounded runs,
  outbound HTTP, traffic coordination, retries, and safe run outcomes.
- Model a Peated source separately from a remote traffic group and its explicit
  allowed origins, so several adapters sharing an operator also share limits
  and cooldowns.
- Persist small coordination and run state in PostgreSQL, including request
  budgets, continuation cursors, leases, and server-directed cooldowns, without
  storing response bodies or a row for every request.
- Require every scraper adapter to use an injected session instead of importing
  Axios, `fetch`, queue clients, persistence helpers, or rate-limit state.
- Enforce per-execution-slice budgets, one in-flight request per traffic group, minimum
  spacing, rolling quotas, response limits, bounded retries, and `Retry-After`.
- Send long waits back to durable scheduling rather than sleeping in a worker,
  and let bounded runs resume from validated source-owned cursors.
- Migrate existing retailer and review scrapers incrementally while preventing
  newly migrated adapters from bypassing the runtime.
- **BREAKING**: migrated scraper adapter entry points receive a runtime session
  and may no longer perform outbound network requests directly.

## Capabilities

### New Capabilities

- `scraper-runtime`: Domain-aware, SQL-coordinated execution of bounded and
  resumable scraper adapters through one polite outbound-request boundary.

### Modified Capabilities

None.

## Impact

- Introduces a focused scraper module under `apps/server` and additive scraper
  coordination fields or tables in PostgreSQL.
- Changes scraper job registration, adapter signatures, shared fetching,
  pagination, caching, retry handling, and external-site run reporting.
- Moves direct Axios and `fetch` use in scraper adapters behind the new runtime.
- Interacts with the external-review source-permission boundary, which decides
  whether content may be fetched; this runtime independently decides when and
  how the next request may be sent.
