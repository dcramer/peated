## ADDED Requirements

### Requirement: Sourced Entity description

When a Distillery or Brand has a published About lead, its description SHALL
be that lead, recorded as generated, and SHALL show the lead's citations where
the description is shown in full. The system SHALL NOT write a description
from a model's memory. An Entity without a published lead SHALL keep its
current description until a lead is published or a moderator edits it. A
description a moderator wrote SHALL NOT be replaced by the pipeline.

#### Scenario: Lead published

- **WHEN** the pipeline publishes a sourced lead for a distillery with an
  unsourced generated description
- **THEN** the distillery's description becomes the lead

#### Scenario: Moderator-written description

- **WHEN** the pipeline publishes a lead for a brand whose description a
  moderator wrote
- **THEN** the description is unchanged and the Inbox gets a finding

#### Scenario: Details job

- **WHEN** `generateEntityDetails` runs for an Entity
- **THEN** it does not write a description
