## ADDED Requirements

### Requirement: Disabled targets cannot create scraper runs

The system MUST reject a manual or scheduled scraper run before creating durable work when any traffic target required by its source is disabled.

#### Scenario: Administrator triggers a disabled scraper

- **WHEN** an administrator requests a manual run for a source with a disabled target
- **THEN** the system SHALL return a conflict that identifies the disabled target and SHALL create no run or queue job

#### Scenario: Scheduler finds a disabled scraper due

- **WHEN** scheduling evaluates a source with a disabled target
- **THEN** the system SHALL create no run or queue job and SHALL continue evaluating other sources

### Requirement: Workers recheck scraper availability

The system MUST recheck code-owned target enablement before adapter or network execution for every claimed run.

#### Scenario: Queued run has a disabled target

- **WHEN** a worker claims an existing run whose required target is disabled
- **THEN** the run SHALL fail with a bounded disabled-target error without executing the adapter or making a network request

### Requirement: Permanent policy failures are not robots deferrals

The system MUST preserve permanent local request-policy failures encountered while refreshing robots rules.

#### Scenario: Robots refresh cannot obtain a request permit

- **WHEN** a robots refresh is refused because the request is invalid under local runtime policy
- **THEN** the system SHALL propagate the permanent failure instead of recording `robots_unavailable` or scheduling a retry

### Requirement: Admin run action reflects scraper availability

The administrator scraper detail SHALL make the manual action unavailable when source registration, synchronized target state, target enablement, or required review authorization prevents a run.

#### Scenario: Target is disabled

- **WHEN** an administrator views a source whose required target is disabled
- **THEN** the run action SHALL be disabled and identify the disabled target

#### Scenario: Target is not synchronized

- **WHEN** an administrator views a registered source whose required target is absent from synchronized runtime state
- **THEN** the run action SHALL be disabled and explain that the target is not synchronized
