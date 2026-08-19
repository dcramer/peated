## ADDED Requirements

### Requirement: Scraper definitions separate sources from remote traffic

The system SHALL strictly validate code-owned scraper definitions that identify
each Peated source, its adapter and cursor contract, its run request limit, the
remote traffic targets it uses, and the exact origins allowed for each target.
The system MUST NOT infer shared traffic ownership solely from hostnames or
registrable domains.

#### Scenario: Two sources share one remote operator

- **WHEN** two source definitions reference the same traffic target
- **THEN** requests from both sources consume that target's shared spacing,
  concurrency, quota, and cooldown state

#### Scenario: One source uses an API and a separate asset operator

- **WHEN** a source explicitly maps its API and asset origins to different
  traffic targets
- **THEN** each request consumes the policy and state of its configured target

#### Scenario: Definition contains an unknown field or invalid limit

- **WHEN** scraper definitions are synchronized at worker startup
- **THEN** the runtime refuses to start scraper workers until the strict
  definition contract is valid

### Requirement: Scraper adapters use one narrow runtime session

The system SHALL give an adapter only validated request, emit, checkpoint, and
remaining-budget capabilities. A migrated adapter MUST NOT directly use Axios,
`fetch`, queue clients, database clients, or product persistence helpers.

#### Scenario: Adapter requests an approved page

- **WHEN** an adapter asks its session for an origin and path declared by its
  source definition
- **THEN** the session applies authorization, origin, robots, budget,
  coordination, and HTTP rules before any network access

#### Scenario: Adapter requests an undeclared origin

- **WHEN** an adapter requests an origin not mapped to its source and target
- **THEN** the runtime rejects the request without resolving or contacting that
  origin

#### Scenario: Response redirects to an undeclared origin

- **WHEN** any redirect hop targets an origin outside the configured allowlist
- **THEN** the runtime stops following redirects and fails the request safely

### Requirement: PostgreSQL coordinates traffic targets

The system SHALL use runtime-owned PostgreSQL state to coordinate one in-flight
request, minimum request spacing, a fixed-window request quota, and a shared
cooldown for each traffic target across all worker processes. SQL coordination
failure MUST prevent network access.

#### Scenario: Target is ready

- **WHEN** a run with remaining budget requests a target with no active lease,
  cooldown, spacing wait, or exhausted window
- **THEN** one short transaction grants a lease, advances the target timing and
  counters, increments the run attempt count, and commits before network access

#### Scenario: Another worker holds the lease

- **WHEN** a worker requests a target whose unexpired lease belongs to another
  request
- **THEN** the coordinator returns the next eligible time without sending a
  concurrent request

#### Scenario: Worker crashes while holding a lease

- **WHEN** the lease expiry passes without a matching release
- **THEN** a later worker may claim a new lease without clearing or reusing the
  former lease token

#### Scenario: Request completes under a newer lease

- **WHEN** a stale worker attempts to release a lease after another worker has
  acquired the target
- **THEN** the release leaves the newer lease unchanged

#### Scenario: Target window is exhausted

- **WHEN** the fixed-window request count reaches the configured target quota
- **THEN** the request is deferred until the next window without network access

### Requirement: Every execution slice has a hard request budget

The system SHALL snapshot a positive request limit when a run is created and
MUST count every network attempt in its current execution slice, including
retries and robots refreshes, against that limit. A resumed slice MAY reset its
slice count while the run's lifetime request count remains monotonic. Cache or
parsing work that makes no network request SHALL NOT consume either count.

#### Scenario: Adapter pagination is unbounded

- **WHEN** an adapter asks for another page after consuming the run request
  limit
- **THEN** the runtime refuses the request, persists the latest safe cursor, and
  defers the same run rather than exceeding the limit

#### Scenario: Retry consumes the last permit

- **WHEN** a transient response is eligible for retry but the first attempt
  consumed the remaining run budget
- **THEN** the runtime defers without making the retry

#### Scenario: Run is manually triggered

- **WHEN** a moderator manually triggers a source
- **THEN** the manual run receives the same source request limit and remote
  target coordination as a scheduled run

### Requirement: Scraper runs are bounded and resumable

The system SHALL persist a source-owned continuation cursor, parse it with the
adapter's strict cursor schema, and keep one authoritative active run identity
across execution slices, retries, deferrals, and stale-run recovery. The system
MUST fail a run before an eleventh execution claim or after 24 hours.

#### Scenario: Page completes safely

