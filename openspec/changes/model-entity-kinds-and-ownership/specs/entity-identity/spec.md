## ADDED Requirements

### Requirement: One Entity kind

The system SHALL keep one Entity record for each whisky identity or owning
company. Each Entity SHALL have exactly one kind from the approved kind list.

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

The system SHALL use dedicated Brand, Distillery, Bottler, Blender, and Company
API collections for what an Entity is. Bottle APIs SHALL use Brand, Bottler,
and Distiller as Bottle field names. The system SHALL keep a read-only generic
Entity collection for cross-kind selectors. It MUST NOT add a stored Entity
role, use the generic collection for kind browse pages, expose generic Entity
creation, or use `type` for both meanings.

#### Scenario: List one Entity kind

- **WHEN** a caller lists `/blenders`
- **THEN** every result has kind `blender` and the caller does not pass a kind
  filter

#### Scenario: Browse one Entity kind

- **WHEN** a caller needs a collection of one Entity kind
- **THEN** it uses that kind's dedicated endpoint instead of `GET /entities`

#### Scenario: Select across Entity kinds

- **WHEN** a Bottle or ownership field needs to select any Entity
- **THEN** `GET /entities` searches all five kinds and returns each result's
  kind

#### Scenario: Create one Entity kind

- **WHEN** a caller creates a Blender through `/blenders`
- **THEN** the server assigns kind `blender` and the caller does not pass a
  kind field

#### Scenario: Generic Entity creation

- **WHEN** a caller needs to create an Entity of one known kind
- **THEN** it uses that kind's dedicated endpoint instead of `POST /entities`

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
- **THEN** Lagavulin shows “Owned by Diageo” and Diageo lists Lagavulin

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

### Requirement: Reviewed existing-data migration

The system MUST assign a reviewed kind to every existing Entity before kind
becomes required. It MUST NOT guess an unclear kind from a name or the old type
list.

#### Scenario: Find Entities that need a kind

- **WHEN** the preparation API is paged
- **THEN** it returns the Entity details and Bottle-use counts needed to find
  and review every Entity without a kind

#### Scenario: Review unclear rows

- **WHEN** the existing data does not clearly distinguish Brand, Bottler,
  Blender, or Company
- **THEN** the Entity remains unchanged until its kind is researched

#### Scenario: Apply a reviewed kind

- **WHEN** a reviewed kind is sent to the authenticated Entity update API
- **THEN** the API validates the kind, records the change, and returns the
  updated Entity

#### Scenario: Resume an interrupted backfill

- **WHEN** the API backfill stops before it is complete
- **THEN** it resumes by querying for Entities whose kind is still empty

#### Scenario: Final switch

- **WHEN** the application stops using the old Entity type list
- **THEN** every Entity has a kind, owner links are valid, Bottle-use counts
  match, and all existing IDs and links remain unchanged
