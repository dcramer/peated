## ADDED Requirements

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