- **WHEN** an adapter finishes emitting one page or partition
- **THEN** it checkpoints the cursor needed to continue before requesting the
  next page

#### Scenario: Work must wait beyond the short in-worker threshold

- **WHEN** target spacing, quota, or server cooldown requires a long wait
- **THEN** the runtime returns the run to queued state with `nextAttemptAt` and
  later dispatches the same run id without sleeping in a worker

#### Scenario: Worker fails after ingestion but before checkpoint

- **WHEN** a replay starts from the prior cursor
- **THEN** stable source identity and the registered idempotent sink prevent
  duplicate product or review records

#### Scenario: Persisted cursor is invalid

- **WHEN** a run's stored cursor fails its registered adapter schema
- **THEN** the run fails before adapter or network execution and retains a safe
  bounded error summary

#### Scenario: Continuation never finishes

- **WHEN** a run reaches its execution-claim or age limit
- **THEN** it fails before another adapter or network execution and releases the
  source for a later run

### Requirement: HTTP behavior is polite and bounded

The system SHALL use one stable identifying Peated user agent, target-specific
headers, an explicit timeout, a maximum response size, and code-owned request
policies. The default policy SHALL allow one in-flight request, require at least
two seconds between permits, limit a run to 100 attempts, and limit a target to
300 attempts per hour.

#### Scenario: Response exceeds the byte limit

- **WHEN** response headers or streamed bytes exceed the configured maximum
- **THEN** the runtime aborts the response and reports a bounded terminal
  request error without retaining the response body

#### Scenario: Request exceeds its timeout

- **WHEN** connection or response processing exceeds the configured timeout
- **THEN** the runtime aborts the request and applies only the bounded transient
  retry policy

#### Scenario: Target requires stricter limits

- **WHEN** a target definition specifies a longer delay or lower quota than the
  defaults
- **THEN** the synchronized target uses the stricter effective policy

#### Scenario: Target requests a less restrictive exception

- **WHEN** a target needs a shorter delay or higher quota than the defaults
- **THEN** the code-owned definition includes an explicit reviewed exception
  and rationale rather than accepting a runtime override

### Requirement: Retries and server-directed cooldowns are shared

The system SHALL retry only bounded transient transport failures and 502, 503,
or 504 responses, with at most two retries using exponential backoff and jitter.
Every retry MUST reacquire a target permit. The system MUST NOT retry 400, 401,
403, or 404 responses.

#### Scenario: Server returns 429 with Retry-After

- **WHEN** any source receives a valid `Retry-After` value from a target
- **THEN** the runtime stores the resulting shared target cooldown, releases the
  request lease, and defers the run until that time

#### Scenario: Another source requests the cooling target

- **WHEN** a different source mapped to the same target asks for a request
  before `blockedUntil`
- **THEN** it is deferred without network access

#### Scenario: Rate-limit response has no valid Retry-After

- **WHEN** a target returns 429 without a valid delay
- **THEN** the runtime derives a bounded cooldown from the target's consecutive
  rate-limit streak and does not retry immediately

#### Scenario: Transient retry succeeds

- **WHEN** an eligible transient failure is followed by a successful bounded
  retry
- **THEN** the run continues and records the attempt and retry counts once

#### Scenario: Permanent client response is returned

- **WHEN** the target responds with 401, 403, or 404
- **THEN** the runtime performs no retry and returns the typed source-appropriate
  outcome to the adapter boundary

### Requirement: Robots rules restrict public crawling

The system SHALL evaluate fresh parsed robots rules for the stable Peated user
agent before requesting public HTML. Robots state SHALL be scoped to an exact
origin and cached in SQL with a bounded expiry. Robots decisions MUST only
restrict access and MUST NOT grant source authorization.

#### Scenario: Robots explicitly disallows a path

- **WHEN** fresh rules disallow the requested path for Peated's user agent
- **THEN** the runtime refuses the request without contacting that path

#### Scenario: Robots document is missing

- **WHEN** the origin returns a confirmed not-found response for its robots
  document
- **THEN** the runtime records the bounded decision and permits otherwise
  authorized paths until that decision expires

#### Scenario: Robots refresh is unavailable

- **WHEN** no fresh cached decision exists and the robots document cannot be
  retrieved safely
- **THEN** the runtime defers public-page access instead of assuming permission

#### Scenario: Reviewed API has no robots contract

- **WHEN** an origin is explicitly configured as a non-crawler API with
  `not_applicable` robots mode and a code rationale
- **THEN** the runtime skips robots evaluation while still enforcing every
  traffic and source authorization rule

