## ADDED Requirements

### Requirement: Virtual catalog slugs

The web application SHALL derive each public Bottle and Entity slug from the
object's current display name. It MUST NOT store the slug or use it to find the
object.

#### Scenario: Bottle URL generation

- **WHEN** a caller generates a public URL for Bottle 123 whose display name is
  `Lagavulin 16-year-old`
- **THEN** the URL is `/bottles/123-lagavulin-16-year-old`

#### Scenario: Entity URL generation

- **WHEN** a caller generates a public URL for Distillery Entity 123 named
  `Lagavulin`
- **THEN** the URL is `/distillers/123-lagavulin`

#### Scenario: Name change

- **WHEN** a Bottle or Entity display name changes
- **THEN** newly generated URLs use the slug derived from the new name without
  updating stored slug data

### Requirement: Non-empty Unicode-safe slugs

The web application SHALL prefer ASCII slugification and MUST produce a
non-empty slug for every Bottle and Entity.

#### Scenario: Latin diacritic

- **WHEN** the source name is `Pōkeno`
- **THEN** the generated slug is `pokeno`

#### Scenario: Mixed Latin and non-Latin text

- **WHEN** the source name is `Nikka 宮城峡`
- **THEN** the generated slug is `nikka`

#### Scenario: Non-Latin-only text

- **WHEN** ASCII slugification removes the complete source name `東京`
- **THEN** the generated slug preserves its normalized Unicode letters as
  `東京`

#### Scenario: Name without letters or numbers

- **WHEN** slugification finds no usable characters in a Bottle or Entity name
- **THEN** the generated slug is the object-kind fallback `bottle` or `entity`

### Requirement: Public route lookup by ID

The web application SHALL resolve a public catalog route by its positive
numeric ID. It SHALL ignore the slug during the lookup.

#### Scenario: Current slug

- **WHEN** a user requests the current collection, ID, and slug
- **THEN** the page renders without a redirect

#### Scenario: Numeric-only URL

- **WHEN** a user requests a public Bottle or Entity URL with only its numeric
  ID
- **THEN** the application permanently redirects to the current slugged URL

#### Scenario: Stale or incorrect slug

- **WHEN** a user requests a valid ID with a slug that is missing, stale, or
  incorrect
- **THEN** the application permanently redirects to the slug generated from
  current object data

#### Scenario: Invalid route identifier

- **WHEN** a public route segment does not start with a positive safe integer
- **THEN** the application returns not found without performing a catalog
  lookup

### Requirement: Redirect old public URLs

The web application SHALL keep existing Entity kind and merged-object redirects
when it adds the current slug.

#### Scenario: Nested stale URL

- **WHEN** a stale public URL includes a nested page suffix and query string
- **THEN** the permanent redirect updates the collection, ID, and slug while
  preserving the suffix and query string

#### Scenario: Merged object

- **WHEN** a public URL names an ID that merged into another Bottle or Entity
- **THEN** the permanent redirect uses the survivor's current ID, collection,
  and slug

#### Scenario: Peated ID

- **WHEN** a root Peated ID resolves to a Bottle or Entity
- **THEN** its permanent redirect uses the object's current public URL

### Requirement: Published public URLs

The web application SHALL publish slugged URLs for public Bottle and Entity
navigation and discovery.

#### Scenario: Public navigation

- **WHEN** the web application renders a public Bottle or Entity link
- **THEN** the link uses the current virtual slug when the source data includes
  the display name

#### Scenario: Search metadata and sitemap

- **WHEN** the application emits canonical metadata, copied public URLs, or a
  sitemap entry
- **THEN** it uses the current slugged URL

#### Scenario: API and workflow route

- **WHEN** the application calls an API or opens a standalone edit workflow
- **THEN** that route continues to identify the object with its numeric ID
