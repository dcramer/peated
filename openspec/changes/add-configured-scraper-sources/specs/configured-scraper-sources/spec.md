## ADDED Requirements

### Requirement: Administrators can create governed sources

The system SHALL let a moderator create an external site with a bounded slug,
name, exact HTTP origin, starting URL, conservative request policy, and robots
enforcement. A new site and its configured scrapers MUST start disabled.

#### Scenario: Moderator creates a review publisher

- **WHEN** a moderator submits a valid new site and chooses review collection
- **THEN** the system stores the site, its admin-owned target and origin, and a disabled review scraper without requiring a deployment

#### Scenario: Generated config attempts to change network access

- **WHEN** an LLM-generated config contains an origin, credential, request limit, or header
- **THEN** strict config validation rejects the complete candidate

### Requirement: Each source has one collection type

The system SHALL support `reviews` and `store_prices` as explicit configured
scraper collection types. Each external site SHALL own at most one configured
scraper with its own enablement, LLM permission, and active config.

#### Scenario: Moderator chooses a collection

- **WHEN** a moderator creates a source and chooses reviews or store prices
- **THEN** that source retains its own config versions and active version

### Requirement: Config versions are immutable and explicit

The system SHALL store each config change as a new immutable version and SHALL
use one active version per site and collection type. Every configured scraper
run MUST record the exact version that it uses.

#### Scenario: Draft is edited

- **WHEN** a moderator or LLM changes a draft config
- **THEN** the system creates a new version and leaves the earlier version unchanged

#### Scenario: Active config changes during a run

- **WHEN** a moderator activates another version while a run is queued or running
- **THEN** that run continues to use the version recorded when it was created

### Requirement: Preview uses production parsing

The system SHALL preview a draft with the same interpreter, validator, request
controls, and output schema used by production collection. Preview MUST NOT
write reviews or store prices.

#### Scenario: Review draft is previewed

- **WHEN** a moderator previews a review config against current sample pages
- **THEN** the system shows structured articles and reviews, source links, and validation warnings without storing publisher HTML or reviews

#### Scenario: Price draft is previewed

- **WHEN** a moderator previews a store-price config against current sample pages
- **THEN** the system shows structured products, prices, currencies, volumes, source links, and validation warnings without storing store prices

### Requirement: LLM generation creates drafts only

The system SHALL use at most one schema-constrained model call to propose a
config from moderator-selected pages. The model MUST have no tools and MUST NOT
activate a config, change network authority, write products, or publish reviews.

#### Scenario: New source config is generated

- **WHEN** a moderator requests generation for a source that permits LLM processing
- **THEN** the system fetches the bounded samples, validates the model output, stores a draft with model and prompt provenance, and starts normal draft validation

#### Scenario: LLM processing is disabled

- **WHEN** a moderator requests generation for a configured scraper that does not permit LLM processing
- **THEN** the system rejects the request before page content is sent to a model

#### Scenario: Model output is invalid

- **WHEN** the model returns a config that fails the strict schema
- **THEN** the system stores no draft and reports a bounded failure without page content

### Requirement: Activation and rollback require passing validation

The system MUST prevent activation of a config version that has not passed its
latest production validator. Activation and rollback SHALL update only the
active version pointer and SHALL retain all prior versions.

#### Scenario: Passing draft is activated

- **WHEN** a moderator activates a draft whose latest validation passed
- **THEN** the draft becomes active atomically and the previous active version remains in history

#### Scenario: Failed draft is activated

- **WHEN** a moderator tries to activate a draft whose validation failed or is stale
- **THEN** the system rejects activation and leaves the current active version unchanged

#### Scenario: Moderator rolls back

- **WHEN** a moderator activates an older version that passes current validation
- **THEN** new runs use that version and existing runs keep their recorded versions

### Requirement: Configured runs preserve current domain boundaries

The system SHALL run configured sources through the existing scraper session
and SHALL emit only the strict existing review or store-price observation for
the configured collection type.

#### Scenario: Review collection succeeds

- **WHEN** an enabled review scraper completes with valid observations
- **THEN** its normal run sends them to external-review ingestion and that boundary continues to own Bottle matching, source policy, persistence, and publication

#### Scenario: Store-price collection succeeds

- **WHEN** an enabled store-price scraper completes with valid observations
- **THEN** its normal run sends them to store-price ingestion and that boundary continues to own identity, matching, persistence, and product visibility

#### Scenario: Page output fails validation

- **WHEN** a configured page produces missing, contradictory, or invalid required fields
- **THEN** the run fails without partial product writes and the active config remains unchanged

### Requirement: Code-owned and admin-owned sources coexist

The system SHALL preserve existing code-owned scraper definitions and SHALL
prevent definition synchronization from disabling or rewriting admin-owned
targets, origins, and site mappings.

#### Scenario: Runtime definitions synchronize

- **WHEN** application startup synchronizes code-owned scraper definitions
- **THEN** admin-owned configured sites and their enabled state remain unchanged

### Requirement: Admin workflow exposes the full config lifecycle

The Admin Scrapers area SHALL let a moderator add a site, choose a collection
type, generate or enter a draft, preview it, activate it, view version history,
roll back, disable collection, and inspect collection health.

#### Scenario: Existing site needs repair

- **WHEN** a run fails validation for an active config
- **THEN** the site config view identifies the failed collection and offers creation of a repair draft from the failed source pages

### Requirement: Tests match ownership boundaries

The system MUST test config interpretation without database or network access,
test persistence and routes with deterministic integration tests, and test live
model generation only through the separate eval command.

#### Scenario: Deterministic tests run

- **WHEN** the normal test suite executes
- **THEN** it validates config schemas, parsing, validation, permissions, version activation, run pinning, preview isolation, and sinks without calling a hosted model
