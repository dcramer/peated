## ADDED Requirements

### Requirement: Stable auction occurrence identity

The system SHALL identify auctions by site and source auction key, and lots by auction and source lot key. Relisted and simultaneous lots SHALL remain distinct even when they resolve to the same Bottle.

#### Scenario: Repeated collection and relisting

- **WHEN** the same lot is collected twice and a corresponding lot appears in a later auction
- **THEN** the repeated collection updates one row and the later auction creates another occurrence

### Requirement: Evidence-backed availability

The system SHALL retain source-reported state and successful check times, and SHALL distinguish confirmed availability from stale or expired evidence. Failures and index disappearance MUST NOT prove closure.

#### Scenario: Deadline and outage

- **WHEN** a live lot's known deadline passes without a confirmed extension, or its evidence becomes stale
- **THEN** it is no longer presented or notified as confirmed live while its stored source state remains available for reconciliation

### Requirement: Durable result history

The system SHALL store source-reported sale outcomes and append changed result revisions. Current bids MUST NOT become hammer prices without sale evidence. Public history SHALL select at most one current result per lot.

#### Scenario: Unsold lot and corrected result

- **WHEN** a lot is reported unsold despite a highest bid, or its final sale price is later corrected
- **THEN** the unsold lot has no sale price and the correction preserves the earlier result without duplicate sales

### Requirement: Reviewed Bottle resolution

The system SHALL reuse accepted references or reviewed classifier evidence and SHALL validate source versions before assigning one active Bottle. Unresolved ended lots SHALL remain reviewable.

#### Scenario: Late match and changed evidence

- **WHEN** matching completes after closure or source identity changes during classification
- **THEN** the late match can populate history without an availability alert and stale classification cannot assign the changed lot

### Requirement: Private watches and durable availability alerts

The system SHALL allow authenticated members to watch an exact Bottle and SHALL create one in-app availability alert per member and lot only while their watch, lot assignment, and availability remain valid. Watch and alert records MUST remain private.

#### Scenario: Retry and notification deletion

- **WHEN** availability processing repeats after a notification is deleted
- **THEN** durable alert uniqueness prevents another notification for that member and lot

### Requirement: Complete runtime collection

Auction collection SHALL use the shared scraper runtime and resumable checkpoints, SHALL traverse complete auction listings, and SHALL revisit known closing lots for final outcomes. Sources MUST retain unknown facts rather than guess missing prices or statuses.

#### Scenario: Interrupted pagination

- **WHEN** a collection run stops after a saved page
- **THEN** resumed work safely repeats or continues that page without losing lots or duplicating history
