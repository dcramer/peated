## ADDED Requirements

### Requirement: Uniform 100-point rubric

The system SHALL accept whole-number community scores from 0 through 100 and SHALL interpret them using the Peated bands 95-100 Extraordinary, 90-94 Exceptional, 85-89 Very good, 80-84 Good, 75-79 Fair, and 0-74 Not recommended. The published method SHALL tell users to start at 80 for a good whisky, adjust a single whole-whisky score for its strengths and flaws, and choose the bottom, middle, or top of the resulting band without requiring subscores.

#### Scenario: User evaluates a score

- **WHEN** a user enters or views an advanced score of 92
- **THEN** the system identifies the score as Exceptional

#### Scenario: Fractional score is rejected

- **WHEN** a client submits an advanced score with a fractional value
- **THEN** the system rejects the input

#### Scenario: Out-of-range score is rejected

- **WHEN** a client submits an advanced score below 0 or above 100
- **THEN** the system rejects the input

#### Scenario: User chooses an exact score

- **WHEN** a user follows the Peated method for a whisky that clearly fits Very good but is not close to Exceptional
- **THEN** the guidance leads them toward the middle of the 85-89 band without requiring category arithmetic

### Requirement: Alternative tasting rating systems

The system SHALL allow a tasting to contain a simple Pass/Sip/Savor rating or an advanced score, SHALL allow neither, and SHALL prevent both from being stored on the same tasting.

#### Scenario: Advanced tasting is created

- **WHEN** a user creates a tasting with an advanced score and no simple rating
- **THEN** the tasting stores and returns the advanced score

#### Scenario: Conflicting ratings are rejected

- **WHEN** a create request contains both a simple rating and an advanced score
- **THEN** the system rejects the request without creating a tasting

#### Scenario: User replaces a rating system

- **WHEN** a user updates an existing simple-rated tasting with a non-null advanced score
- **THEN** the system stores the advanced score and clears the simple rating

#### Scenario: User clears a score

- **WHEN** a user updates an advanced-rated tasting with a null advanced score
- **THEN** the system clears the score without inventing a simple rating

### Requirement: Persisted rating-system preference

The system SHALL persist each user's preferred tasting rating system as Simple or Advanced, SHALL default new users to Simple, and SHALL expose the preference only with private account fields.

#### Scenario: New user keeps approachable default

- **WHEN** a user has not changed their rating-system preference
- **THEN** a new tasting form defaults to the Simple input

#### Scenario: Advanced preference follows the account

- **WHEN** a user saves Advanced as their preferred rating system and opens a new tasting form on another device
- **THEN** the form defaults to the 100-point input

#### Scenario: Account preference controls edit mode

- **WHEN** an Advanced-preferring user edits a tasting that already has a simple rating
- **THEN** the form displays the 100-point input and does not offer a system selector

#### Scenario: Hidden existing rating is preserved

- **WHEN** a user saves an existing tasting without entering a rating in the system selected in their profile
- **THEN** the tasting keeps its existing rating value

### Requirement: Independent community aggregates

The system SHALL aggregate simple ratings and advanced scores independently, SHALL calculate advanced aggregates as an arithmetic mean with a score count, and SHALL never include external critic reviews or legacy five-star values in either community aggregate.

#### Scenario: Mixed community rating systems

- **WHEN** a bottle has one Savor tasting and advanced scores of 84 and 88
- **THEN** its simple distribution contains one Savor and its advanced aggregate is 86.0 from two scores

#### Scenario: External review remains separate

- **WHEN** the same bottle has an imported critic review scored 95
- **THEN** the community advanced aggregate remains 86.0 from two scores

#### Scenario: Tasting without rating affects only tasting count

- **WHEN** a tasting has neither a simple rating nor an advanced score
- **THEN** it increases total tastings but not simple-rating or advanced-score counts

### Requirement: Exact Bottle and BottleGroup score scope

The system SHALL maintain advanced score averages and counts for exact Bottles and their BottleGroups using raw tastings in the relevant scope.

#### Scenario: Exact Bottle score contributes to both scopes

- **WHEN** a score is recorded against an exact Bottle
- **THEN** it contributes to that Bottle's advanced aggregate and its BottleGroup's advanced aggregate

#### Scenario: Sibling scores remain exact

- **WHEN** scores are recorded against two sibling Bottles in one BottleGroup
- **THEN** each Bottle aggregate uses only its own tastings while the BottleGroup aggregate uses both

#### Scenario: Score edit repairs aggregates

- **WHEN** a stored advanced score is changed or removed
- **THEN** the affected Bottle and BottleGroup averages and counts are recomputed from current tasting data

### Requirement: Explicit user-facing attribution

The system SHALL label community advanced aggregates separately from simple community ratings and source-attributed external critic reviews, and SHALL display individual community scores as integer points and aggregate community scores to one decimal with their count.

#### Scenario: Bottle has all rating populations

- **WHEN** a bottle has simple ratings, community advanced scores, and external critic reviews
- **THEN** the bottle page presents each population with distinct labels and counts without a combined rating

#### Scenario: Advanced tasting is displayed

- **WHEN** a tasting has a score of 87
- **THEN** its tasting display shows 87 points and does not show a Pass/Sip/Savor value

### Requirement: Public rating methodology

The system SHALL provide a public ratings page describing Pass/Sip/Savor, every advanced score band, evaluation guidance, arithmetic aggregation, and the separation of community scores from external critic reviews.

#### Scenario: User requests scoring guidance

- **WHEN** a visitor opens the public ratings page
- **THEN** the visitor can determine what an 80, 85, 90, and 95 mean, how to choose and adjust a score, and what factors the score excludes

#### Scenario: Form links to methodology

- **WHEN** an Advanced-preferring user opens a tasting form
- **THEN** the form presents compact score-band guidance and a link to the public ratings page

### Requirement: Discoverable advanced score data

The system SHALL document advanced score fields in its public API and SHALL support independent sorting and minimum-score filtering without substituting simple ratings.

#### Scenario: API consumer inspects a tasting

- **WHEN** an API consumer reads a tasting with an advanced score
- **THEN** the response identifies the integer 0-100 score separately from the simple rating

#### Scenario: Bottles are sorted by advanced score

- **WHEN** a client requests bottles ordered by descending advanced score
- **THEN** scored bottles are ordered by their advanced average with unscored bottles last

#### Scenario: Bottles are filtered by advanced score

- **WHEN** a client requests bottles with a minimum advanced score of 85
- **THEN** only bottles with non-null advanced averages of at least 85 are returned
