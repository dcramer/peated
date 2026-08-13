## ADDED Requirements

### Requirement: Scraper Bottle facts cross ingestion as normalized evidence

Store-price ingestion SHALL accept and persist optional provider-owned Bottle
facts only through the classifier's normalized Bottle identity schema.

#### Scenario: Provider supplies structured Bottle facts

- **WHEN** a scraper submits a listing with valid normalized
  `sourceBottleIdentity`
- **THEN** ingestion persists those facts with the store-price row

#### Scenario: Listing facts are refreshed

- **WHEN** an existing listing is ingested again with updated normalized Bottle
  facts
- **THEN** ingestion replaces the stored `sourceBottleIdentity` with the fresh
  value

#### Scenario: Provider payload is not normalized

- **WHEN** a scraper submits fields outside the strict normalized Bottle
  identity schema
- **THEN** the ingestion boundary rejects the payload instead of persisting raw
  provider data

### Requirement: Price classification reuses structured source evidence

Price matching SHALL seed Bottle classification from persisted
`sourceBottleIdentity` before invoking image extraction or reusing an older
model extraction.

#### Scenario: Fresh listing has structured evidence

- **WHEN** an unresolved store price has non-null `sourceBottleIdentity`
- **THEN** price matching supplies it as the classifier's extracted identity
  input

#### Scenario: Existing listing has no structured evidence

- **WHEN** an unresolved store price has null `sourceBottleIdentity`
- **THEN** the classifier retains its existing image-extraction fallback

### Requirement: Douglas Laing preserves only supported provider facts

The Douglas Laing scraper SHALL emit normalized Brand when provider vendor and
title prefix agree, plus category, ABV, explicit age or cask markers, and
marketed finish wording when its owned structured feed supplies them. It MUST
NOT infer release year from publication metadata or bottler from page hosting.

#### Scenario: Gauldrons Eclipse is scraped

- **WHEN** the official feed lists The Gauldrons Eclipse at 52.9% ABV with an
  orange-wine-cask finish
- **THEN** the emitted source Bottle identity contains Brand `The Gauldrons`,
  category `blend`, ABV `52.9`, the marketed finish, null bottler, and null
  release year

### Requirement: Complete scraper facts can anchor automatic creation

Price matching SHALL treat a complete normalized scraper identity as concrete
creation evidence without requiring redundant web corroboration when the
classifier reports no unresolved identity risks and its proposed exact fields
do not contradict the scraper facts.

#### Scenario: Complete source identity supports a new Bottle

- **WHEN** a scraper supplies Brand, expression, supported whisky category, and
  exact available traits for an unresolved listing
- **AND** the classifier proposes a consistent new Bottle with no unresolved
  identity risks
- **THEN** price matching may automatically create and assign that Bottle
  without web evidence

#### Scenario: Proposed Bottle conflicts with scraper facts

- **WHEN** the classifier proposal contradicts a populated structured source
  category, age, edition, ABV, cask flag, vintage year, or release year
- **THEN** automatic creation is blocked and the proposal remains reviewable

### Requirement: Discovery cannot consume page verification

The Bottle classifier SHALL enforce independent per-run allowances for web
search queries and exact page reads.

#### Scenario: Search allowance is exhausted

- **WHEN** a classifier run spends its maximum search-query allowance
- **THEN** one exact page-read allowance remains available

#### Scenario: Page-read allowance is exhausted

- **WHEN** a classifier run has already read one page
- **THEN** another page-read request returns a budget error without calling the
  provider

### Requirement: Default Firecrawl work is cost bounded

The Bottle classifier SHALL allow at most two search queries and one basic-proxy
page read per run by default.

#### Scenario: Wording is uncertain

- **WHEN** the classifier needs alternate search wording
- **THEN** one tool turn accepts no more than two distinct search queries

#### Scenario: Exact source page needs verification

- **WHEN** `reference.url` may resolve an identity-critical fact
- **THEN** the page reader accepts that URL without requiring it to appear in a
  previous search result
