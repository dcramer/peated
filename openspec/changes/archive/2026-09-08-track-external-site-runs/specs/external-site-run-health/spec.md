## ADDED Requirements

### Requirement: Scraper attempts have durable lifecycle state

The system SHALL persist a durable external-site run before dispatching a scheduled or manually requested scraper and SHALL represent its lifecycle as queued, running, succeeded, or failed.

#### Scenario: Scheduled scraper succeeds

- **WHEN** a scheduled scraper is durably queued, starts in a worker, and completes all authoritative writes
- **THEN** its run SHALL record scheduled trigger attribution, start and completion timestamps, attempt count, observed item count, and succeeded status.

#### Scenario: Scraper execution fails

- **WHEN** a scraper throws before completing its authoritative work
- **THEN** its run SHALL record failed status, completion time, and a bounded safe failure summary, and the error SHALL still escape to the worker error boundary.

#### Scenario: Manual scraper is requested

- **WHEN** an administrator requests a scraper run
- **THEN** the system SHALL create a manual run attributed to that administrator before queue dispatch and SHALL return the created run summary.

### Requirement: Materialized site run time has one meaning

The system SHALL define `externalSite.lastRunAt` as the completion time of the durable scraper attempt referenced by `externalSite.lastRunId` and SHALL treat durable run rows as the authoritative history.

#### Scenario: Run reaches a terminal state

- **WHEN** a run succeeds, fails during execution, or fails confirmed queue dispatch
- **THEN** the system SHALL set `lastRunAt` to that run's completion time in the same durable transition.

#### Scenario: Work is only queued or partially persisted

- **WHEN** a scraper is queued, starts, or an individual listing or review is written
- **THEN** the system SHALL NOT update `lastRunAt`.

#### Scenario: Legacy timestamp has no durable run

- **WHEN** durable scraper runs are introduced
- **THEN** the system SHALL treat prior `lastRunAt` values without a `lastRunId` reference as never recorded rather than claiming a completed run.

### Requirement: Active runs do not overlap

The system SHALL prevent more than one queued or running scraper run for the same external site.

#### Scenario: Scheduler encounters an active run

- **WHEN** a site becomes due while its prior run remains queued or running
- **THEN** the scheduler SHALL leave the active run intact and SHALL NOT dispatch another scraper for that site.

#### Scenario: Administrator requests an overlapping run

- **WHEN** an administrator requests a run for a site with a queued or running run
- **THEN** the system SHALL reject the request with conflict information identifying the active state.

#### Scenario: Queue delivery is duplicated

- **WHEN** a terminal run payload is delivered again
- **THEN** the worker SHALL not execute the scraper a second time for that terminal run.

#### Scenario: Active run is left stale across a dispatch boundary

- **WHEN** a queued or running run remains non-terminal after its queue dispatch or durable terminal update is interrupted
- **THEN** a later scheduler pass SHALL redispatch that same run with its deterministic queue identity rather than leaving the site permanently blocked or creating a second run.

#### Scenario: Stale-run redispatch fails

- **WHEN** the queue is still unavailable while a stale active run is being reconciled
- **THEN** the system SHALL preserve that run for a later reconciliation attempt and SHALL report the scheduler failure at the cron boundary.

### Requirement: Scheduling and execution state remain separate

The system SHALL keep `runEvery` and `nextRunAt` as scheduling state and SHALL keep execution status in durable run records.

#### Scenario: Scheduled run is claimed

- **WHEN** the scheduler creates a run for a due enabled site
- **THEN** it SHALL advance `nextRunAt` according to `runEvery` without recording execution success.

#### Scenario: Scheduled dispatch fails

- **WHEN** queue dispatch fails after the run has been persisted
- **THEN** the system SHALL mark that run failed and make the site eligible for a later scheduler pass.

#### Scenario: Manual run is created

- **WHEN** an administrator manually queues a scraper
- **THEN** the system SHALL preserve the site's existing `nextRunAt`.

### Requirement: Administrators can inspect scraper health

The system SHALL provide administrator-only summaries and recent history that distinguish listing inventory from scraper execution health.

#### Scenario: Administrator lists sites

- **WHEN** an administrator opens the external-sites list
- **THEN** each site SHALL show its visible listing count, factual latest run status and timing, last successful completion when relevant, and next scheduled time without using listing-update time as a run proxy.

#### Scenario: Administrator inspects one site

- **WHEN** an administrator opens an external-site detail surface
- **THEN** the system SHALL expose recent run status, trigger, timing, attempts, item count, and bounded failure summary.

#### Scenario: Anonymous caller requests operational details

- **WHEN** an unauthenticated caller requests scraper health or run history
- **THEN** the system SHALL reject access rather than exposing operational failures.

### Requirement: Run telemetry is safely correlated

The system SHALL correlate scraper exceptions with the external site and durable run id without persisting unrestricted exception data.

#### Scenario: Unexpected scraper exception reaches Sentry

- **WHEN** a scraper run fails unexpectedly
- **THEN** the captured worker issue SHALL include the site and run id as safe diagnostic context while the database stores only a bounded summary.
