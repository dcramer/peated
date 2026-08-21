## ADDED Requirements

### Requirement: Administrators can see useful source inventory

The system SHALL report visible review and price-listing inventory separately for each external source, including matched and unmatched counts, and SHALL present the existing aggregate catalog coverage on the scraper administration surface.

#### Scenario: Review-only source has imported reviews

- **WHEN** an administrator views a source with visible reviews and no price listings
- **THEN** the source SHALL show its review total and match coverage without representing the source as empty

#### Scenario: Administrator views aggregate coverage

- **WHEN** an administrator opens the scraper list
- **THEN** the page SHALL show active Bottle content coverage and global review and price-listing match coverage using the existing administrator coverage contract

### Requirement: Administrators can inspect responsible-request telemetry

The system SHALL expose the existing request budget, request, retry, rate-limit, emitted-item, deferral, attempt, duration, and terminal outcome fields for recent scraper runs.

#### Scenario: Run succeeds after making requests

- **WHEN** an administrator views a completed scraper run
- **THEN** its history SHALL show the requests made, retries and rate limits encountered, observations emitted, attempts, duration, and succeeded status

#### Scenario: Run is deferred

- **WHEN** a queued scraper run has a next-attempt time
- **THEN** its history SHALL distinguish the deferral from failure and show when it is eligible to continue

#### Scenario: Run fails safely

- **WHEN** a scraper run fails
- **THEN** its history SHALL show the bounded stored failure summary without exposing unrestricted exception data

### Requirement: Administrators can inspect source readiness

The system SHALL show whether a source is registered, whether each synchronized
traffic target is enabled or cooling down, the cached robots status for each
active origin, and the content policy for a review source.

#### Scenario: Target is disabled

- **WHEN** a registered source maps to a disabled traffic target
- **THEN** the source detail SHALL identify that target as disabled rather than implying the scraper can run

#### Scenario: Robots rules have not been fetched

- **WHEN** an enforced origin has no cached robots decision
- **THEN** the source detail SHALL show its robots state as unknown

#### Scenario: Review source lacks fetching permission

- **WHEN** a registered source requires review authorization and its policy does not allow fetching
- **THEN** the source detail SHALL show that fetching is blocked by policy and the manual action SHALL retain the existing server-side authorization enforcement

### Requirement: Operational state remains read-only

The scraper administration surface SHALL require administrator access and SHALL NOT provide controls for editing code-owned source registration, traffic policies, robots state, or review-source permissions.

#### Scenario: Administrator inspects runtime state

- **WHEN** an administrator views target, origin, or policy state
- **THEN** the interface SHALL provide inspection and existing run controls only

#### Scenario: Non-administrator requests operational state

- **WHEN** an anonymous or non-administrator requests the extended health or run contracts
- **THEN** the system SHALL reject the request
