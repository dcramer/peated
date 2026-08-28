## ADDED Requirements

### Requirement: Tasting bands

The system SHALL let a member give a tasting one of the five fixed bands:
Mediocre (0-79), Good (80-84), Very good (85-89), Outstanding (90-94), or
Unicorn (95-100). A tasting MAY have no band.

#### Scenario: Member records a band

- **WHEN** a member creates or updates a tasting with a valid band
- **THEN** the system stores that band on the tasting
- **AND** the tasting contributes one count to that Bottle's matching band

#### Scenario: Member records another tasting

- **WHEN** a member records another band-rated tasting for the same Bottle
- **THEN** the system keeps both tastings
- **AND** both tastings contribute to the band counts

#### Scenario: Invalid band

- **WHEN** a tasting request contains an unknown band
- **THEN** the system rejects the request

#### Scenario: Member tasting summary

- **WHEN** the system summarizes a member's tastings
- **THEN** it reports the five band counts instead of Pass, Sip, and Savor

### Requirement: Separate member reviews

The system SHALL store a member's 100-point Bottle assessment as a member
review, separate from their tastings. A member review SHALL contain a whole
number score from 0 through 100 and MAY contain notes.

Member reviews and external reviews SHALL represent the same broad concept: a
considered opinion about one exact Bottle. The system SHALL identify the source
when their ownership or fields differ. It SHALL NOT combine their tables because
external reviews have source-specific fields.

#### Scenario: Member writes a review

- **WHEN** a member reviews a Bottle they have not reviewed before
- **THEN** the system creates one member review with the submitted score and
  notes

#### Scenario: Member updates a review

- **WHEN** a member reviews the same Bottle again
- **THEN** the system updates their existing member review
- **AND** the Bottle has only one member review from that member

#### Scenario: Invalid member score

- **WHEN** a member submits a non-integer score or a score outside 0 through 100
- **THEN** the system rejects the request without rounding it

#### Scenario: Private member review is counted

- **WHEN** a private member writes a review
- **THEN** the score contributes to the member score count, median, minimum,
  and maximum
- **AND** the member's privacy setting does not remove the score from the
  Bottle summary

#### Scenario: Private member review is not shown to an unauthorized viewer

- **WHEN** a viewer cannot see a private member's tastings
- **THEN** the system does not return that member's review row, name, or notes
- **AND** the Bottle summary still includes the score without attribution

#### Scenario: Permitted viewer sees a private member review

- **WHEN** the member or another viewer can see the private member's tastings
- **THEN** that viewer can see the member's review under the same visibility
  rules

#### Scenario: Reviewed Bottles merge

- **WHEN** the same member reviewed two Bottles that later merge
- **THEN** the system keeps the review updated most recently
- **AND** the surviving Bottle has one review from that member

### Requirement: Historical tasting ratings

The system SHALL preserve existing Pass, Sip, Savor, and historical star values
as tasting history. It MUST NOT convert those values into bands, member reviews,
or new Bottle summaries.

#### Scenario: Existing simple or star rating

- **WHEN** a historical tasting has Pass, Sip, Savor, or a star value
- **THEN** the value remains readable on that tasting
- **AND** it does not create a band or member review

### Requirement: External scores that count

The system SHALL include an external review in the Bottle score only when the
review is public, the source permits score display, the review has an active
Bottle, and its native score is a whole number on a scale of exactly 100.
Application and API names SHALL call these records external reviews so they
cannot be confused with member reviews.

#### Scenario: Native 100-point review

- **WHEN** a public external review has a permitted native score of 91 out of
  100 and an active Bottle
- **THEN** it contributes 91 to that Bottle's score

#### Scenario: Other external scale

- **WHEN** an external review has a score of 8.4 out of 10, stars, a letter
  grade, or another non-100 scale
- **THEN** it remains visible with its native label when policy permits
- **AND** it does not contribute to the Bottle score or band counts

#### Scenario: Legacy normalized score

- **WHEN** an external review has an old normalized score but no permitted native
  100-point score
