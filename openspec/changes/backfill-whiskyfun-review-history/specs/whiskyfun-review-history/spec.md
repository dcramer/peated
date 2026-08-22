## ADDED Requirements

### Requirement: Current Whiskyfun reviews remain current

The system MUST check Whiskyfun's bounded current RSS feed before historical
work on every run.

#### Scenario: New review appears during history import

- **WHEN** a new RSS article appears while the historical cursor points to an older archive page
- **THEN** the run ingests the new article before it advances the historical cursor

### Requirement: Historical Whiskyfun work remains bounded

The system MUST request at most one Whiskyfun archive page per run and MUST use
the existing target spacing, quota, retry, robots, and run limits.

#### Scenario: More archive pages remain

- **WHEN** a run completes one archive page and an older linked page exists
- **THEN** it checkpoints the older page without requesting it

#### Scenario: Run resumes within an archive page

- **WHEN** a run stops after it stores part of one archive page
- **THEN** its next attempt skips stored daily entries and retries the first unstored entry

### Requirement: Historical articles preserve public identity

The system SHALL store each valid daily archive entry as a separate article
with its publisher-provided anchor, title, and publication date. It SHALL
exclude review candidates in sessions identified as non-whisky content.

#### Scenario: Archive page contains several daily entries

- **WHEN** the adapter reads an archive page with several valid date anchors
- **THEN** it emits each scored whisky entry with its archive fragment and date

#### Scenario: Archive day contains a rum session

- **WHEN** a daily entry contains review-shaped content under a rum heading
- **THEN** the adapter does not include those reviews in the observation

### Requirement: Completed Whiskyfun history does not restart

The system SHALL record when an archive page has no older linked page and SHALL
continue only the bounded current RSS check on later runs.

#### Scenario: Oldest archive page is reached

- **WHEN** the adapter completes an archive page with no older link
- **THEN** it records that the history import is complete
- **AND** a later run does not request the homepage or an archive page
