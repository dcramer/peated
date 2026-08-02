## ADDED Requirements

### Requirement: Actionable checks and operations are durable

The system SHALL persist current actionable workflow state and one child row
per proposed operation, including operations blocked during preparation.

#### Scenario: Check completes

- **WHEN** a store-price or post-user-creation check completes with a valid
  intent-specific result
- **THEN** the server SHALL store its input snapshot, result, artifacts, model
  metadata, source or Bottle subject, and proposed operations

#### Scenario: Manual audit is clean

- **WHEN** a moderator audit returns no findings or proposed operations
- **THEN** the server SHALL return a typed clean result with its summary
- **AND** it SHALL persist no check or operation rows
- **AND** it SHALL remove older terminal moderator audits for that Bottle

#### Scenario: Manual audit already has current work

- **WHEN** an open moderator audit for the Bottle has findings or an operation
  in `blocked | pending_review | applying | stale | failed`
- **THEN** the server SHALL return that check without another model call

#### Scenario: Manual audit creates replacement work

- **WHEN** a moderator audit returns findings or proposed operations and no
  current actionable check exists
- **THEN** the server SHALL persist one current check
- **AND** it SHALL remove older terminal moderator audits for that Bottle
- **AND** it SHALL preserve prior `blocked | pending_review | applying | stale |
failed` work

#### Scenario: Store-price classification invokes a check

- **WHEN** a store-price attempt runs `resolve_reference`
- **THEN** the attempt and current proposal SHALL link to the check
- **AND** the server SHALL reject a missing attempt or an attempt for another
  price rather than accepting a proposal-only compatibility link
- **AND** their existing decision fields SHALL remain authoritative in v1

### Requirement: Review surfaces show intent-specific results and operations

The moderator UI SHALL show the check subject, intent-specific result, findings,
evidence, and one card per operation in the selected check.

#### Scenario: Review an incoming reference

- **WHEN** a reference check has additional operations
- **THEN** the UI SHALL show the existing decision first and cleanup operation
  cards below it

#### Scenario: Review an existing-Bottle audit

- **WHEN** an audit is clean or has proposed changes
- **THEN** the UI SHALL show the audited Bottle, audit summary, evidence, and
  any Bottle or Entity operation cards

#### Scenario: Completed audit is clean

- **WHEN** a valid audit has no operations or findings
- **THEN** the UI SHALL show the transient clean-audit result
- **AND** it SHALL not show empty approval controls

### Requirement: Actionable Bottle checks have one inbox

The moderator UI SHALL place post-user-creation and moderator-triggered audit
checks with findings or operations needing disposition in one Bottle Checks
workstream, one row per open check.

#### Scenario: Background audit needs attention

- **WHEN** a post-user-creation audit returns findings or operations
- **THEN** it SHALL appear in Bottle Checks without requiring discovery from
  the Bottle detail page

#### Scenario: Store-price check needs attention

- **WHEN** a store-price reference check returns supplemental operations
- **THEN** those operations SHALL remain in Incoming Listings
- **AND** they SHALL NOT also create a Bottle Checks inbox row

#### Scenario: Primary store-price decision is complete

- **WHEN** any linked check still has findings or operations needing
  disposition after its primary store-price decision completes
- **THEN** Incoming Listings SHALL retain one row for the listing
- **AND** it SHALL show the primary decision as complete and the supplemental
  work as remaining

### Requirement: Operation previews come from current server state

The server SHALL build previews from current records and canonical schemas
rather than trusting model prose. A blocked operation SHALL show its preparation
error instead of an invented preview.

#### Scenario: Preview a Bottle operation

- **WHEN** a moderator opens a Bottle update or merge
- **THEN** the preview SHALL show before/after state, BottleGroup fan-out,
  affected consumers, and blocking warnings

#### Scenario: Preview an Entity operation

- **WHEN** a moderator opens an Entity update or merge
- **THEN** the preview SHALL show normalized identity, roles, collisions,
  before/after state, affected Bottles/series, and blocking warnings

### Requirement: Moderators review operations independently

