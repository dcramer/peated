## MODIFIED Requirements

### Requirement: Inbox projects every outstanding human decision

The system SHALL project unresolved listing decisions, unresolved critic-review matches, reviewable auction lots, independently reviewable Suggested Changes, remaining finding dispositions, open member reports, About spot checks, and About findings into one Inbox without creating a second durable task lifecycle.

#### Scenario: Listing requires a decision

- **WHEN** a store-price proposal requires a moderator to assign, create, repair, or ignore a listing
- **THEN** the Inbox contains one listing task with a stable key and a compact source summary

#### Scenario: Audit contains several Suggested Changes

- **WHEN** one Bottle check has multiple independently reviewable Review Operations
- **THEN** the Inbox contains one task for each Review Operation rather than one compound audit task

#### Scenario: Audit has findings after operation review

- **WHEN** a Bottle check has no remaining independently reviewable operation and still requires a finding disposition
- **THEN** the Inbox contains one finding task for that check

#### Scenario: Work needs only operational recovery

- **WHEN** a record is processing or its only valid next action is retry, resume, cancel, or wait
- **THEN** the record does not appear as an Inbox decision and is eligible for Background work instead

#### Scenario: About page is sampled

- **WHEN** a newly published About page is chosen for a spot check
- **THEN** the Inbox contains one spot-check task for that page that asks the
  moderator to mark each wrong fact or sentence, and the page stays published

#### Scenario: Automated update conflicts with a person's edit

- **WHEN** the About pipeline finds a source that disagrees with a fact a
  person wrote, or suggests a change to an Entity's identity
- **THEN** the Inbox contains one About finding task and the stored fact is
  unchanged
