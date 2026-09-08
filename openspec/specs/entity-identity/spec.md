## Purpose

Define how Peated identifies whisky entities, records their current owner, and
shows those facts to users.

## Requirements

### Requirement: One Entity kind

The system SHALL keep one Entity record for each whisky identity or owning
company. Each Entity SHALL have exactly one kind from Brand, Distillery,
Bottler, or Company.

#### Scenario: Distillery also appears as a Brand

- **WHEN** Lagavulin is the Brand and Distiller for a Bottle
- **THEN** both Bottle links reference the same Lagavulin Entity whose kind is
  `distillery`

#### Scenario: Owning company has no Bottles

- **WHEN** Diageo owns Lagavulin but is not named on a Bottle
- **THEN** Diageo remains an Entity whose kind is `company`

### Requirement: Bottle fields define Brand, Bottler, and Distiller use

The system SHALL find Brand, Bottler, and Distiller use from active Bottle
links. It MUST NOT copy those uses into an Entity type list.

#### Scenario: Entity appears in two Bottle fields

- **WHEN** one Bottle links the same Entity as Brand and Distiller
- **THEN** the Entity page reports both uses from the Bottle links

#### Scenario: First use in a Bottle field

- **WHEN** a moderator selects an Entity that has not appeared in that Bottle
  field before
- **THEN** the Bottle update succeeds without changing the Entity kind

#### Scenario: First use by another kind

- **WHEN** a Distillery Entity is first selected as a Bottle Brand
- **THEN** the Bottle update succeeds and the Entity remains kind `distillery`

#### Scenario: Create an Entity while creating a Bottle

- **WHEN** Bottle creation includes a new Entity draft with an evidence-based
  kind
- **THEN** the system stores that kind instead of copying the Bottle field

#### Scenario: Create an Entity without an explicit kind

- **WHEN** Bottle creation includes a new Entity draft without a kind
- **THEN** the system uses the Bottle field's default kind and stores one kind

### Requirement: Clear API names

The system SHALL use dedicated Brand, Distillery, Bottler, and Company API
collections for what an Entity is. Bottle APIs SHALL use Brand, Bottler, and
Distiller as Bottle field names. The system SHALL keep the generic Entity API
for cross-kind selectors, creation, updates, and other shared Entity
operations. It MUST NOT add a stored Entity role, use the generic collection
for kind browse pages, or use `type` for both meanings.

#### Scenario: List one Entity kind

- **WHEN** a caller lists `/bottlers`
- **THEN** every result has kind `bottler` and the caller does not pass a kind
  filter

#### Scenario: Browse one Entity kind

- **WHEN** a caller needs a collection of one Entity kind
- **THEN** it uses that kind's dedicated endpoint instead of `GET /entities`

#### Scenario: Select across Entity kinds

- **WHEN** a Bottle or ownership field needs to select any Entity
- **THEN** `GET /entities` searches all four kinds and returns each result's
  kind

#### Scenario: Create an Entity

- **WHEN** a caller creates a Bottler through `POST /entities`
- **THEN** the caller passes kind `bottler` and the server stores that kind

#### Scenario: Update an Entity

- **WHEN** a moderator changes an Entity's kind or other shared fields
- **THEN** it uses the shared Entity update endpoint

#### Scenario: List Companies

- **WHEN** a caller lists `/companies`
- **THEN** the system returns Companies even when they have no Bottles

#### Scenario: Search for a Bottler

- **WHEN** a Bottle form searches for an Entity for its Bottler field
- **THEN** the generic Entity selector considers every Entity kind and does not
  require or infer a Bottler role

#### Scenario: Search one Entity kind

- **WHEN** a caller searches the Company scope
- **THEN** every Entity result has kind `company`, regardless of its Bottle
  relationships

#### Scenario: Search all Entities for a Bottle field

- **WHEN** a Bottle form searches its Brand, Bottler, or Distiller field
- **THEN** it uses the generic Entity selector collection and may return any
  Entity kind

### Requirement: Current owner

An Entity MAY point to one current owner Entity. The system SHALL show the
current owner and the Entities directly owned by an owner.

#### Scenario: Existing parent field

- **WHEN** the ownership model is added
- **THEN** the existing Entity `parentId` self-reference is renamed to
  `ownerId` instead of adding a second self-reference

#### Scenario: Distillery owner

- **WHEN** Lagavulin points to Diageo as its owner
- **THEN** Lagavulin shows “Part of Diageo” and Diageo lists Lagavulin

#### Scenario: Brand owner

- **WHEN** Johnnie Walker points to Diageo as its owner
- **THEN** Johnnie Walker shows “A Diageo brand” and Diageo lists Johnnie
  Walker

#### Scenario: Owner chain

- **WHEN** Jameson points to Irish Distillers and Irish Distillers points to
  Pernod Ricard
- **THEN** the system preserves and can show both links in order

#### Scenario: Unknown or joint owner

- **WHEN** Peated cannot name one accurate current owner
- **THEN** owner remains empty and the system does not show a false owner

### Requirement: Valid owner links

The system MUST reject an owner change that makes an Entity own itself or
creates a loop.

#### Scenario: Self ownership

- **WHEN** a moderator selects the same Entity as its owner
- **THEN** the change fails without saving it

#### Scenario: Owner loop

- **WHEN** a moderator selects an owner that is already below the Entity in the
  owner chain
- **THEN** the change fails without saving it

#### Scenario: Entity merge

- **WHEN** an Entity merge can safely move owned Entities to the survivor
- **THEN** the merge updates those owner links in the same transaction

#### Scenario: Conflicting merge owners

- **WHEN** an Entity merge finds two different owners that cannot be chosen
  safely
- **THEN** the merge fails and asks for moderator review

### Requirement: Plain Entity page

The system SHALL show one kind, the known current owner, and Bottle-use counts
as separate facts.

#### Scenario: Entity header

- **WHEN** a user opens an Entity page
- **THEN** the header shows one kind instead of Brand, Bottler, and Distiller
  chips

#### Scenario: Owner page

- **WHEN** a user opens an Entity that owns other Entities
- **THEN** the page lists those directly owned Entities even if the owner has no
  Bottles

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

### Requirement: Legacy Blender reclassification

The system MUST reclassify every Entity whose stored kind is `blender` as a
Bottler before it removes `blender` from the database enum. It MUST preserve
Entity ids and all Bottle relationships.

#### Scenario: Reclassify a Blender

- **WHEN** the migration processes a Compass Box Entity whose kind is
  `blender`
- **THEN** the same Entity id has kind `bottler` and its Brand, Bottler, and
  Distiller Bottle links are unchanged

#### Scenario: Keep Company ownership specific

- **WHEN** a legacy Blender is not an owning parent organization such as Diageo
- **THEN** the migration does not use `company` as its fallback kind

### Requirement: Public Entity review-and-tasting activity

The system SHALL summarize and list public review-and-tasting activity across
the active Bottles that use an Entity as Brand, Bottler, or Distiller.

#### Scenario: Entity activity count

- **WHEN** an Entity's active Bottles have public tastings, member reviews, and
  critic reviews
- **THEN** its public combined activity count includes all three source kinds

#### Scenario: Entity activity list

- **WHEN** a reader opens an Entity's public reviews-and-tastings page
- **THEN** eligible records from all three source kinds appear in one stable
  chronological list

#### Scenario: Entity catalog ordering

- **WHEN** Entities or their Bottles are ordered by public opinion activity
- **THEN** the ordering uses the saved combined public review-and-tasting count
