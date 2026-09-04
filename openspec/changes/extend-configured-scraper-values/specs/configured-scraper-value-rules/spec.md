## ADDED Requirements

### Requirement: Saved value rules use versioned bounded operations

The system SHALL support configured scraper rules version 2 without changing
the schema or behavior of stored version 1 revisions. A version 2 value rule
MUST use exactly one CSS selector or one fixed value and MUST reject arbitrary
regular expressions, scripts, templates, and values beyond the documented
limits.

#### Scenario: A version 1 revision runs after version 2 is deployed

- **WHEN** preview, collection, replay, or rollback loads a stored version 1 revision
- **THEN** the system validates and reads it with the version 1 schema and interpreter

#### Scenario: A value rule has conflicting inputs

- **WHEN** a version 2 value rule contains both a selector and a fixed value, or neither input
- **THEN** strict rule validation rejects the complete revision

#### Scenario: A value rule contains executable matching logic

- **WHEN** a version 2 rule contains a regular expression, script, template, or unsupported key
- **THEN** strict rule validation rejects the complete revision

### Requirement: Selector values can filter and join source text

The system SHALL let a version 2 selector value filter normalized element text
by a bounded list of case-insensitive literal prefixes. It SHALL read the first
remaining element by default or, when `all` is true, join at most 100 remaining
elements in document order with one space. An attribute selector MUST NOT use
text-prefix filtering or multi-element joining.

#### Scenario: Review evidence uses named tasting sections

- **WHEN** a review-text selector matches paragraphs and filters for `Nose:`, `Palate:`, `Taste:`, and `Finish:` with `all` true
- **THEN** the parser joins only matching paragraph text in document order and excludes introductions, prices, scores, and signatures

#### Scenario: A score changes position in an article

- **WHEN** a score selector matches several headings and paragraphs but filters for the literal prefix `Score`
- **THEN** the parser reads the first matching score text regardless of its element position

#### Scenario: Too many elements match a joined value

- **WHEN** more than 100 elements remain after selector and prefix filtering
- **THEN** parsing reports a bounded value error instead of reading or storing a partial joined value

### Requirement: List items can exclude unavailable entries

The system SHALL let a version 2 list rule scope its detail-link selector to a
CSS-selected item. It SHALL optionally skip an item when a selector inside that
item finds normalized text, limited when configured to a bounded list of
case-insensitive literal prefixes. An exclusion rule MUST require an item
selector. Version 1 list selection MUST remain unchanged.

#### Scenario: A product card is sold out

- **WHEN** a list item contains a badge beginning with `Sold out` and `excludeWhen` selects badges with that literal prefix
- **THEN** the parser skips that item's detail link and continues with the remaining cards in document order

#### Scenario: An exclusion has no item scope

- **WHEN** a version 2 list rule supplies `excludeWhen` without an `item` selector
- **THEN** strict rule validation rejects the complete revision

### Requirement: Value rules can apply literal cleanup

The system SHALL let a version 2 value remove the first matching literal from
bounded ordered prefix and suffix lists and then add bounded literal prefix and
suffix text. Matching MUST be case-insensitive, MUST remove text only at the
matching end of the value, and MUST preserve the source spelling of all
remaining text.

#### Scenario: A review title carries an editorial suffix

- **WHEN** the source value ends with `Shelf Review` or `Review` and those literals are configured as removable suffixes
- **THEN** the parser removes only the matching final literal and returns the remaining trimmed bottle name

#### Scenario: A shop heading omits its producer

- **WHEN** a product name value has the prefix `Kilchoman `
- **THEN** the parser prepends that literal once to the selected source text before product validation

#### Scenario: A score display includes an editorial label

- **WHEN** a score begins with `Score:` and the configured output adds `/100`
- **THEN** the parser preserves the numeric source text and emits the existing `90/100` display form

#### Scenario: A cleanup result is empty

- **WHEN** literal cleanup leaves no non-whitespace text
- **THEN** the parser treats the field as missing and existing output validation rejects it when required

### Requirement: Fixed values remain visible source claims

The system SHALL let a version 2 rule provide bounded fixed text for a value
that is stable across the selected source, and SHALL pass it through the same
conversion and output validation as selected text. Production and local
previews MUST show the converted output before activation.

#### Scenario: A selected shop list has one fixed bottle size

- **WHEN** a price rule supplies the fixed value `700 ml` for volume
- **THEN** preview and collection validate and emit 700 milliliters for each selected product

#### Scenario: A fixed value cannot be converted

- **WHEN** a fixed price, score, date, or volume value does not satisfy the field conversion and output schema
- **THEN** preview or collection reports the owning detail field and writes no product output for the failed run

### Requirement: Every rule-authoring path uses the version 2 contract

The system SHALL let admins author version 2 rules manually and through AI
setup. AI setup SHALL receive the same strict schema and operation order as the
runtime, and SHALL use fixed values only for stable facts supported by the
selected public source. The local preview command MUST accept a rules version
and run it through the same versioned parser, validators, request controls, and
no-write sink as production preview.

#### Scenario: AI proposes value operations

- **WHEN** AI setup needs bounded literal cleanup or addition, a fixed value, or joined filtered text to parse supplied pages
- **THEN** it can propose only the bounded version 2 operations and code checks their final output before AI review

#### Scenario: An admin previews a version 2 file locally

- **WHEN** the admin runs the local preview command with a version 2 rules file
- **THEN** the command reports production-shaped output and issues without writing reviews or prices

#### Scenario: A new revision is saved

- **WHEN** an admin saves valid version 2 rules from AI setup or manual editing
- **THEN** the immutable revision records rules version 2 and activation still requires a passing production preview