Every operation SHALL have an independent
`blocked | pending_review | rejected | applying | applied | stale | failed`
lifecycle.

For inbox behavior, `pending_review | blocked | stale | failed` SHALL need
disposition, `applying` SHALL be in progress, and `applied | rejected` SHALL be
done.

#### Scenario: Approve selected operations

- **WHEN** a moderator approves one or more current operations
- **THEN** the server SHALL process each independently
- **AND** the API and UI SHALL report a result for each operation

#### Scenario: Reject cleanup but accept reference decision

- **WHEN** a moderator rejects supplemental operations
- **THEN** a safe primary reference decision SHALL remain available through its
  existing workflow

#### Scenario: Reject an operation

- **WHEN** a moderator rejects an operation
- **THEN** they SHALL select
  `wrong_target | wrong_change | insufficient_evidence | resolved_manually |
other`
- **AND** they MAY add an optional note
- **AND** a note SHALL be required when the reason is `other`

#### Scenario: Unauthorized disposition

- **WHEN** a non-moderator attempts approval, rejection, or retry
- **THEN** the server SHALL reject the request without changing state

#### Scenario: Retry a failed operation

- **WHEN** a moderator retries an operation in `failed`
- **THEN** the server SHALL first reconcile prior execution
- **AND** a confirmed prior mutation SHALL move the operation to `applied`
- **AND** an unapplied operation that passes live validation SHALL return the
  same operation id to `applying`
- **AND** relevant drift SHALL move it to `stale`
- **AND** an indeterminate result SHALL remain `failed` with a safe error
- **AND** the catalog mutation SHALL take effect at most once

#### Scenario: Operation is not directly retriable

- **WHEN** an operation is `blocked`, `stale`, or `applying`
- **THEN** the server SHALL reject a direct retry
- **AND** blocked or stale work SHALL require a new check or manual correction
- **AND** applying work SHALL be resolved by reconciliation

#### Scenario: Parent check is closed

- **WHEN** a moderator attempts to approve, reject, or retry an operation whose
  parent check is closed
- **THEN** the server SHALL reject the action without changing state
- **AND** further work SHALL require a new check

### Requirement: Approval revalidates current state

The approval service SHALL lock the operation row and rerun live validation
before mutation.

#### Scenario: Operation remains valid

- **WHEN** the current operation passes live validation
- **THEN** approval SHALL atomically record the moderator and move it from
  `pending_review` to `applying`
- **AND** the catalog mutation SHALL take effect at most once

#### Scenario: Relevant catalog state changed

- **WHEN** a field or relationship covered by the operation's state token
  no longer matches the reviewed state
- **THEN** the operation SHALL become `stale`
- **AND** no mutation SHALL occur

#### Scenario: Unrelated catalog state changed

- **WHEN** unrelated fields, counts, or timestamps change after preview
- **THEN** approval SHALL recompute the preview without treating recency or
  broad `updatedAt` drift as proof that the operation is invalid

### Requirement: Checks with findings can be closed

A moderator SHALL be able to close an open check as
`dismissed | resolved_manually` with an optional note. Findings SHALL NOT have
independent lifecycle records.

An operations-only check with every operation `applied | rejected` SHALL leave
the inbox automatically. Explicit closure SHALL be reserved for remaining
findings, blocked/stale/failed work, dismissal, or manual resolution.

#### Scenario: Moderator acknowledges findings

- **WHEN** a check has findings and no `pending_review` or `applying`
  operations
- **THEN** a moderator MAY close the check
- **AND** it SHALL leave the active inbox

#### Scenario: Check still has undecided work

- **WHEN** any operation is `pending_review` or `applying`
- **THEN** the server SHALL reject check closure

#### Scenario: Moderator corrects catalog data manually

- **WHEN** a proposal is directionally useful but its exact change is wrong
- **THEN** the read-only operation card SHALL link to the existing Bottle or
  Entity editor
- **AND** after the correction, refreshed preparation SHALL mark the pending
  operation stale or the moderator SHALL reject it as `resolved_manually`
