## ADDED Requirements

### Requirement: Bottler records an independent bottler

The system SHALL assign a Bottle's `bottler` only when product evidence shows that a business independently selects and releases whisky made by another producer. A name on packaging or a product page MUST NOT establish the role by itself.

#### Scenario: Independent bottler differs from Brand

- **WHEN** a consumer Brand release identifies a separate independent bottler and the producing distillery
- **THEN** the Bottle records the consumer Brand, independent bottler, and distillery in their respective relationships

#### Scenario: Independent bottler is also the Brand

- **WHEN** product evidence establishes that Compass Box, SMWS, Proof and Wood, or another Entity is both the consumer Brand and independent bottler
- **THEN** the Bottle MAY reference that same Entity as both Brand and bottler

#### Scenario: Entity kind differs from Bottle use

- **WHEN** evidence establishes an independent bottler relationship for an existing Entity
- **THEN** the Bottle MAY use that Entity as bottler without changing its top-level Entity kind

### Requirement: Official releases have no bottler

The system SHALL leave `bottler` empty for an official Brand or distillery release. Ownership, importing, distribution, page hosting, and physical packing MUST NOT establish a bottler relationship.

#### Scenario: Corporate house mark on a distillery release

- **WHEN** Hakushu packaging names Suntory Whisky but presents the Bottle as an official Hakushu release
- **THEN** the Bottle records Hakushu as Brand and distillery and leaves `bottler` empty

#### Scenario: Owner presents an official blend

- **WHEN** Suntory presents Hibiki as an official release made from its distilleries
- **THEN** the Bottle records Hibiki as Brand, records the supported distilleries, and leaves `bottler` empty

#### Scenario: Physical bottling company only

- **WHEN** evidence names a company only as the physical packer, importer, distributor, owner, or label proprietor
- **THEN** the company is not assigned as the Bottle's bottler

### Requirement: Classifier preserves the bottler boundary

The system SHALL use the same bottler definition for Bottle creation, matching, audits, and image extraction. It MUST preserve an evidenced independent bottler and MUST remove or decline an unsupported official-producer assignment when product evidence proves that assignment wrong.

#### Scenario: Audit an official release with an empty bottler

- **WHEN** a Bottle audit finds only an official producer, owner, or house mark
- **THEN** it does not propose a bottler assignment

#### Scenario: Audit an official release with an incorrect bottler

- **WHEN** a Bottle currently assigns its official owner or producer as bottler and product evidence establishes an official release
- **THEN** the audit may propose clearing the bottler with evidence for the same Bottle

#### Scenario: Audit a same-Entity independent bottler

- **WHEN** a Bottle uses the same Entity as Brand and bottler and product evidence establishes its independent bottling role
- **THEN** the audit keeps both relationships

### Requirement: Production corrections use an approved manifest

The system's catalog-maintenance workflow SHALL inventory unsupported bottler assignments by explicit Bottle and BottleGroup IDs, retain evidence for each decision, and require approval of the exact mutation scope before writing production data.

#### Scenario: Candidate found from ownership or name

- **WHEN** an inventory finds a possible incorrect bottler from ownership, Entity kind, or name similarity alone
- **THEN** the candidate remains unresolved and unchanged until product evidence establishes whether the bottler relationship is valid

#### Scenario: Shared bottler correction

- **WHEN** an approved correction clears a BottleGroup's unsupported bottler
- **THEN** every affected member Bottle is known before the write and re-fetched afterward to verify its identity and unrelated fields

#### Scenario: Inventory changes before writing

- **WHEN** a target Bottle, group membership, or stored bottler differs from the approved manifest immediately before a write
- **THEN** the batch stops without changing that target
