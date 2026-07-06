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

### Requirement: Source-scoped verification is reusable only by stable source identity

The system SHALL persist source-scoped verification in a durable form that can be reused for future scraper listings only when the new row matches stable source identity scoped to the external site and source-key type, such as an internal store listing id, source product id, canonical URL, SKU, or accepted fingerprint, not merely display text.

#### Scenario: New scraper row matches verified source identity

- **WHEN** a brand-new scraper row carries the same verified external site, source-key type, and source-key value as a prior source-scoped verification
- **THEN** the system SHALL be able to assign the same bottle/release without running generic title alias matching.

#### Scenario: Same source key value appears at another store

- **WHEN** another store has the same SKU, UPC, product id string, or source-key value
- **THEN** the system SHALL NOT reuse a source-scoped verification unless the external site and key type also match the verified source identity.

#### Scenario: Source identity is insufficient

- **WHEN** a scraper row has only a generic display title and no stable verified source identity
- **THEN** the system SHALL fall back to normal classifier review and MUST NOT use a source-scoped verification from another source item.

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

### Requirement: Automation respects source scope

Automation SHALL distinguish low-blast-radius source-scoped assignment from high-blast-radius reusable create or alias behavior.

#### Scenario: Source-scoped existing match can verify

- **WHEN** the classifier returns a high-confidence existing match with exact source-specific evidence, no deterministic blockers, and no global alias eligibility
- **THEN** automation MAY verify the assignment while preserving source-scoped alias behavior.

#### Scenario: Generic create remains blocked

- **WHEN** the classifier proposes creating a bottle from a generic or underspecified listing identity
- **THEN** automation SHALL block auto-create even if web evidence supports the broader product family.

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
