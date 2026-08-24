## ADDED Requirements

### Requirement: Generic listing titles are never global aliases

The system SHALL NOT create or update a reusable global bottle alias from a listing title marked as not eligible for global alias storage.

#### Scenario: Classifier flags generic label

- **WHEN** a classifier eval fixture uses a listing label that can refer to multiple underlying bottles
- **THEN** the expected decision SHALL include `aliasScope = none`.

#### Scenario: Exact listing has generic title

- **WHEN** source evidence verifies that one exact listing belongs to a bottle or release but the listing title is generic
- **THEN** approval SHALL assign the exact listing without creating a reusable bottle alias from that title.

#### Scenario: Future listing reuses same generic title

- **WHEN** a future listing has the same generic title but different or missing source identity
- **THEN** the system SHALL NOT inherit the prior listing's bottle assignment through global alias matching.

#### Scenario: Same generic title appears at multiple stores

- **WHEN** two stores list the same generic title and the listings refer to different underlying bottles
- **THEN** approval of one listing SHALL NOT create alias behavior that assigns the other listing.

### Requirement: Classifier declares alias eligibility

The classifier SHALL declare whether the observed listing title is eligible for reusable global alias storage.

#### Scenario: Source page pins a generic title to an existing bottle

- **WHEN** a listing title is generic but source-specific evidence from the listing page, product id, SKU, article, image, or equivalent source artifact pins the exact item to a known local bottle or release
- **THEN** the classifier SHALL be able to return an existing match while marking the listing title as not eligible for global alias storage.

#### Scenario: Family evidence does not make a generic title reusable

- **WHEN** external evidence proves a brand has sibling or family products but the submitted source does not identify the decisive bottle traits
- **THEN** the classifier SHALL NOT mark the listing title as eligible for global alias storage or reusable canonical product auto-create.

### Requirement: Source-scoped matches do not create global aliases

The price-matching approval flow SHALL support assigning an exact store listing to a bottle or release without creating or updating a reusable global bottle alias from the listing display name.

#### Scenario: Source-scoped assignment is approved

- **WHEN** an approved match is marked as not eligible for global alias storage
- **THEN** the system SHALL update the matched `store_price` and evidence record but MUST NOT create a global bottle alias from the normalized listing title.

#### Scenario: Same generic title appears from another source item

- **WHEN** a later listing has the same generic display title but lacks the same stable source identifier, URL, SKU, or source fingerprint
- **THEN** the system SHALL NOT reuse the previous source-scoped assignment by title alone.

### Requirement: Exact assignment is reusable only on the same stable source item

The system SHALL update the same StorePrice row when a repeated scrape matches a stable source product identity scoped to its external site, and SHALL preserve that row's exact Bottle assignment only while Bottle-relevant source evidence is unchanged.

#### Scenario: New scraper row matches verified source identity

- **WHEN** a scrape carries the same external site and stable source product identifier as an existing StorePrice and its identity fingerprint is unchanged
- **THEN** ingestion SHALL update that StorePrice and preserve its exact Bottle assignment without running generic classifier matching.

#### Scenario: Existing source item changes identity

- **WHEN** a scrape carries the same source item key but its Bottle-relevant identity fingerprint changed
- **THEN** ingestion SHALL clear an assignment that current deterministic evidence cannot establish and queue normal classification.

#### Scenario: Same source key value appears at another store

- **WHEN** another store has the same product id string
- **THEN** the system SHALL NOT reuse the first store's StorePrice or Bottle assignment.

#### Scenario: Source identity is insufficient

- **WHEN** a scraper row has only a generic display title and no stable source product id or canonical URL
- **THEN** the system SHALL fall back to normal classifier review and MUST NOT reuse another StorePrice by title.

### Requirement: Ingestion preserves stable source ids

Scraper ingestion SHALL preserve stable source product, variant, SKU, URL, or fingerprint identifiers when a scraper can extract them.

#### Scenario: Scraper extracts an internal listing id

- **WHEN** a scraper extracts a stable internal product id, variant id, SKU, grouping id, or equivalent source id
- **THEN** the submitted store price payload SHALL include that source identity so downstream matching can key source-scoped verification independently of display title.

#### Scenario: Same title has different source ids

- **WHEN** two same-site listings share the same generic display title and volume but expose different stable source ids
- **THEN** ingestion SHALL preserve them as distinct source items rather than collapsing them by title and volume.

#### Scenario: No source id exists

- **WHEN** a scraper cannot extract a stable source id
- **THEN** ingestion MAY fall back to canonical URL or, for legacy compatibility only, existing title-volume behavior, but source-scoped reuse SHALL remain unavailable unless a durable source fingerprint exists.

### Requirement: Missing alias-safety metadata is conservative

New classifier decisions SHALL NOT create or update reusable bottle aliases unless the decision explicitly marks the listing label as eligible for global alias storage.

#### Scenario: New decision omits alias scope

- **WHEN** a new classifier decision omits alias-safety metadata
- **THEN** the system SHALL require review or skip global alias creation rather than assuming the listing title is alias-safe.

#### Scenario: Decision explicitly allows global alias

- **WHEN** a new classifier decision explicitly marks the listing label as eligible for global alias storage
- **THEN** approval MAY use the existing global alias path if all other match/create requirements pass.

### Requirement: Evals cover source specificity and alias safety

Classifier and server tests SHALL cover source-specific identity, generic-title rejection, and source-scoped alias behavior before automation is enabled.

#### Scenario: Generic-label eval controls alias behavior

- **WHEN** a classifier eval covers a generic listing label
- **THEN** the eval SHALL fail unless the result marks the label as not eligible for global alias storage.

#### Scenario: Positive source-specific eval

- **WHEN** an eval fixture represents a real or curated listing with a generic display title but verified source evidence for an existing bottle/release
- **THEN** the expected result SHALL encode the existing match and no-global-alias metadata.

#### Scenario: Negative generic-title eval

- **WHEN** an eval fixture represents a production miss where only family or sibling evidence exists and the submitted source omits decisive traits
- **THEN** the expected result SHALL reject broad reusable creation or require review rather than auto-completing.

#### Scenario: Alias safety integration test

- **WHEN** a source-scoped match is approved
- **THEN** tests SHALL assert that the matched store price is assigned and that unrelated future listings with the same generic title are not globally reassigned by alias side effects.

#### Scenario: Alias table assertion

- **WHEN** a generic-label match is approved
- **THEN** tests SHALL assert that no `bottle_alias` row is created or rebound for the generic label.
