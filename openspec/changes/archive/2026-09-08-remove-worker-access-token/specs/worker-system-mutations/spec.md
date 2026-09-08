## ADDED Requirements

### Requirement: Worker-owned mutations do not require a human credential

The system SHALL allow trusted scraper jobs to perform their owned catalog, listing, review, image, and external-site configuration mutations without an `ACCESS_TOKEN` or other user-issued credential.

#### Scenario: Scheduled price scraper persists a batch

- **WHEN** a scheduled scraper discovers a non-empty batch of prices
- **THEN** the worker persists the batch through the internal price ingestion capability without making an authenticated HTTP request

#### Scenario: Worker credential is absent

- **WHEN** the worker starts without `ACCESS_TOKEN`
- **THEN** scraper persistence remains enabled rather than silently switching to dry-run mode

### Requirement: Automated writes have system attribution

The system MUST attribute automated catalog and alias mutations to the durable Peated system actor.

#### Scenario: Scraper creates catalog data

- **WHEN** a trusted scraper creates a Bottle, entity, series, alias, listing, or review assignment
- **THEN** the persisted actor attribution identifies the Peated system actor rather than a human administrator

### Requirement: HTTP behavior remains user-authorized

The system SHALL preserve the existing authorization, validation, error, and response behavior of HTTP mutation routes while delegating persistence to shared internal capabilities.

#### Scenario: API client creates external prices

- **WHEN** an authenticated administrator calls the existing price batch endpoint
- **THEN** the route performs its existing administrator authorization and persists through the same price ingestion capability used by the worker

### Requirement: System authority is capability-scoped

The system MUST expose only narrowly named worker mutation capabilities and MUST NOT provide the worker with a general administrator principal or unrestricted API credential.

#### Scenario: Queue job executes a scraper mutation

- **WHEN** a scraper job invokes a system mutation
- **THEN** the invoked function derives the Peated system actor internally and accepts only the domain input for that operation

### Requirement: Dry-run execution is explicit

The system SHALL require callers to explicitly select dry-run behavior when they do not want scraper results persisted.

#### Scenario: Local dry-run

- **WHEN** a scraper is invoked with its dry-run option enabled
- **THEN** it logs discovered data without invoking persistence capabilities