### Requirement: Publisher permission remains a separate prerequisite

The scraper runtime MUST allow a source-specific authorization boundary to
refuse a run before adapter execution, and it MUST NOT treat target registration
or robots permission as authorization to fetch or use publisher content.

#### Scenario: Review source lacks fetching permission

- **WHEN** a registered review source has a valid target and permissive robots
  rules but its source policy disallows fetching
- **THEN** the run stops before adapter or network execution

#### Scenario: Permission is revoked during a queued wait

- **WHEN** a deferred review run becomes eligible after its source permission
  was revoked
- **THEN** the runtime rechecks authorization and refuses network access

### Requirement: Scraper execution is isolated from general background work

The system SHALL dispatch scraper run ids to a dedicated scraper queue while
keeping PostgreSQL as the authoritative run and coordination state. Scraper
waiting, retries, and remote latency MUST NOT occupy the default job queue.

#### Scenario: Several independent targets are ready

- **WHEN** the scraper queue has runs for different traffic targets
- **THEN** its workers may process them concurrently while each target remains
  subject to its own single-request lease

#### Scenario: Duplicate queue delivery occurs

- **WHEN** the same run id is delivered more than once
- **THEN** durable claiming permits at most one delivery to advance the active
  run

#### Scenario: Queued run becomes stale

- **WHEN** queue delivery is lost or a running lease expires
- **THEN** reconciliation reads durable state and redispatches the same eligible
  run identity rather than creating another run

### Requirement: Fetched content and diagnostics remain bounded

The system MUST keep fetched response bodies in process memory only and MUST
NOT persist article HTML, catalog payloads, request bodies, credentials, or a
row per request. Durable run reporting SHALL contain only bounded counters,
timestamps, cursor state, and safe error categories.

#### Scenario: Article page is parsed successfully

- **WHEN** a review adapter finishes extracting permitted observations
- **THEN** the response body is discarded while only structured observations
  and allowed provenance pass to the source sink

#### Scenario: Provider response causes parsing failure

- **WHEN** an adapter or runtime reports the failure
- **THEN** logs, traces, run errors, and Sentry context exclude the response body,
  request body, authorization headers, signed query values, and unrestricted
  response headers

#### Scenario: Run is deferred by rate limiting

- **WHEN** a target cooldown pauses a run
- **THEN** the runtime records a non-error operational outcome with source,
  target, next-attempt time, and bounded counters without creating a Sentry
  issue

### Requirement: Legacy adapters migrate without a permanent bypass

The system SHALL support source-by-source migration with item-count comparison
and fixture parity, then SHALL prevent direct outbound HTTP from registered
scraper adapter directories before removing the legacy fetch and disk-cache
path.

#### Scenario: Source is not yet migrated

- **WHEN** rollout explicitly leaves an existing source on its legacy job
- **THEN** that source remains distinguishable from runtime-managed sources and
  cannot be mistaken for compliant migration coverage

#### Scenario: Source migration is accepted

- **WHEN** its request fixtures, parsing behavior, item counts, bounded limits,
  and failure behavior pass review
- **THEN** its registration switches atomically to the runtime adapter

#### Scenario: New migrated adapter imports a raw HTTP client

- **WHEN** repository checks inspect runtime-managed adapter code
- **THEN** the check fails before merge

### Requirement: The scraper module owns one explicit lifecycle boundary

The system SHALL keep scraper run creation, dispatch state, reconciliation,
execution, deferral, completion, and failure behind lifecycle capabilities
exported by the scraper module. Core scraper runtime code MUST NOT depend on the
worker queue layer or on production source composition, and server code outside
the module MUST NOT call coordinator, HTTP, robots, session, registry, or
adapter implementation modules directly.

#### Scenario: API or schedule creates scraper work

- **WHEN** an API route or schedule starts or reconciles scraper work
- **THEN** it calls the scraper lifecycle boundary, whose production facade is
  configured with an injected queue capability, and does not mutate scraper
  run state directly

#### Scenario: Worker executes a run

- **WHEN** BullMQ delivers a validated run id
- **THEN** the worker calls the scraper lifecycle boundary while the core run
  executor receives its registered source composition explicitly

#### Scenario: Adapter boundary checks run

- **WHEN** repository checks inspect registered native and legacy source code
- **THEN** native adapters may depend only on the runtime session contract and
  legacy adapters may depend only on their explicit compatibility bridge, with
  neither able to import raw network, queue, database, or product-persistence
  clients