- **AND** the moderator MAY then close the check as `resolved_manually`
- **AND** the system SHALL NOT add editable operation revisions

### Requirement: Only the end-user add-Bottle primary result may auto-apply

Supplemental catalog operations SHALL always require explicit moderator
approval, regardless of source or confidence.

#### Scenario: End user adds a Bottle

- **WHEN** the add-Bottle workflow produces a primary classifier decision that
  satisfies its existing automation policy
- **THEN** that workflow MAY apply the primary decision automatically
- **AND** any supplemental operations SHALL remain pending moderator review

#### Scenario: Another workflow runs a check

- **WHEN** store-price matching or a moderator audit produces operations
- **THEN** the system MAY persist and surface them automatically
- **AND** it SHALL NOT apply them without moderator approval

### Requirement: Newly added Bottles receive background audits

The existing `VerifyBottleCreation` job SHALL run one idempotent
`audit_bottle` check for 100% of eligible `manual_entry`
Bottles. `price_match_automation` Bottles SHALL use a deterministic sample that
defaults to 10%. The check SHALL run after the authoritative Bottle save
commits.

#### Scenario: User-created Bottle commits

- **WHEN** an eligible `manual_entry` Bottle commits
- **THEN** the save response SHALL complete without waiting for the audit
- **AND** `VerifyBottleCreation` SHALL run the check against the committed
  Bottle using the existing Bottle-creation event and origin for retry safety

#### Scenario: Automated price-match Bottle commits

- **WHEN** deterministic sampling selects a `price_match_automation` Bottle
- **THEN** `VerifyBottleCreation` SHALL run the same post-create check
- **AND** the sample rate SHALL default to 10%

#### Scenario: Post-create audit proposes changes

- **WHEN** the background audit returns proposed operations
- **THEN** the system SHALL create moderator-review operation proposals
- **AND** it SHALL NOT mutate the Bottle or related Entities automatically

#### Scenario: Existing Bottle verification logic transitions

- **WHEN** Bottle post-create verification uses the new check
- **THEN** it SHALL replace the previous Bottle-specific heuristic
  passed/flagged finding calculation
- **AND** 100% coverage of eligible `manual_entry` Bottles, deterministic
  `price_match_automation` sampling, and unique-job behavior SHALL remain
- **AND** it SHALL NOT create a second actionable verification result or queue

### Requirement: Bottle operations use canonical services

Approved Bottle operations SHALL delegate to existing canonical services.

#### Scenario: Execute Bottle update

- **WHEN** `update_bottle` is approved
- **THEN** it SHALL delegate to `updateConcreteBottle`

#### Scenario: Execute Bottle merge

- **WHEN** `merge_bottles` is approved
- **THEN** it SHALL delegate to `mergeConcreteBottles`

### Requirement: Entity operations use canonical services

Approved Entity operations SHALL delegate to canonical Entity update and merge
workflows.

#### Scenario: Execute Entity update

- **WHEN** `update_entity` is approved
- **THEN** it SHALL call the canonical service extracted from Entity update
- **AND** related Bottle rematerialization and alias safety SHALL retain current
  behavior

#### Scenario: Execute Entity merge

- **WHEN** `merge_entities` is approved
- **THEN** it SHALL dispatch the established Entity merge workflow with the
  approved source, destination, operation id, and approving moderator actor
- **AND** the operation SHALL remain `applying` until that workflow records a
  terminal result
- **AND** catalog mutations SHALL attribute the approving moderator while
  execution metadata identifies the system worker

### Requirement: Execution records per-operation outcomes

The system SHALL record safe results or errors without changing unrelated
operations or the check result.

#### Scenario: Canonical operation succeeds

- **WHEN** the operation and required finalization complete
- **THEN** the proposal SHALL become `applied` with its result
- **AND** retries SHALL not repeat the completed mutation
- **AND** success SHALL reflect the canonical service result or resulting
  database state rather than successful dispatch alone

#### Scenario: Canonical operation fails

- **WHEN** execution raises an unexpected failure
- **THEN** the proposal SHALL become `failed` with a safe error
- **AND** independently completed operations SHALL remain applied
