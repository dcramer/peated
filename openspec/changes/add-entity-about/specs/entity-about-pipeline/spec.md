## ADDED Requirements

### Requirement: Facts come only from fetched sources

The pipeline SHALL extract facts only from pages it fetched in the same run.
Each proposed fact SHALL include a quote. Code SHALL reject a fact when its
quote does not appear in the fetched page text after whitespace and
punctuation normalization. The pipeline SHALL NOT use a model's memory as
evidence.

#### Scenario: Invented quote

- **WHEN** the model proposes a founding year with a quote that is not on the
  fetched page
- **THEN** the fact is rejected and not stored

### Requirement: Prose comes only from accepted facts

The writer SHALL receive only the Entity's published facts, events, site
facts, catalog numbers, and source titles. It SHALL return sentences, and each
sentence SHALL list the facts it uses. Code SHALL reject a sentence that lists
no facts, lists a fact the writer was not given, or contains a year or
number not found in the facts it lists. The scoring model checks names and
claims that code cannot compare exactly.

#### Scenario: Sentence without a fact

- **WHEN** a draft sentence says the distillery "is known for its rich
  history" and lists no facts
- **THEN** the sentence is rejected

#### Scenario: Wrong year

- **WHEN** a sentence says "closed in 1985" but its cited fact states 1983
- **THEN** the sentence is rejected

### Requirement: Length follows evidence

The amount of prose SHALL be limited by the number of published facts: at
most one sentence for each published fact, a lead of at most 4 sentences, and
no sections when the Entity has fewer than 6 published facts. An Entity with
fewer than 2 published facts SHALL get no prose.

#### Scenario: Thin record

- **WHEN** a brand has 3 published facts
- **THEN** it gets a lead of at most 3 sentences and no sections

### Requirement: Style rules are checked in code

Code SHALL reject a draft that uses a banned phrase from the Peated writing
guide or a sentence longer than 30 words. The banned phrase list SHALL live
with the `peated-writing` skill and be shared by the skill and the check. Code
checks only exact wording; judgments about tone belong to the scoring model.

#### Scenario: Stock phrase

- **WHEN** a draft calls a distillery "iconic"
- **THEN** the draft is rejected and written again

### Requirement: A scoring model judges tone

After code checks pass, a separate model SHALL score the draft against a
written checklist and a set of articles written by people. The checklist
SHALL cover specificity, repetition, plain words, praise of the whisky,
closing summary sentences, claims that go beyond the cited facts, and whether
a whisky enthusiast would learn something. A draft below the passing score SHALL be
written again once. A second failure SHALL publish no prose for that Entity.

#### Scenario: Generic draft

- **WHEN** a draft passes the code checks but reads like it could describe any
  distillery
- **THEN** it scores below the bar and is written again

### Requirement: Failure publishes less, never guesses

When research, extraction, or writing fails or is rejected, the system SHALL
keep the previous published content, or publish facts and catalog numbers
without prose. It SHALL NOT fall back to unsourced text.

#### Scenario: Writer fails twice

- **WHEN** both drafts for a new Entity fail the checks
- **THEN** the Entity shows its published facts and catalog numbers and no
  lead

### Requirement: Publishing needs no approval

Content that passes every check SHALL publish without a person's approval.
The system SHALL send a random 2% of newly published About pages to the
moderation Inbox as spot checks after they publish.

#### Scenario: Passing article

- **WHEN** a distillery's facts and prose pass every check
- **THEN** the About page publishes immediately

### Requirement: Stable text

The pipeline SHALL rewrite a section only when the facts it cites change, and
SHALL keep sentences whose facts are unchanged.

#### Scenario: New Bottles

- **WHEN** new Bottles change a distillery's vintage chart
- **THEN** the chart updates and the prose is not rewritten

#### Scenario: Corrected year

- **WHEN** a cited event's year changes
- **THEN** only sentences citing that event are written again

### Requirement: Runs are bounded and resumable

Each run SHALL store its state, its step, its attempts, and its cost. Each run
SHALL have limits on searches, page fetches, model calls, and spend, and a
daily limit SHALL cover all runs. A run that reaches a limit SHALL stop and
record a safe failure.

#### Scenario: Budget reached

- **WHEN** a run uses its page-fetch limit before it finds enough sources
- **THEN** it stores the facts it accepted, records the stop, and does not
  write prose from partial research

### Requirement: Pause switch

Administrators SHALL be able to pause new pipeline runs and new publishing.
Moderators SHALL be able to hide one Entity's generated About content. Hidden
content SHALL stay stored.

#### Scenario: Quality drop

- **WHEN** an administrator pauses publishing
- **THEN** runs stop before publishing and published pages stay as they are

### Requirement: Corrections update facts

A member report about an About page SHALL reach the moderation Inbox. A
moderator's correction SHALL update the fact, mark it as written by a person,
and rewrite only the affected sentences.

#### Scenario: Wrong closing year reported

- **WHEN** a moderator corrects a closing year from a report
- **THEN** the event keeps the corrected year and the sentences that cite it
  are rewritten

### Requirement: Quality is measured

The system SHALL record, for each period: Entities processed, facts accepted
and rejected by reason, drafts rejected by check, spot-check results, and
correction reports for each 1,000 About page views.

#### Scenario: Weekly review

- **WHEN** an administrator opens the pipeline health view
- **THEN** it shows those measures for the last 7 and 30 days
