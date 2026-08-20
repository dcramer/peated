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
- `sourcePolicy.ts` owns review-source authorization before queueing and before
  each request;
- `adapters/legacy/` contains migrated source implementations that still use
  the compatibility bridge in `legacy/`;
- native adapters use only their injected session;
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
   cursor and observation schemas, request limit, adapter, and sink. Review
   sources also provide an authorization hook; authorization is checked when a
   run starts and again before every request.
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

## Run outcomes

- `succeeded` means the adapter returned after validated observations and its
  latest cursor were persisted.
- `queued` with `nextAttemptAt` means the same run was durably deferred for a
  budget, spacing, quota, lease, or remote cooldown. It is not a failure.
- `failed` means validation, authorization, robots, configuration, persistence,
  or an unexpected remote failure was terminal for that run. Stored errors are
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
