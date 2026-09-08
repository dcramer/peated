## Purpose

Define Peated's curated whisky tasting-note vocabulary, migration, and discovery behavior.

## Requirements

### Requirement: Curated tasting-note vocabulary

The system SHALL maintain a checked-in whisky tasting-note vocabulary whose canonical values are lowercase, normalized, and mapped to exactly one existing whisky-wheel tag category.

#### Scenario: Descriptor is added to the vocabulary

- **WHEN** a maintainer adds a tasting-note descriptor
- **THEN** the descriptor includes a unique canonical name, zero or more synonyms, and one valid tag category

#### Scenario: Alternate wording is represented

- **WHEN** a plural, spelling variant, or close alternate phrase refers to an existing canonical descriptor
- **THEN** the alternate wording is recorded as a synonym rather than a second canonical descriptor

### Requirement: Vocabulary migration

The system SHALL install the checked-in vocabulary through the normal database migration path.

#### Scenario: New descriptors are migrated

- **WHEN** the vocabulary migration encounters descriptors absent from the database
- **THEN** it creates those tag rows with their synonyms and tag categories

#### Scenario: Existing descriptors are migrated

- **WHEN** the vocabulary migration encounters an existing canonical descriptor
- **THEN** it updates the descriptor's synonyms without requiring a duplicate row

#### Scenario: Declared historical variant is normalized

- **WHEN** the vocabulary declares that an existing spelling or number variant has been replaced by a canonical descriptor
- **THEN** the migration preserves tasting selections and bottle suggestions, rebuilds bottle aggregate counts under the canonical name, and removes the replaced tag row transactionally

#### Scenario: Vocabulary is invalid

- **WHEN** canonical names or synonyms collide after normalization, or a descriptor lacks a valid category
- **THEN** migration generation stops before producing the migration

### Requirement: Synonym-aware flavor lookup

The tasting-note picker SHALL match available descriptors by canonical name, synonym, or tag category while continuing to save canonical names.

#### Scenario: User searches with a synonym

- **WHEN** a user searches for an alternate phrase assigned to a descriptor
- **THEN** the picker includes the canonical descriptor in the results

#### Scenario: User selects a synonym result

- **WHEN** a user selects a result found through a synonym
- **THEN** the tasting stores the descriptor's canonical name

### Requirement: Deterministic fallback suggestions

The tasting form SHALL use a fixed set of common descriptors when bottle and brand history do not supply enough quick suggestions.

#### Scenario: Bottle has little tag history

- **WHEN** fewer than five historically used descriptors are available for the bottle and brand
- **THEN** the picker fills the remaining quick suggestions from the configured common descriptors in deterministic order

### Requirement: Comprehensive whisky descriptor coverage

The system SHALL maintain a checked-in inventory covering the concrete aroma and flavor descriptors relevant to whisky from the selected Scotch, bourbon, and general spirits vocabularies, supplemented by concrete descriptors observed in Peated reviews.

#### Scenario: Established descriptor is relevant to whisky

- **WHEN** a selected reference vocabulary contains a concrete aroma or flavor descriptor that can describe whisky
- **THEN** the inventory maps that descriptor to a canonical tag or one of its synonyms

#### Scenario: Review language reveals a concrete omission

- **WHEN** Peated review text repeatedly uses a concrete aroma or flavor descriptor absent from the selected references and current vocabulary
- **THEN** the inventory includes the descriptor with its evidence and mapping

#### Scenario: Term is outside flavor scope

- **WHEN** a source term describes only texture, body, alcoholic heat, appearance, finish length, quality, balance, complexity, or general evaluation
- **THEN** the flavor inventory records or applies the exclusion rule instead of creating a tag

### Requirement: Existing tasting-wheel mapping

Every canonical descriptor in the inventory MUST map to exactly one of Peated's existing tasting-wheel categories: `cereal`, `fruit`, `floral`, `smoke`, `earthy`, `sulfur`, `sweet`, `spice`, or `wood`.

#### Scenario: Descriptor has a clear resemblance

- **WHEN** a descriptor resembles a concrete food, plant, material, aroma, or flavor in one wheel family
- **THEN** the inventory assigns that family regardless of the descriptor's chemical cause or production origin

#### Scenario: Descriptor is ambiguous across source wheels

- **WHEN** selected references place a descriptor in different families
- **THEN** the inventory uses the category most consistent with neighboring Peated tags and documents the reviewed mapping

#### Scenario: Descriptor has no honest wheel mapping

- **WHEN** a proposed term cannot be mapped to one existing category without misrepresenting what it describes
- **THEN** the term is excluded from this vocabulary change

### Requirement: Canonical names and synonyms

Canonical names MUST be lowercase, whitespace-normalized, no longer than 64 characters, and unique after normalization. Plurals, adjective forms, spelling variants, and interchangeable phrases SHALL be synonyms rather than duplicate canonical tags.

#### Scenario: Alternate wording has the same meaning

- **WHEN** alternate wording identifies the same sensory concept as a canonical tag
- **THEN** the inventory records the wording as a synonym of that tag

#### Scenario: Compound wording has a distinct sensory reference

- **WHEN** a familiar compound such as `wet concrete` or `pipe tobacco` evokes a distinct reference rather than merely combining two independent notes
- **THEN** the inventory may retain the compound as a canonical tag

#### Scenario: Candidate duplicates another name

- **WHEN** a normalized canonical name or synonym collides with another canonical name or an unrelated synonym
- **THEN** inventory validation fails before migration generation

### Requirement: Reproducible vocabulary installation

The system SHALL install new canonical tags and reviewed synonym additions through the normal database migration path while preserving existing tasting selections and tag categories.

#### Scenario: Missing canonical tag is installed

- **WHEN** the migration runs and an inventory addition is absent
- **THEN** it creates the tag with the reviewed synonyms and tasting-wheel category

#### Scenario: Existing tag receives aliases

- **WHEN** the migration declares additional synonyms for an existing canonical tag
- **THEN** it adds the reviewed synonyms without removing existing synonyms or changing the tag's category

#### Scenario: Existing category conflicts with inventory

- **WHEN** an existing canonical tag has a different category from the reviewed inventory
- **THEN** the migration fails rather than silently remapping the tag

#### Scenario: Installation completes

- **WHEN** the migration finishes
- **THEN** every declared canonical name, synonym, and category matches the reviewed inventory

### Requirement: New wording is discoverable

The existing tasting picker and external-review matcher SHALL recognize installed canonical descriptors and unambiguous synonyms without storing synonym text as separate tags.

#### Scenario: User searches with new wording

- **WHEN** a user searches the tasting picker with a newly installed canonical name or synonym
- **THEN** the matching canonical tag is available for selection

#### Scenario: Review contains new wording

- **WHEN** external review text contains a newly installed canonical name or unambiguous synonym outside negated wording
- **THEN** tag extraction returns the canonical tag name
