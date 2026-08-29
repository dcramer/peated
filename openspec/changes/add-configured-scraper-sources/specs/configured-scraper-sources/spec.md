## ADDED Requirements

### Requirement: Admins can create controlled sources

The system SHALL let an admin create an external site and its first scrape
source with a name, website URL, conservative request policy, and robots
enforcement. The system MUST derive its bounded internal key from the website
hostname and use the website URL as the initial list page. The source MUST
start disabled.

#### Scenario: Admin creates a review source

- **WHEN** an admin submits a valid new site and chooses `review`
- **THEN** the system stores the site, generated internal key, admin-managed network rows, and a disabled review source without a deploy

#### Scenario: Admin uses the default AI setting

- **WHEN** an admin creates a source without changing the AI setting
- **THEN** the source permits AI to suggest its first parsing-rule revision

#### Scenario: Rules try to change network access

- **WHEN** proposed rules contain an origin, credential, header, or robots exception
- **THEN** strict rules validation rejects the complete proposal

### Requirement: Each source has one kind

The system SHALL support `review` and `price` source kinds. A site SHALL own at
most one scrape source. The source SHALL own its kind, enablement, AI permission,
list URL, sample URLs, and revisions.

#### Scenario: An admin chooses a source kind

- **WHEN** an admin creates a site with a review or price source
- **THEN** its source retains that kind across all revisions

#### Scenario: A second source is stored

- **WHEN** code tries to store a second scrape source for one site
- **THEN** the database rejects it

### Requirement: Rule revisions are immutable and explicit

The system SHALL store each rules change as a new immutable revision. Each
revision SHALL pin its list URL and rules version. A source SHALL have at most
one active revision. Each collection or preview run MUST record its exact
source and revision.

#### Scenario: An admin edits rules or the list URL

- **WHEN** an admin saves a change
- **THEN** the system creates a new revision and leaves prior revisions unchanged

#### Scenario: The active revision changes during a run

- **WHEN** an admin activates another revision while a run is queued or running
- **THEN** the run continues with its recorded revision and list URL

### Requirement: Preview uses production parsing

The system SHALL preview a revision with the same parser, validator, request
controls, and output schema used for collection. Preview MUST NOT write reviews
or prices.

#### Scenario: A review revision is previewed

- **WHEN** an admin previews review rules against current pages
- **THEN** the system stores structured article and review fields, source links, and bounded issues without storing HTML or review text

#### Scenario: A price revision is previewed

- **WHEN** an admin previews price rules against current pages
- **THEN** the system stores structured product fields and bounded issues without storing prices as products

### Requirement: AI suggestions create inactive revisions only

The system SHALL allow AI suggestions by default for new sources and permit the
admin to turn them off. It SHALL make at most one AI request to suggest rules
from admin-selected pages. The AI MUST have no tools. It MUST NOT activate a
revision, change network control, or write products.

#### Scenario: AI is allowed

- **WHEN** an admin requests the first suggestion or a repair after the latest test fails
- **THEN** the system fetches the main page, bounded candidates from the same website, and bounded samples, checks that the named supplied list page matches the output, and stores an inactive revision with that list page, the AI model name, and the instructions version

#### Scenario: AI is not allowed

- **WHEN** the source does not permit AI processing
- **THEN** the system rejects the request before it sends page content to the AI provider

#### Scenario: Model output is invalid

- **WHEN** the AI response fails the strict rules schema or uses the wrong kind
- **THEN** the system stores no revision and reports a bounded error without page content

### Requirement: Activation and rollback require a passing test

The system MUST prevent activation of a revision that has not passed its latest
test. Activation and rollback SHALL retain all prior revisions.

#### Scenario: A passing revision is activated

- **WHEN** an admin activates a revision whose latest test passed
- **THEN** it becomes the source's only active revision and the source becomes enabled

#### Scenario: A failed revision is activated

- **WHEN** an admin activates a pending or failed revision
- **THEN** the system rejects activation and keeps the current active revision

#### Scenario: An admin rolls back

- **WHEN** an admin activates an older passing revision
- **THEN** new runs use it and existing runs keep their recorded revisions

### Requirement: Scrape source runs preserve product boundaries

The system SHALL execute scrape sources through the existing scraper session.
Review sources SHALL emit the strict external-review observation. Price sources
SHALL emit the strict store-price observation.

#### Scenario: Review collection succeeds

- **WHEN** an enabled review source emits valid observations
- **THEN** the existing review storage code owns matching, storage, and publication

#### Scenario: Price collection succeeds

- **WHEN** an enabled price source emits valid observations
- **THEN** the existing price storage code owns identity, matching, storage, and visibility

#### Scenario: Parsed output is invalid

- **WHEN** required fields are missing or invalid
- **THEN** the run fails without partial product writes and does not change the active revision

### Requirement: Code-managed and admin-managed sources coexist

The system SHALL preserve existing code source definitions. Startup sync SHALL
not disable or rewrite admin-managed targets, origins, or site mappings.

#### Scenario: Definitions synchronize

- **WHEN** the application synchronizes code source definitions
- **THEN** admin-managed network rows remain unchanged

### Requirement: The admin flow exposes the revision lifecycle

The Admin Scrapers area SHALL let an admin add a site, choose a source kind,
enter rules or request an AI revision, edit the list URL, preview, activate,
view revision history, roll back, pause collection, and inspect health.

#### Scenario: An active source needs repair

- **WHEN** its latest test fails after a page change
- **THEN** the source view shows the failure and permits a repair revision

### Requirement: Tests match ownership boundaries

The system MUST test parsing without database or network access. It MUST test
persistence and runtime behavior with deterministic integration tests. Hosted
AI suggestion quality MUST run only through the eval command.

#### Scenario: Deterministic tests run

- **WHEN** `pnpm test` runs
- **THEN** it tests schemas, parsing, checks, source identity, activation, run pinning, preview isolation, and outputs without hosted AI
