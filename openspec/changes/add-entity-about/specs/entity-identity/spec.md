## ADDED Requirements

### Requirement: Sourced Entity description

When a Distillery, Brand, or Company has a published About lead, its description SHALL
be that lead, recorded as generated, and SHALL show the lead's citations where
the description is shown in full. The system SHALL NOT write a description
from a model's memory. After the About writer has covered every Distillery
and Brand, an administrator cleanup SHALL clear each generated description
that is not its published lead. A description a moderator wrote SHALL NOT be
replaced or cleared by the pipeline or the cleanup.

#### Scenario: Lead published

- **WHEN** the pipeline publishes a sourced lead for a distillery with an
  unsourced generated description
- **THEN** the distillery's description becomes the lead

#### Scenario: Moderator edits the lead

- **WHEN** a moderator saves a new lead for a distillery with a generated
  description
- **THEN** the distillery's description becomes the new lead

#### Scenario: Moderator-written description

- **WHEN** the pipeline publishes a lead for a brand whose description a
  moderator wrote
- **THEN** the description is unchanged

#### Scenario: No lead after the full run

- **WHEN** the cleanup runs for a distillery whose About run produced no lead
  and whose description was generated
- **THEN** the description is cleared and the change is recorded

#### Scenario: Details job

- **WHEN** `generateEntityDetails` runs for an Entity
- **THEN** it does not write a description
