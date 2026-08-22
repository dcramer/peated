## ADDED Requirements

### Requirement: Historical review progress survives successful runs

The system SHALL let an explicitly configured review source continue its
historical import from the cursor of its last successful run.

#### Scenario: Next run starts after stored progress

- **WHEN** a configured source starts after a successful historical import run
- **THEN** the new run starts from that successful run's stored cursor

#### Scenario: Prior run failed

- **WHEN** the most recent run failed after partial historical work
- **THEN** a new run starts from the most recent successful run instead

### Requirement: Current reviews remain current during history import

The system MUST check the source's bounded current-review page on every
historical import run.

#### Scenario: New review appears during backfill

- **WHEN** a new review appears while the historical cursor points to an older page
- **THEN** the next run ingests the new review before it advances the historical cursor

### Requirement: Historical work remains bounded

The system MUST limit each WhiskyNotes run to at most four historical archive
pages and MUST use the existing target spacing, quota, retry, robots, and run
limits for all requests.

#### Scenario: More archive pages remain

- **WHEN** a run completes four historical archive pages and another page exists
- **THEN** it checkpoints the next page and completes without requesting it

#### Scenario: Run resumes within a page

- **WHEN** a run stops after it stores part of one archive page
- **THEN** its next attempt skips stored articles and retries the first unstored article

### Requirement: Completed history does not restart

The system SHALL record when the public archive ends and SHALL continue only
the bounded current-review check on later runs.

#### Scenario: Last archive page is reached

- **WHEN** a historical listing has no next-page link
- **THEN** the run records the history import as complete
- **AND** a later run does not request historical archive pages
