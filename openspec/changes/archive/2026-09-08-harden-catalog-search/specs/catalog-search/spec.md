## ADDED Requirements

### Requirement: Human text search supports incomplete words

Bottle and Entity search SHALL match normalized complete words and normalized word prefixes while treating all user input as text rather than search operators.

#### Scenario: Search with an incomplete expression

- **WHEN** a user searches for `Mac` and an indexed Bottle contains `Macallan`
- **THEN** the Bottle is a search candidate

#### Scenario: Complete words outrank prefixes

- **WHEN** one Bottle contains the complete word `Wood` and another contains only the prefix continuation `Wooden`
- **THEN** the complete-word match appears first

#### Scenario: Operator-like text remains text

- **WHEN** a query contains text such as `OR` or `-`
- **THEN** the query cannot enable PostgreSQL search operators

### Requirement: Global search reports complete results

Global search SHALL propagate an operational failure from an available requested source and SHALL NOT represent that failure as an empty successful source.

#### Scenario: Bottle search fails

- **WHEN** the Bottle source fails during a global catalog search
- **THEN** global search returns an error instead of a successful no-match result

#### Scenario: Search UI receives an error

- **WHEN** a global search request fails
- **THEN** the UI shows an unavailable state and does not offer Bottle creation from that result

### Requirement: Global results blend source types

Global search SHALL preserve each source's ranked order while preventing a nonexact source list from consuming the entire shared result limit.

#### Scenario: Several result types match

- **WHEN** Bottle, Entity, and user sources each return nonexact matches
- **THEN** global results interleave the available source types up to the shared limit

#### Scenario: Exact result matches

- **WHEN** a result display name exactly matches the query
- **THEN** it appears before nonexact results

### Requirement: Search indexes are immediately useful and refreshable

A newly committed Bottle SHALL have canonical search coverage, and a searchable Entity name change SHALL refresh Bottle vectors that contain that Entity as Brand, bottler, or distiller.

#### Scenario: Search immediately after Bottle creation

- **WHEN** a Bottle creation transaction commits before its enrichment worker runs
- **THEN** a canonical Bottle-name prefix can find that Bottle

#### Scenario: Rename a related Entity

- **WHEN** an Entity name or short name changes
- **THEN** directly related Bottle vectors are queued for refresh

### Requirement: Ranked search is stable and respects accepted aliases

Ranked Bottle and Entity results SHALL use a stable identifier tie-breaker, and Library exact-alias search SHALL exclude ignored aliases.

#### Scenario: Equal search ranks are paginated

- **WHEN** several results have equal rank across pages
- **THEN** their identifier order is stable

#### Scenario: Library contains a Bottle with an ignored alias

- **WHEN** a Library search exactly matches that ignored alias
- **THEN** the ignored alias does not make the Bottle a result
