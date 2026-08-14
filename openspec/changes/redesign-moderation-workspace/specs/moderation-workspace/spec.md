## ADDED Requirements

### Requirement: Moderation access remains administrator-only

The system SHALL require administrator authority for the Moderation Inbox, History, Automation, and every moderation read or mutation they invoke.

#### Scenario: Administrator opens Moderation

- **WHEN** an authenticated administrator opens a Moderation destination
- **THEN** the system displays the requested moderation data and available actions

#### Scenario: Non-administrator opens Moderation

- **WHEN** a user without administrator authority requests a Moderation destination or moderation read contract
- **THEN** the system rejects access using the existing administrator boundary

### Requirement: Moderation has three purpose-specific destinations

The system SHALL present Inbox, History, and Automation as the primary Moderation destinations and SHALL keep ordinary Admin tools in a separate navigation section.

#### Scenario: Moderator enters the product

- **WHEN** an administrator enters Moderation without a child destination
- **THEN** the system opens the Inbox directly

#### Scenario: Moderator changes destination

- **WHEN** the moderator selects History or Automation
- **THEN** the system changes to that destination without presenting pending decisions and operational controls as one dashboard

### Requirement: Inbox projects every outstanding human decision

The system SHALL project unresolved listing decisions, independently reviewable Suggested Changes, and remaining finding dispositions into one Inbox without creating a second durable task lifecycle.

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
- **THEN** the record does not appear as an Inbox decision and is eligible for Automation instead

### Requirement: Inbox summaries are narrow and deterministic

The system SHALL return strict task summaries containing only the stable source identity and fields needed to discover and order work. It SHALL order the default Inbox by oldest attention time first with a stable task-key tie-breaker.

#### Scenario: Mixed task sources are listed

- **WHEN** listing, operation, and finding tasks are simultaneously actionable
- **THEN** the system returns them in one deterministic order without embedding their full source detail payloads

#### Scenario: Two tasks have the same attention time

- **WHEN** two tasks have equal attention timestamps
- **THEN** their stable task keys determine a repeatable order across requests

#### Scenario: Inbox is filtered

- **WHEN** the moderator filters by listing, catalog, or blocked work or enters a search query
- **THEN** the URL records the filter and the task list and counts reflect it

### Requirement: One task asks one human question

The system SHALL render each selected task as one focused domain question with source context, a recommended outcome or blocking explanation, one primary action, valid alternatives, and a bounded impact statement when applicable.

#### Scenario: Moderator selects a task

- **WHEN** the moderator opens an Inbox task
- **THEN** the detail view leads with the human decision and does not require understanding queue, model, or schema internals

#### Scenario: Task has an important warning

- **WHEN** a mutation has a warning, blocking reason, changed-field set, or affected-resource impact
- **THEN** the primary view displays that information without requiring a disclosure to be opened

### Requirement: Listing tasks preserve listing-owned decisions

The listing task renderer SHALL support match-existing, create-Bottle, same-Bottle correction, no-match/manual selection, and ignore outcomes through the existing listing-owned capabilities.

#### Scenario: Existing Bottle is suggested

- **WHEN** a listing task has an approvable existing-Bottle recommendation
- **THEN** the view presents that Bottle, supporting identity facts, `Approve match` as the primary action, and choose-another and ignore alternatives

#### Scenario: New Bottle is suggested

- **WHEN** a listing task has a complete create-Bottle proposal
- **THEN** the view presents the proposed Bottle fields, create as the primary action, edit before creation as an alternative, and ignore as an alternative

#### Scenario: Same Bottle needs correction

- **WHEN** a listing task proposes a safe correction to its currently assigned Bottle
- **THEN** the view presents the current and proposed Bottle fields and invokes the existing transactional repair capability when approved

#### Scenario: No safe match exists

- **WHEN** classification cannot safely identify or create a Bottle
- **THEN** the view explains the missing identity in human language and offers manual Bottle selection and ignore without inventing a recommendation

### Requirement: Review Operation tasks preserve catalog safeguards

The Review Operation task renderer SHALL retain live revalidation, field exclusion for supported updates, merge impact, warnings, structured rejection, retry eligibility, and canonical source-owned execution.

#### Scenario: Moderator reviews a field update

- **WHEN** an update-Bottle or update-Entity operation is ready
- **THEN** the view shows current and proposed values, lets the moderator exclude supported fields, and applies only the included fields through the existing approval capability

#### Scenario: Moderator reviews a merge

- **WHEN** a Bottle or Entity merge operation is ready
- **THEN** the view identifies the source, destination, affected consumers, warnings, and all-or-nothing approval boundary

#### Scenario: Operation is not approval-ready

- **WHEN** live preparation reports a blocked or stale operation
- **THEN** the view disables approval, explains the blocking condition, and offers only valid removal, manual-resolution, close, or operational-recovery paths

#### Scenario: Moderator removes a suggestion

- **WHEN** the moderator rejects a Review Operation
- **THEN** the system records the existing structured rejection reason and optional note through the Review Operation owner

### Requirement: Finding tasks provide explicit disposition

The finding task renderer SHALL present unresolved findings and their evidence, then use existing close reasons or canonical manual editing for disposition.

#### Scenario: Findings need no catalog mutation

- **WHEN** the moderator decides that the remaining findings require no further catalog change
- **THEN** the moderator can close the check with an existing structured close reason and optional note

#### Scenario: Moderator resolves a finding manually

- **WHEN** the moderator chooses manual resolution
- **THEN** the view links to the canonical resource editor and retains the source check until the moderator records its disposition

### Requirement: Supporting evidence uses progressive disclosure

The system SHALL keep supporting evidence and technical system detail available under separate disclosures that default closed, while keeping decision-critical facts visible.

