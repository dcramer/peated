## ADDED Requirements

### Requirement: Removed StorePrice images stay removed

The system SHALL remember an image URL removed from a Bottle and SHALL NOT copy the same URL back from a StorePrice.

#### Scenario: Moderator removes a matched listing image

- **WHEN** a moderator removes a Bottle image and later approves a StorePrice match whose image has the same URL
- **THEN** the StorePrice, review, alias, and proposal are assigned to the selected Bottle
- **AND** the Bottle image remains empty

### Requirement: Other missing Bottle images can still be filled

The system SHALL allow a StorePrice image to fill an empty Bottle when that Bottle has not rejected the candidate URL.

#### Scenario: Bottle has no prior rejection for the candidate

- **WHEN** a StorePrice is matched to an empty Bottle that has not rejected the StorePrice image URL
- **THEN** the StorePrice image fills the Bottle image

#### Scenario: Bottle rejected a different image

- **WHEN** a StorePrice is matched to an empty Bottle that rejected a different image URL
- **THEN** the new StorePrice image remains eligible to fill the Bottle image
