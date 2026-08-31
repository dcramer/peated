## ADDED Requirements

### Requirement: Bottle aliases are verified marketed names

The system SHALL store a BottleAlias only when a moderator verifies that the name was used for the same marketed Bottle. A BottleAlias SHALL reference one active Bottle and SHALL record the actor and creation time.

#### Scenario: Add a verified alternate name

- **WHEN** a moderator adds a verified alternate marketed name to an active Bottle
- **THEN** the system stores the BottleAlias for that Bottle
- **AND** records the acting moderator and creation time

#### Scenario: Reject a canonical duplicate

- **WHEN** a moderator submits an alias that is equivalent to the Bottle's current canonical name
- **THEN** the system rejects the write

#### Scenario: Allow the same display name on different Bottles

- **WHEN** the same marketed name applies to two distinct Bottles
- **THEN** the system permits one BottleAlias for each Bottle
- **AND** does not treat the shared display name as a globally unique resolution claim

#### Scenario: Reject a duplicate on one Bottle

- **WHEN** one Bottle already has an equivalent alias under accepted name normalization
- **THEN** the system rejects another equivalent alias for that Bottle

### Requirement: Alias presentation is independent from exact resolution

Creating, updating, or deleting a BottleAlias SHALL NOT create, verify, quarantine, retarget, or delete a BottleReference. A BottleAlias SHALL be search evidence but SHALL NOT by itself authorize an ingestion workflow to bypass classification.

#### Scenario: Add a display-only alias

- **WHEN** a moderator adds an ambiguous marketed name as a BottleAlias
- **THEN** the name can appear on the Bottle page and in user search
- **AND** exact source ingestion does not resolve to the Bottle from that alias alone

#### Scenario: Delete an alias that is also a reference string

- **WHEN** a moderator deletes a BottleAlias whose text also exists as an active BottleReference
- **THEN** the system removes only the BottleAlias
- **AND** leaves the BottleReference and its matching behavior unchanged

### Requirement: Bottle details expose verified aliases

The Bottle details API SHALL return verified aliases for the resolved Bottle in deterministic name order. Public list APIs SHALL NOT expose internal BottleReferences as aliases.

#### Scenario: Bottle has alternate names

- **WHEN** a client requests a Bottle that has verified aliases
- **THEN** the response includes those alias names in deterministic order

#### Scenario: Bottle has no alternate names

- **WHEN** a client requests a Bottle with no verified aliases
- **THEN** the response includes an empty alias list

#### Scenario: Resolve a Bottle tombstone

- **WHEN** a Bottle details request resolves a retired Bottle id to its replacement
- **THEN** the response includes aliases owned by the replacement Bottle

### Requirement: Bottle pages present alternate names plainly

The Bottle detail page SHALL show verified aliases under the label “Also known as” and SHALL omit the section when no verified aliases exist.

#### Scenario: Render alternate names

- **WHEN** Bottle details contain one or more aliases
- **THEN** the page shows each alias under “Also known as”

#### Scenario: Omit an empty section

- **WHEN** Bottle details contain no aliases
- **THEN** the page does not show an empty alternate-name section

### Requirement: Alias mutations remain moderator owned

Only moderators SHALL create or delete BottleAliases. Public users SHALL have read access through Bottle details but SHALL NOT mutate aliases.

#### Scenario: Moderator manages an alias

- **WHEN** an authenticated moderator creates or deletes a BottleAlias
- **THEN** the owning alias operation validates and applies the mutation
- **AND** refreshes affected Bottle search data

#### Scenario: Public user attempts a mutation

- **WHEN** a user without moderator authority attempts to create or delete a BottleAlias
- **THEN** the system rejects the request

### Requirement: Bottle lifecycle operations preserve aliases

An exact Bottle merge SHALL move source BottleAliases to the surviving Bottle and deduplicate equivalent target aliases. An ordinary canonical name edit SHALL NOT automatically turn the previous name into a displayed alias.

#### Scenario: Merge Bottles with aliases

- **WHEN** a moderator merges a source Bottle into a surviving Bottle
- **THEN** source aliases move to the surviving Bottle
- **AND** equivalent aliases are retained once

#### Scenario: Change a canonical name

- **WHEN** a Bottle's canonical name changes
- **THEN** any prior exact matching claim is preserved as a BottleReference
- **AND** no BottleAlias is created without separate moderator verification
