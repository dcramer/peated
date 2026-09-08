## ADDED Requirements

### Requirement: Old star conversion

The system SHALL convert supported historical quarter-star values to current
tasting ratings using this fixed mapping: 0.25–2.00 to Mediocre, 2.25–3.00 to
Good, 3.25–4.00 to Very good, 4.25–4.50 to Outstanding, and 4.75–5.00 to
Unicorn. It MUST leave zero, out-of-range values, and values outside
quarter-star steps unconverted.

#### Scenario: Supported star value

- **WHEN** a historical tasting has 3.75 stars and no current rating
- **THEN** the conversion assigns Very good

#### Scenario: Historical zero

- **WHEN** a historical tasting has zero stars
- **THEN** the preview reports it as not converted and does not assign a current
  rating

#### Scenario: Unsupported star value

- **WHEN** a historical tasting has an out-of-range or non-quarter-star value
- **THEN** the preview reports it as not converted and does not assign a current
  rating

### Requirement: Current rating wins

The system MUST assign a converted rating only when the tasting's current
rating is null. It MUST preserve both historical rating values whether or not
it assigns a current rating.

#### Scenario: Tasting already has a current rating

- **WHEN** a historical tasting already has a current rating
- **THEN** the conversion leaves that rating unchanged
- **AND** reports the tasting as already rated

#### Scenario: Historical evidence is retained

- **WHEN** the conversion assigns a current rating
- **THEN** the exact historical star and Pass/Sip/Savor values remain unchanged

#### Scenario: Concurrent member edit

- **WHEN** a tasting gains a current rating after preview but before conversion
- **THEN** the conversion does not overwrite the member's rating
- **AND** rolls back the stale write set

### Requirement: Fresh preview count

The system SHALL provide an administrator-only preview that reports
`oldStarRatings`, `willConvert`, `alreadyRated`, `notConverted`, `ratings`, and
`bottles`. A separate administrator-only conversion request MUST require
`expectedConversions` copied from `willConvert` in a current preview.

#### Scenario: Preview request

- **WHEN** an administrator requests a preview
- **THEN** it reports what would change without changing a tasting or starting
  Bottle total updates

#### Scenario: Matching expected count

- **WHEN** an administrator requests conversion with the current preview count
- **THEN** it applies exactly that many conversions

#### Scenario: Stale expected count

- **WHEN** `expectedConversions` differs from the current `willConvert` count
- **THEN** the API returns a conflict before changing any tasting

#### Scenario: Non-administrator request

- **WHEN** a non-administrator requests preview or conversion
- **THEN** the API rejects the request

### Requirement: Bottle rating totals

After a successful conversion, the system SHALL start the existing rating-total
update for every Bottle that has a converted old star rating. Sending
`expectedConversions: 0` after every row is converted SHALL start the same
updates without changing tasting rows.

#### Scenario: Successful conversion

- **WHEN** the conversion changes one or more old tastings
- **THEN** Peated starts updating the affected Bottle and BottleGroup rating
  totals

#### Scenario: Summary retry

- **WHEN** the ratings are already converted and an administrator sends
  `expectedConversions: 0`
- **THEN** no tasting changes
- **AND** the affected Bottle rating-total updates start again

#### Scenario: A total update cannot start

- **WHEN** a tasting conversion is saved but a Bottle rating-total update cannot
  start
- **THEN** the conversion still succeeds
- **AND** the response reports the failed update
- **AND** the administrator can start the Bottle updates again from Maintenance

### Requirement: Admin Maintenance page

The system SHALL give administrators a Maintenance page that previews the old
star rating repair and provides a direct way to start it. The page MUST show the
current counts before offering the action and MUST ask for confirmation before
it sends the conversion request.

#### Scenario: Administrator opens Maintenance

- **WHEN** an administrator opens the Maintenance page
- **THEN** the page shows how many tastings will change, how many will not
  change, and how many Bottles need updated totals

#### Scenario: Administrator starts the repair

- **WHEN** an administrator confirms the old star rating repair
- **THEN** the page sends the previewed conversion count
- **AND** reloads the preview after the request succeeds

#### Scenario: Repair is complete

- **WHEN** the preview reports no tastings left to convert
- **THEN** the page says that there is nothing to convert
- **AND** does not offer the conversion action