#### Scenario: Moderator needs supporting evidence

- **WHEN** the moderator opens the evidence disclosure
- **THEN** the system shows the bounded source links, candidates, or evidence references owned by the task source

#### Scenario: Moderator does not inspect system details

- **WHEN** the moderator makes a routine decision without opening technical details
- **THEN** model metadata, automation scores, processing leases, raw identifiers, and structured exports do not compete with the primary decision

### Requirement: Skip and disposition have distinct behavior

The system SHALL provide one `Skip` action for moving past open work without mutation and SHALL automatically advance after a successful terminal disposition.

#### Scenario: Moderator skips a task

- **WHEN** the moderator selects `Skip`
- **THEN** the system opens the next task in the current filtered order and leaves the skipped source unchanged

#### Scenario: Moderator completes a task

- **WHEN** a source-owned mutation succeeds and the task becomes terminal
- **THEN** the system removes it from the refreshed Inbox, records or exposes its durable history, and opens the next task

#### Scenario: Disposition fails

- **WHEN** a source-owned mutation returns an error
- **THEN** the system keeps the current task selected, preserves moderator input, displays the error near the action, and does not advance

#### Scenario: No task remains

- **WHEN** a disposition or skip reaches the end of the current filtered Inbox
- **THEN** the system shows a completion state with a route to the full Inbox

### Requirement: Task navigation is URL-backed and state-preserving

The system SHALL give every Inbox task a direct URL and SHALL preserve Inbox filters, list position, and navigation context while task details are selected.

#### Scenario: Moderator opens a direct task link

- **WHEN** the moderator opens a valid direct task URL
- **THEN** the system renders the Moderation shell, the matching Inbox context, and the selected task

#### Scenario: Selected task became terminal

- **WHEN** a direct task URL references work that is no longer actionable
- **THEN** the system explains that the task no longer needs attention and refreshes the Inbox without exposing stale actions

#### Scenario: Moderator returns to the list on mobile

- **WHEN** the moderator navigates back from a mobile task detail
- **THEN** the system returns to the prior filtered Inbox and restores its list position

### Requirement: History unifies durable completed decisions

The system SHALL project completed incoming decisions, Review Operation reviews/results, and audit closures into searchable History without copying them into a new durable event lifecycle.

#### Scenario: Moderator inspects a completed decision

- **WHEN** the moderator selects a History event
- **THEN** the system shows its durable actor, time, outcome, affected resources, available rationale or evidence, and an activity sequence derived from source timestamps

#### Scenario: Automation made the decision

- **WHEN** the durable actor is the system
- **THEN** History labels the event as automated rather than attributing it to a user

#### Scenario: Historical context is unavailable

- **WHEN** an older source record lacks actor, evidence, or affected-resource context
- **THEN** History labels that context unavailable and does not infer or fabricate it

### Requirement: Automation contains operational health and recovery

The system SHALL present moderator-related processing counts, waiting work, failures, active retry runs, and bounded source-owned recovery actions in Automation.

#### Scenario: Work is currently processing

- **WHEN** listing classification or approved catalog execution is active
- **THEN** Automation shows its factual progress or processing state without placing it in the Inbox

#### Scenario: Operational work needs attention

- **WHEN** a failed, stopped, or stale post-decision process has a valid retry, resume, cancellation, reconciliation, or rerun action
- **THEN** Automation explains the failure in human language and invokes only the existing source-owned recovery capability

#### Scenario: Operational state requires a new catalog decision

- **WHEN** recovery produces a new Suggested Change or finding requiring human disposition
- **THEN** the new decision appears in the Inbox rather than being approved from Automation

### Requirement: Responsive behavior preserves the workflow

The system SHALL show navigation, Inbox list, and selected detail together at supported desktop widths and SHALL use list-then-full-screen-detail navigation at mobile widths.

#### Scenario: Desktop task review

- **WHEN** the viewport supports the three-column layout
- **THEN** the moderator can inspect the selected task while retaining Inbox and destination context

#### Scenario: Mobile task review

- **WHEN** the viewport cannot support the three-column layout
- **THEN** the Inbox and task detail render as separate full-width route states with touch targets of at least 44 pixels

#### Scenario: Mobile field diff

- **WHEN** a field-change task is rendered on mobile
- **THEN** current and proposed values use stacked rows with reachable inclusion controls instead of a squeezed desktop table

### Requirement: Moderation communicates focus and status accessibly

The system SHALL use semantic controls, visible focus, explicit action names, and accessible announcements for task selection, mutation progress, success, and failure.

#### Scenario: Task changes after disposition

- **WHEN** the system advances to another task
- **THEN** it announces the successful outcome and moves focus to the next task question without trapping focus

#### Scenario: Moderator is editing input

- **WHEN** focus is inside an input, select, or textarea
- **THEN** moderation keyboard shortcuts do not intercept text or native control input

#### Scenario: Task is busy

- **WHEN** a mutation is pending
- **THEN** conflicting task actions are disabled, progress is announced, and list navigation does not expose duplicate submission

### Requirement: Superseded review routes are removed

The system SHALL remove the superseded incoming-listing queue, audit inbox, incoming-decision log, and their read-only API routes after feature parity is verified. Remaining product flows SHALL link directly to the corresponding Moderation destination.

#### Scenario: Moderator starts from admin navigation

- **WHEN** the moderator opens the administrator entry point after cutover
- **THEN** the system opens the Moderation Inbox without passing through a superseded review route

#### Scenario: A new audit needs review

- **WHEN** a Bottle audit creates an actionable operation or finding
- **THEN** its producer navigates directly to the corresponding Moderation task URL

#### Scenario: Removed route is requested

- **WHEN** a client requests a superseded review page or read-only API route
- **THEN** no compatibility route is registered
