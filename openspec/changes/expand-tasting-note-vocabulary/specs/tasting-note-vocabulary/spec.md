## ADDED Requirements

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
