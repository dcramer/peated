## ADDED Requirements

### Requirement: Complete Company whisky portfolio

The system SHALL derive a Company's whisky portfolio from every descendant Brand, Distillery, and Bottler reachable through one or more current-owner links. It MUST return each portfolio Entity once and MUST preserve the recorded owner chain.

#### Scenario: Directly owned portfolio Entity

- **WHEN** a Company directly owns a Brand, Distillery, or Bottler
- **THEN** that Entity appears in the Company's whisky portfolio

#### Scenario: Portfolio Entity below an intermediate Company

- **WHEN** a Company owns another Company that owns a whisky Entity
- **THEN** the whisky Entity appears in both Companies' portfolios
- **AND** its recorded path from each requested Company remains available

#### Scenario: Portfolio Entity below a non-Company Entity

- **WHEN** a descendant Brand, Distillery, or Bottler owns another whisky Entity
- **THEN** traversal continues through that Entity and includes the lower descendant

#### Scenario: Company has no portfolio

- **WHEN** a Company has no descendant Brand, Distillery, or Bottler
- **THEN** its portfolio is empty and the page does not invent or infer relationships

### Requirement: Direct Company group context

A Company overview SHALL list directly owned Companies separately from its recursive whisky portfolio. It MUST NOT present indirectly owned Companies or Bottlers as Companies in this group.

#### Scenario: Company owns an intermediate Company

- **WHEN** a Company directly owns another Company
- **THEN** the overview lists that Entity under Companies in this group
- **AND** links to the intermediate Company's own page

#### Scenario: Company has only indirect Company descendants

- **WHEN** a Company has no directly owned Companies
- **THEN** its overview omits Companies in this group even if a lower portfolio Entity owns a Company

### Requirement: Company portfolio collection

A Company with a nonempty whisky portfolio SHALL provide a Portfolio collection under the existing Company page header. The collection SHALL expose kind filters, exact totals, deterministic sorting, and bounded pagination.

#### Scenario: Browse a complete portfolio

- **WHEN** a visitor selects Portfolio on a Company page
- **THEN** the page lists descendant whisky Entities under the same Company header
- **AND** each row uses the Entity's stored identity and kind
- **AND** the visitor can filter the collection to Brands, Distilleries, or Bottlers

#### Scenario: Overview portfolio is truncated

- **WHEN** the Company overview shows fewer portfolio Entities than the exact total
- **THEN** it provides a View all action containing that total and linking to the Portfolio collection

#### Scenario: Stable portfolio order

- **WHEN** two portfolio Entities have the same value for the selected sort
- **THEN** the system uses a stable Entity ID tie-breaker

### Requirement: Company Bottle catalog

The system SHALL provide a Company-scoped Bottle collection containing each active Bottle whose Brand, Bottler, or Distiller is the Company itself or one of its descendants. The collection and its exact total MUST count each Bottle once.

#### Scenario: Bottle belongs through an indirect Brand

- **WHEN** a Bottle's Brand is below an intermediate Company in the requested Company's owner chain
- **THEN** the Bottle appears in the requested Company's Bottle collection

#### Scenario: Bottle matches several portfolio Entities

- **WHEN** a Bottle references more than one Entity in the requested Company's portfolio
- **THEN** the Bottle appears once and contributes one to the exact total

#### Scenario: Bottle directly references the Company

- **WHEN** an active Bottle directly uses the Company as its Brand, Bottler, or Distiller
- **THEN** the Bottle appears even when the Company has no descendant portfolio Entities

#### Scenario: Inactive Bottle matches the portfolio

- **WHEN** an inactive Bottle references the Company or one of its descendants
- **THEN** the public Company Bottle collection excludes it

### Requirement: Company overview discovery

A Company overview SHALL preview descendant Brands, Distilleries, and Bottlers in separate sections. Each section SHALL show its exact total and link to the matching Portfolio filter. Optional empty sections SHALL be omitted, and a failure in one section MUST NOT replace successful Company content.

#### Scenario: View a Company with a nested portfolio

- **WHEN** a visitor opens a Company whose whisky Entities are below intermediate owners
- **THEN** the overview includes those Entities in the section matching their stored kind
- **AND** each truncated section links to its complete filtered collection

#### Scenario: Company has sparse data

- **WHEN** a Company has facts or history but no portfolio or Bottles
- **THEN** the overview retains the available content and omits the empty discovery sections

#### Scenario: Portfolio request fails

- **WHEN** the portfolio request fails while other Company data loads
- **THEN** the overview shows a local retryable portfolio error and retains the other content
