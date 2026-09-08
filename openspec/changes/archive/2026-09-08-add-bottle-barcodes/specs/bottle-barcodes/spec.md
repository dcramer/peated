## ADDED Requirements

### Requirement: Multiple canonical barcodes per exact Bottle

The system SHALL store zero or more canonical GTIN barcodes for an exact Bottle
and SHALL NOT treat a barcode as BottleGroup or physical collection-unit
identity.

#### Scenario: Store multiple package identifiers

- **WHEN** a moderator adds two distinct valid GTINs to one Bottle
- **THEN** both mappings resolve to that exact Bottle

#### Scenario: Bottle deletion

- **WHEN** an exact Bottle is permanently deleted
- **THEN** its barcode mappings are deleted

#### Scenario: Bottle merge

- **WHEN** an exact Bottle is merged into another exact Bottle
- **THEN** the source Bottle's barcode mappings are transferred to the destination

### Requirement: Deterministic GTIN normalization

The system SHALL accept GTIN-8, GTIN-12, GTIN-13, and GTIN-14 values, SHALL
validate their GS1 check digits, and SHALL compare equivalent representations
using a zero-padded GTIN-14 key.

#### Scenario: Formatted valid input

- **WHEN** a caller submits a valid supported GTIN containing spaces or hyphens
- **THEN** the system removes the separators, validates the check digit, and stores the digit-only value

#### Scenario: Invalid length or check digit

- **WHEN** a caller submits a value with an unsupported length, non-digit content, or invalid check digit
- **THEN** the system rejects the value without creating a mapping

#### Scenario: Equivalent UPC and EAN forms

- **WHEN** a UPC-A and its zero-prefixed EAN-13 representation are submitted
- **THEN** the system treats them as the same canonical GTIN

### Requirement: Globally unambiguous canonical lookup

The system SHALL associate each normalized GTIN with at most one exact Bottle.

#### Scenario: Conflicting assignment

- **WHEN** a moderator attempts to assign an existing normalized GTIN to another Bottle
- **THEN** the system rejects the assignment as a conflict and preserves the existing mapping

#### Scenario: Idempotent assignment

- **WHEN** a moderator adds an equivalent representation of a GTIN already assigned to the same Bottle
- **THEN** the system returns the existing mapping without creating a duplicate

### Requirement: Public barcode reads

The system SHALL allow anonymous clients to list barcodes for an exact Bottle
and resolve a valid barcode to its exact Bottle.

#### Scenario: List Bottle barcodes

- **WHEN** a client lists barcodes for an existing Bottle
- **THEN** the system returns its mappings in stable value order

#### Scenario: Resolve barcode

- **WHEN** a client looks up a mapped valid barcode
- **THEN** the system returns the mapping and serialized exact Bottle

#### Scenario: Unknown barcode

- **WHEN** a client looks up a valid unmapped barcode
- **THEN** the system returns not found

### Requirement: Moderator-controlled barcode writes

The system SHALL require moderator authorization to add or remove canonical
barcode mappings and SHALL record the actor that created a mapping.

#### Scenario: Moderator adds barcode

- **WHEN** a moderator assigns a valid unmapped GTIN to an existing Bottle
- **THEN** the system creates the mapping with moderator actor provenance

#### Scenario: Moderator removes barcode

- **WHEN** a moderator removes an existing mapping
- **THEN** the system deletes that mapping

#### Scenario: Unauthorized write

- **WHEN** an anonymous or non-moderator client attempts to add or remove a mapping
- **THEN** the system rejects the request without changing barcode data
