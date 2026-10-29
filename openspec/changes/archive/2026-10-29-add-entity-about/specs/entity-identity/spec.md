## ADDED Requirements

### Requirement: Sourced Entity description

When a Distillery, Brand, Bottler, or Company has a published About lead, its description SHALL
be that lead, recorded as generated. The Overview SHALL show the lead with its
citations in place of the description. The system SHALL NOT write a description
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

## MODIFIED Requirements

### Requirement: Company overview discovery

A Company overview SHALL preview its largest group of descendant Brands, Distilleries, or Bottlers, by exact total, and link to the matching Portfolio filter; the other groups SHALL stay on the Portfolio tab. When groups tie, Brands come first, then Distilleries, then Bottlers. A Company with no portfolio SHALL omit the preview, and a failure in the preview MUST NOT replace successful Company content.

#### Scenario: View a Company with a nested portfolio

- **WHEN** a visitor opens a Company whose whisky Entities are below intermediate owners
- **THEN** the overview counts those Entities in the group matching their stored kind
- **AND** the preview shows the largest group and links to its complete filtered collection

#### Scenario: Company has sparse data

- **WHEN** a Company has facts or history but no portfolio or Bottles
- **THEN** the overview retains the available content and omits the portfolio preview

#### Scenario: Portfolio request fails

- **WHEN** the portfolio request fails while other Company data loads
- **THEN** the overview shows a local retryable portfolio error and retains the other content
