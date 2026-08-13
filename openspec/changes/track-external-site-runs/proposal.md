## Why

External-site `lastRunAt` currently records unrelated events such as queue dispatch and individual review persistence, so administrators cannot tell whether a scraper actually completed or why it failed. Production scraper health needs a durable execution record whose status is updated by the worker that owns the run.

## What Changes

- Persist one durable run for every scheduled or manually triggered external-site scraper execution.
- Record queued, running, succeeded, and failed lifecycle states with trigger attribution, timestamps, item counts, attempts, and bounded failure summaries.
- Route scheduled and manual scraper dispatch through the same run-owning capability and prevent overlapping active runs for one site.
- Redefine materialized `lastRunAt` as the completion time of the most recently completed scraper attempt while keeping durable runs authoritative.
- Expose administrator-only scraper health summaries and recent run history.
- Show listing totals, factual scraper status, and scheduling information in the admin sites UI.
- Stop review persistence and queue dispatch from masquerading as completed scraper runs.

## Capabilities

### New Capabilities

- `external-site-run-health`: Durable scraper execution lifecycle, scheduling and manual-trigger integration, administrator health summaries, and recent run history.

### Modified Capabilities

None.

## Impact

- Adds an external-site run table and an auditable pointer for the materialized external-site run timestamp through a generated database migration.
- Changes scraper queue payloads and worker registration wrappers in `apps/server`.
- Changes external-site scheduler and manual-trigger behavior, schemas, serializers, and administrator routes.
- Updates the admin sites list and site detail surfaces in `apps/web`.
- Adds focused integration tests for lifecycle transitions, dispatch failures, overlap prevention, summaries, and UI-facing contracts.
