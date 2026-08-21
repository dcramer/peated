# Scraper Runtime

This module owns Peated's outbound scraper boundary. It keeps four concerns
separate:

- definitions say which Peated source may use which remote target and origin;
- runs own bounded, resumable source work;
- coordination and HTTP own when and how remote requests happen;
- adapters parse responses and emit source observations through an injected
  session.

Code outside this module uses `index.ts` to initialize, queue, or execute a
durable run. It must not call adapters, target coordination, robots, or scraper
HTTP internals directly. The internal layout keeps those ownership boundaries
visible:

- `lifecycle.ts` owns durable run creation and dispatch through injected
  registry and queue capabilities;
- `runs.ts`, `session.ts`, `http.ts`, `robots.ts`, and `coordinator.ts` own core
  execution without importing production registry or worker infrastructure;
- `registry.ts` is the production composition root;
- `adapters/legacy/` contains migrated source implementations that still use
  the compatibility bridge in `legacy/`;
- native adapters use only their injected session;
- `adapters/dates.ts` parses common publisher date formats;
- `adapters/currentReviews.ts` owns the repeated current-review cursor,
  request, emit, ignore, and checkpoint lifecycle;
- `sinks/` is the narrow boundary to Peated domain persistence.

Registered source implementations must not import raw HTTP, queue, database,
or product persistence clients. Boundary tests inspect the sources composed by
the production registry, rather than only the top level of `adapters/`.

External review sources must also follow the
[external review indexing procedure](../../../../docs/features/external-review-indexing.md).
It owns source policy, transient content, pilot review, and rollback.

## Registering a source

1. Define a target in `registry.ts`. A target represents one remote operator's
   shared traffic capacity, not necessarily one hostname. Declare every exact
   origin it may use and either enforce robots or record why robots do not
   apply.
2. Define the source with its external-site type, allowed target keys, strict
   cursor and observation schemas, request limit, adapter, and sink.
3. Make the adapter use only its injected session. Checkpoint after a page or
   partition is safely emitted, before requesting the next one. A cursor must
   describe the next safe work and remain valid if the prior page is replayed.
4. Give every observation a stable source key. The sink owns product or review
   persistence and must safely accept a replay after a worker loses ownership
   between emit and checkpoint.
5. Synchronize definitions before accepting scraper work. Production dispatch
   has one entry point: the `RunScraper` job with a run id.

Existing retailer sources may use `legacy/scraper.ts` only from
`adapters/legacy/`. That bridge translates their old helper calls into the
active scraper session; new sources must not use it. Remove a legacy source's
bridge dependency when converting it to a native adapter, then move it out of
`adapters/legacy/`.

Use the same target for multiple sources only when they share a remote
operator's capacity. Use multiple exact origins under that target when one
operator intentionally serves an integration from several hosts. Never infer
this grouping from a registrable domain. Stricter limits need no exception;
less restrictive spacing, window, or quota requires a reviewed rationale in
the code-owned definition.

## Source acceptance rules

Every new or changed source must satisfy this contract. Prove a rule at the
listed owner. Do not repeat a runtime test in every adapter.

| Rule                                                                                                                                                                                            | Owner and proof                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The source requests only its declared targets and exact origins.                                                                                                                                | The registry owns the declaration. Definition and boundary tests prove it.                                                                                                   |
| Discovery is bounded. The adapter does not become a generic crawler.                                                                                                                            | The adapter owns its exact entry points and maximum pages or items. A fixture test proves the bound.                                                                         |
| Every request uses the injected session. Robots, spacing, quotas, retries, response limits, and `429` cooldowns stay active.                                                                    | The runtime owns request control. Boundary and HTTP tests prove it.                                                                                                          |
| The configured limits let a run complete or make durable progress. Discovery plus the first work request must fit before a quota or slice boundary. Request spacing must not restart discovery. | The registry owns limits. A registered runtime test proves completion or a cursor advance.                                                                                   |
| A cursor is strict and describes the next safe work. The adapter emits before it checkpoints. A replay is safe.                                                                                 | The adapter owns progress. Fixture tests prove resume, replay, and failed emit or parse behavior.                                                                            |
| Observation keys are stable across runs. They are unique within their storage scope.                                                                                                            | The adapter owns source identity. Parser tests prove stable keys, multi-item keys, and known collision cases.                                                                |
| Parsed output uses the registered strict schema. Product writes happen only in the registered sink.                                                                                             | The session and registry own validation and sink selection. Registry and sink tests prove it.                                                                                |
| Expected remote deferrals remain non-terminal. Unexpected markup, validation, and persistence failures fail the run.                                                                            | The runtime owns deferrals. The adapter owns the difference between an expected non-item and malformed source data.                                                          |
| A source change passes deterministic fixtures and one local acceptance run against the current public source.                                                                                   | The source author runs the registered adapter through the local runtime and inspects the run, cursor, request count, and emitted observations. Live checks do not run in CI. |
| The first production run is checked in Admin → Scrapers and Sentry.                                                                                                                             | The source author confirms status, counts, cursor progress, robots state, and any terminal error.                                                                            |

Keep source-specific facts in the adapter tests and the owning feature or
research document. Update a fixture when the publisher changes markup. Do not
weaken a shared schema or runtime rule to accept one malformed page.

## Run outcomes

- `succeeded` means the adapter returned after validated observations and its
  latest cursor were persisted.
- `queued` with `nextAttemptAt` means the same run was durably deferred for a
  budget, spacing, quota, lease, or remote cooldown. It is not a failure.
- `failed` means validation, robots, configuration, persistence, or an
  unexpected remote failure was terminal for that run. Stored errors are
  bounded; detailed unexpected failures belong in Sentry.

`sliceRequestCount` resets when a deferred run is reclaimed. `requestCount`,
retry counts, rate-limit counts, and emitted-item counts are lifetime run
aggregates. Every network attempt, including robots refreshes and retries,
requires a SQL permit and consumes the current slice budget. Response bodies
are streamed within the configured bound and are never stored by the runtime.

A run may be claimed for at most ten execution slices and may remain active for
at most 24 hours. The claim boundary fails older work before another adapter or
network execution so a bad cursor or permanent deferral cannot live forever.

## Bot identity

Outbound requests identify as `PeatedBot/1.0 (+https://peated.com/bot)`. The
public page explains Peated's purpose, request controls, and contact path. Do
not replace it with a browser identity or add credential/cookie forwarding.
