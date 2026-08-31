## ADDED Requirements

### Requirement: Compare matching PNG files

The visual diff tool SHALL compare baseline and candidate PNG files that have
the same relative path.

#### Scenario: Matching images are unchanged

- **WHEN** a baseline and candidate PNG have the same pixels
- **THEN** the report lists the image as unchanged and does not create a diff
  image

#### Scenario: Matching images are changed

- **WHEN** a baseline and candidate PNG have a visible pixel difference
- **THEN** the report lists the image as changed
- **AND** creates baseline, candidate, and pixel diff images

### Requirement: Report files that exist on one side

The visual diff tool SHALL report PNG files that exist only in the baseline or
candidate directory.

#### Scenario: Candidate adds an image

- **WHEN** a PNG exists only in the candidate directory
- **THEN** the report lists the image as added
- **AND** creates only a candidate review image

#### Scenario: Candidate removes an image

- **WHEN** a PNG exists only in the baseline directory
- **THEN** the report lists the image as removed
- **AND** creates only a baseline review image

### Requirement: Publish only visual changes

The pull request comment SHALL show changed, added, and removed images without
showing unchanged screenshots.

#### Scenario: No images changed

- **WHEN** all compared images are unchanged
- **THEN** the pull request comment states that there are no visual changes

#### Scenario: Some images changed

- **WHEN** one or more images changed
- **THEN** the pull request comment includes only those visual changes

#### Scenario: A matching image changed

- **WHEN** the report lists an image as changed
- **THEN** the pull request comment shows its before and after images first
- **AND** provides its pixel diff in a collapsed section

### Requirement: Compare revisions from the same test merge

The screenshot workflow SHALL capture the candidate test merge and its first
parent as the baseline.

#### Scenario: The pull request event has an older base SHA

- **WHEN** the base branch moves while GitHub prepares the test merge
- **THEN** changed-file selection uses the test merge's first parent
- **AND** baseline capture checks out that same parent

### Requirement: Visual changes remain informational

The screenshot workflow SHALL NOT fail only because image pixels changed.

#### Scenario: Comparison finds a change

- **WHEN** the comparison completes and reports changed pixels
- **THEN** the screenshot workflow succeeds and publishes the report

### Requirement: Upload only files used by the review comment

The screenshot workflow SHALL upload the baseline manifest, candidate
manifest, report JSON, and changed report images. It SHALL NOT upload the full
baseline or candidate image sets.

#### Scenario: The artifact is ready for review

- **WHEN** screenshot comparison completes
- **THEN** the artifact contains both manifests and the report JSON
- **AND** the artifact contains images only for added, changed, or removed files

#### Scenario: A required report file is missing

- **WHEN** either manifest or the report JSON does not exist
- **THEN** the screenshot workflow fails before upload

### Requirement: Keep the reusable action bundle current

The repository SHALL verify that the committed action bundle matches its source
and includes third-party license notices.

#### Scenario: Comparison source changes without a rebuild

- **WHEN** the committed bundle differs from a fresh build
- **THEN** the focused test fails
