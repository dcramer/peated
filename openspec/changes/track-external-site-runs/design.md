## Context

`external_site.last_run_at` is currently written when the scheduler dispatches a job and when an individual external review is persisted. Neither write proves that a scraper started or completed. BullMQ state and Sentry telemetry are operational aids, but they are not retained product state and cannot provide reliable administrator history.

External sites already own `runEvery` and `nextRunAt`, while scraper jobs run in the trusted server worker and perform idempotent catalog, listing, and review writes. The change must keep those authority boundaries explicit and must not make administrators infer execution health from listing timestamps.

## Goals / Non-Goals

**Goals:**

- Persist one durable record per scheduled or manual scraper attempt before queue dispatch.
- Make one server module own queued, running, succeeded, and failed state transitions.
- Keep `lastRunAt` as a materialized summary whose sole meaning is the completion time of the latest terminal run.
- Prevent concurrent active runs for the same external site.
- Correlate failures with a run id while preserving BullMQ and Sentry error ownership.
- Give administrators factual current status, last success context, listing totals, and recent run history.

**Non-Goals:**

- Building a generic background-job history system.
- Persisting every scraped item or full third-party responses in a run record.
- Automatically judging a run unhealthy from historical item-count variance.
- Adding a new retry policy for whole scraper jobs.
- Treating downstream image capture or bottle-resolution jobs as part of scraper completion.

## Decisions

### Durable runs are authoritative; site timestamps are summaries

Add `external_site_run` with site, status, trigger, requesting user, attempt count, item count, bounded error summary, and lifecycle timestamps. A partial unique index allows only one queued or running row per site. Recent and successful runs are derived from this table.

`external_site.last_run_at` remains as an inexpensive completion-time cache, paired with `last_run_id` so readers can distinguish new values from ambiguous legacy timestamps. Only terminal run transitions update both fields in the same transaction as the authoritative run. `runEvery` and `nextRunAt` continue to own scheduling only.

Alternative: add several status and error columns directly to `external_site`. Rejected because it loses history, makes overlapping completion ordering unsafe, and turns one configuration row into a workflow state machine.

Alternative: read BullMQ job history. Rejected because Redis retention is not the product contract and queue records do not own manual attribution or materialized site state.

### One capability owns creation, dispatch, and execution transitions

Add a narrow external-site-run module that creates scheduled or manual runs, queues the existing site-specific job with a strict `{ runId }` payload, and executes a scraper inside the durable lifecycle. Registry entries bind each job name to its fixed site and scraper function; queue payloads cannot choose a site or actor.

The worker atomically claims a queued run, records `startedAt`, increments attempts, and invokes the scraper. It records success only after all authoritative scraper writes return. On failure it records a safe summary and completion time, then rethrows so the existing worker boundary reports the terminal error once.

The scheduler also redispatches stale queued or running rows with the same deterministic job id before creating new runs. Existing waiting or active BullMQ jobs deduplicate that delivery; failed queue records are removable so a later reconciliation can redeliver work whose durable terminal update did not complete. A reconciliation dispatch error preserves the active row for the next scheduler pass and still fails the cron boundary.

Alternative: update run state from BullMQ `active`, `completed`, and `failed` callbacks. Rejected because it spreads one lifecycle invariant across queue observers and can miss application-level context.

### Scheduled and manual triggers share dispatch but not schedule semantics

The scheduler locks and claims each due site, creates a scheduled run, and advances `nextRunAt` in the same transaction. It dispatches after commit with a deterministic BullMQ job id based on the run id. Confirmed dispatch failure marks the run failed, materializes `lastRunAt`, and makes the site immediately eligible for the next scheduler pass.

The administrator trigger route creates a manual run with `requestedById` and returns its summary. Manual runs do not move `nextRunAt`. Both paths reject an overlapping queued or running run through the same database invariant.

### Run item count is reported by the scraper contract

Production scraper entry points return the number of accepted source items observed during that run. Multi-section scrapers sum their sections. A price scraper continues to treat zero products as failure; a review scraper may explicitly return zero when there is no new issue to process. Run health remains based on completion or failure, not on a generic count threshold.

### Operational details remain administrator-only

Add protected administrator summaries and recent-run endpoints. The list summary includes listing count, latest run, and last successful completion. Recent history includes bounded failure summaries but no stack traces, credentials, provider bodies, or unrestricted error data. Sentry scope receives the site and run id for deeper diagnosis.

The admin list uses a single `Status` concept: queued, running, succeeded, failed, disabled, or never recorded. A failed status may include last-success context. The detail page shows recent attempts, duration, trigger, count, and failure summary.

## Risks / Trade-offs

- [A worker exits after partial idempotent writes] → BullMQ stalled delivery reuses the same deterministic run; a terminal run delivery is a no-op and a running delivery increments attempts before retrying.
- [A dispatch succeeds but its response is lost] → The deterministic BullMQ job id prevents duplicate jobs; a subsequent scheduler pass creates a new run only after the prior run is terminal.
- [Dispatch and terminal cleanup both fail, or the process exits between persistence and enqueue] → The scheduler redispatches stale active rows using the same run and deterministic queue identity.
- [A provider error contains sensitive data] → Persist only a bounded allowlisted summary; keep full exceptions in Sentry under the run id context.
- [Existing `lastRunAt` values look like valid completions] → Treat the cache as valid only when `lastRunId` references a durable terminal run; legacy rows have no pointer and display as never recorded.
- [Run history grows indefinitely] → Summary-only hourly rows are small at current scale; retention is deferred until measured need exists.

## Migration Plan

1. Add the run status/trigger enums, `external_site_run` table, indexes, and `external_site.last_run_id` cache pointer.
2. Add lifecycle and dispatch capabilities plus strict queue payload parsing.
3. Move scheduled and manual dispatch to durable runs, then wrap all scraper registry entries.
4. Remove unrelated `lastRunAt` writes and expose protected health/history routes.
5. Update administrator surfaces and verify scheduled, manual, successful, failed, and overlapping behavior.

Rollback restores the previous scheduler and trigger code. The additive run table can remain unused; `lastRunAt` can be repopulated only after choosing an explicit rollback meaning.

## Open Questions

None.