- **THEN** the normalized score does not contribute to any new summary

#### Scenario: New external review import

- **WHEN** an external review is imported or updated
- **THEN** the system stores only its native score value, scale, and display text
- **AND** it does not write a converted value to the legacy normalized score

#### Scenario: Moderator records an external score

- **WHEN** a moderator records an external review manually
- **THEN** the system stores the publication's displayed value, scale, and label
- **AND** it does not require a converted 100-point value

### Requirement: Bottle score

The system SHALL calculate the Bottle score as the median of member review
scores and permitted external review scores. For an even count, it SHALL use
the lower middle score. The score SHALL be null until the
combined count reaches 20.

#### Scenario: Fewer than 20 scores

- **WHEN** a Bottle has fewer than 20 counted member and external scores
- **THEN** its median score is null
- **AND** its minimum and maximum scores are null
- **AND** score sorting places it after Bottles with a visible median

#### Scenario: Twenty scores

- **WHEN** a Bottle reaches 20 counted scores
- **THEN** the system publishes its median, minimum, maximum, total count,
  member count, and external count

#### Scenario: Even score count

- **WHEN** a Bottle has an even number of counted scores
- **THEN** the median is the lower of the two middle scores

#### Scenario: Band-only Bottle

- **WHEN** a Bottle has tasting bands but fewer than 20 counted review scores
- **THEN** its band counts are available
- **AND** its median score remains null

### Requirement: Separate score and band counts

The system MUST keep review scores and tasting bands separate. It MUST NOT turn
a band into a point or count a point score as a band rating.

#### Scenario: Point score falls within a band

- **WHEN** a member or external review has a score that falls within a named
  band
- **THEN** the UI may use that band to explain or draw the score
- **AND** the score does not increase the Bottle's tasting band count

### Requirement: Rating display

The system SHALL show tasting bands in the fixed order from Mediocre through
Unicorn. Whenever it names a band, it SHALL show the band's range. It MUST NOT
present the band distribution as a percentage, stars, or a five-point score.

#### Scenario: Band summary

- **WHEN** a Bottle has one or more band-rated tastings
- **THEN** the system shows their counts in the fixed band order
- **AND** it does not print a percentage or star rating

#### Scenario: Score is below the minimum count

- **WHEN** fewer than 20 review scores count for a Bottle
- **THEN** the score area shows no dash, zero, or estimated score
- **AND** the page may link to the Bottle review form

### Requirement: BottleGroup summaries

The system SHALL calculate the same score and band summary for a BottleGroup
from member reviews, permitted external reviews, and band-rated tastings on its
active member Bottles.

#### Scenario: Group contains several releases

- **WHEN** a BottleGroup contains several active Bottles with reviews and
  tastings
- **THEN** its summary includes the counted reviews and tastings from all active
  member Bottles once

### Requirement: Separate user actions

The system SHALL show bands on the tasting form and the 100-point scale on the
Bottle review form. It SHALL NOT require a profile preference or a switch
between rating types.

#### Scenario: Member logs a tasting

- **WHEN** a member opens the tasting form
- **THEN** the form offers the five bands and no 100-point input

#### Scenario: Member reviews a Bottle

- **WHEN** a member opens the Bottle review form
- **THEN** the form offers a whole-number 100-point score and optional notes

### Requirement: Bottle recommendations

The system SHALL base community Bottle recommendations on members who recorded
Outstanding or Unicorn tasting bands for both Bottles. It SHALL count each
member once per Bottle and SHALL NOT use member or external review scores for
this calculation.

#### Scenario: Members highly rate both Bottles

- **WHEN** enough distinct members record Outstanding or Unicorn tastings for a
  source Bottle and another Bottle
- **THEN** the other Bottle can appear in the source Bottle's recommendations

#### Scenario: Review score without a top tasting band

- **WHEN** a member or external review has a high score but no member recorded
  an Outstanding or Unicorn tasting band
- **THEN** that score does not make the Bottle a recommendation
