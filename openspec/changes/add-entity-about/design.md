## Context

Entity pages show identity, an unsourced model-written description, a short
history list, a map, images, and Bottle sections. History comes from
`entity_event`. Moderators write events through the API only, and each event
has one `sourceUrl`. `generateEntityDetails` writes descriptions from the
model's memory, given only a name, location, year, and website.

The Brora proof of concept on `poc/entity-about` added an About tab with a
hand-written, cited article, a timeline, a Bottles-by-vintage chart, and a
sidebar of facts and owners. Its content lives in
`apps/web/src/features/entityAbout/articles/brora.ts`, and the page builds the
chart by reading up to 1,000 Bottles. The research behind it is in
`docs/research/catalog/2026-10-23-brora-about.md`.

Decisions already made:

- Cover every distillery and brand, about 3,900 Entities.
- Publish without approval, with safety nets.
- Pages must not read like generated filler.
- Pages show sources and a checked date, with no other statement about how
  the text was written.
- About data lives in one typed document per Entity. Site facts come from a
  typed field list in code. Schema changes should be rare and backward
  compatible.
- Entity history moves from `entity_event` into the document.
- Unsourced descriptions are replaced as sourced leads are published.

Constraints come from `CLAUDE.md` (record evidence, never present guesses as
facts), `docs/policies/agent-design.md`, `docs/policies/background-work.md`,
`docs/policies/database-correctness.md`,
`docs/policies/data-and-permissions.md`, `docs/policies/sensitive-data.md`,
`docs/development/model-checks.md`, `DESIGN.md`, and the identity rules in
`docs/architecture/whisky-identity-model.md`.

## Goals / Non-Goals

**Goals:**

- Store facts, not articles: every claim traces to a stored fact, and every
  fact traces to a quoted passage on a fetched page.
- Make the bottle catalog the base layer, so every Entity gets useful numbers
  without research.
- Make low-quality text hard to publish by enforcing rules in code and with a
  separate scoring model.
- Keep layout in code so 3,900 pages stay consistent and change together.
- Keep people's edits authoritative.

**Non-Goals:**

- Bottler and Company About pages. Companies still gain owner timelines from
  events.
- Bottle articles.
- Member-written articles or a rich-text editor.
- Showing source quotes publicly.
- Changing Entity identity, ownership, or status automatically.

## Decisions

### 1. Three layers: facts, catalog numbers, prose

**Facts** are stored, typed, and cited. **Catalog numbers** are computed from
Bottles at read time. **Prose** is short sentences that cite facts.

The page template decides layout. Prose never contains widgets or layout.

Alternative: one markdown article per Entity with embedded widgets. Rejected:
each page drifts, claims cannot be checked, and a design change would mean
editing 3,900 documents.

### 2. Data model: one typed document per Entity

Each Entity's About data is one JSON document, checked by a schema in code.
This keeps storage to two small tables and puts the shape of the data in one
reviewed place.

**Tables**

- `entity_about`
  - `entityId`: primary key.
  - `document`: JSON.
  - `schemaVersion`.
  - `version`: for saved-version checks on every write.
  - `status`: `published` or `hidden`.
  - `checkedOn`, `updatedAt`.
- `entity_about_run`
  - `id`, `entityId`.
  - `step`: `research`, `extract`, `write`, `score`, or `publish`.
  - `status`, `attempts`, `failureReason`, `startedAt`, `finishedAt`.
  - Usage counts: `searches`, `fetches`, `modelCalls`, `costMicros`.
  - Run state is operational, so it stays out of the document.

**The document**

- `sources`: list of `{ id, url, title, publisher, publishedOn, status }`.
  `url` is unique within the document.
- `events`: list of `{ id, kind, date, endDate, continuing, name, title,
text, relatedEntityId, newOwnerId, citations, writtenBy }`.
  - Kinds: `opened`, `closed`, `mothballed`, `reopened`, `acquired`,
    `renamed`, `era`, `generic`.
- `siteFacts`: an object keyed by field, each value
  `{ value, asOf, citations, writtenBy }`. Distilleries only.
- `sections`: list of `{ key, heading, eraEventId, sentences, writtenBy }`.
  Each sentence is `{ text, factIds }`. The lead is the section with key
  `lead`.
- Every `citations` entry is `{ sourceId, statedValue, quote }`. Quotes are
  at most 300 characters and are removed by the public serializer.
- `writtenBy` is `person` or `pipeline`. Whether a fact is published is
  computed by the publishing rules on read, not stored, so it can't go stale.

**Typed files in code** (changed by pull request, so review comes from code
review):

- `aboutFactFields.ts` lists the site facts: key, label, value type, unit,
  and the Entity kinds it applies to (wash stills, spirit stills, other
  stills, capacity in litres of alcohol a year, water source, heating,
  building listing). The document schema is built from this list. Adding a
  fact is one entry, not a migration.
- `sourceSites.ts` lists reviewed source sites with domain, name, tier, and
  notes. Its first contents come from a dated source-site audit in
  `docs/research/`.

**Schema rules** (the schema module states this in a comment beside the
schema):

- Changes to the document schema should be rare and backward compatible: add
  optional fields, never rename or remove one, and never change a field's
  meaning.
- Every saved document must still parse after a change.
- A change that cannot meet this needs a `schemaVersion` bump, an upgrade
  function that runs when a document is read, and a bounded migration that
  rewrites stored documents and checks the result.

**History, links, and concurrency**

- **History:** every write saves the full document to the existing `change`
  table under a new object type, `entity_about`, with the actor. The pipeline
  writes as a new system actor, `aboutPipeline`. Rollback restores an
  earlier version.
- **Entity links:** `relatedEntityId` and `newOwnerId` have no database
  foreign keys.
  - Writes check that the Entities exist.
  - Reads resolve merged Entities through `entity_tombstone`, so a merge
    never edits documents.
  - A deleted Entity's links are dropped on read and reported as a finding.
- **Concurrency:** writes send the version they read. A stale version is
  rejected and the writer retries from the new document, per
  `docs/policies/database-correctness.md`.
- **Checking:** the schema module parses `unknown` at every read and write,
  per `docs/policies/data-and-permissions.md`.

**History moves into the document.** `entity_event` rows are copied into each
Entity's document. Overview history, the acquisitions shown on owner pages,
and the moderator event routes read and write the document. The table is
dropped in a later migration.

Alternatives considered:

- **Separate tables for sources, citations, site facts, and sections.**
  Rejected: seven tables and many migrations for data that is always read
  and written together, one Entity at a time.
- **Data files in the repository.** Rejected: every pipeline write and every
  moderator correction would be a commit, and moderators could not edit in
  the product.
- **Keeping `entity_event` next to the document.** Rejected: two homes for
  history drift apart.
- **Typed columns for site facts.** Replaced by the typed field list. It
  keeps the same checking, and an expression index on one document field can
  support filtering if a feature needs it later.

**When a field leaves the document.** The document is the default home.
Move a field out only when all three are true:

1. A current feature needs to query it across Entities: filtering, sorting,
   joining, or counting.
2. Its shape has stayed the same for a while.
3. Its published values are reliable enough to sort or filter on.

The first choice is a read-only **projection table**: for example,
`entity_site_fact_index (entityId, field, numberValue, textValue)`.

- The publish step rebuilds an Entity's rows from its document in the same
  transaction.
- A job can rebuild every row from the documents.
- The document stays the only owner, so the projection needs no backfill
  plan of its own and can be dropped at any time.

Make a real owning table or column only when the database must enforce the
value, such as a foreign key or a uniqueness rule. Then move ownership in one
bounded migration, and leave the old document field ignored and optional
instead of removing it. That keeps the backward-compatibility rule.

Facts Peated already stores as Entity columns stay there: owner, status,
location, founding year, and website. When the document's history disagrees
with one, such as an `opened` event in 1820 and a founding year of 1819, the
pipeline creates an Inbox finding and does not change the column.

### 3. Publishing rules live in code

`isFactPublishable(citations, sourceSites)` applies the support rule: one
`primary` site, or two different `reference` or `press` sites.
`chooseFactValue` applies the conflict rule. Both are plain functions with
unit tests. The public serializer runs them on every read, so a change to
`sourceSites.ts` takes effect without rewriting documents.

The model proposes values but never decides what publishes. This follows "code
owns permissions, approval, saved state" in the agent-design policy.

### 4. Pipeline: a fixed workflow with three model steps

A fixed workflow, not a multi-agent system. Each run is one
`entity_about_run`. Worker jobs pass only `entityId` and `runId`, and store
their state before work, per the background-work policy.

**Research** (one model with tools)

- Goal: find candidate pages about this Entity.
- Input: Entity name, kind, location, owner, aliases, and existing sources.
- Tools: web search, then page fetch, using the Firecrawl tooling from
  `packages/bottle-classifier`.
- Output: a list of URLs with reasons.
- Rules: no writes; stop when the search or fetch budget is used, or two
  searches in a row find nothing new.
- Code keeps only pages on listed source sites.

**Extract** (one model call per fetched page)

- Input: Entity identity and one page's text.
- Output: structured fact proposals (events, site facts), each with a quote
  and a stated value.
- Code checks:
  - The quote is on the page, after normalizing whitespace and punctuation.
  - The value has a valid type and date format.
  - The Entity link is the run's Entity.
  - Proposals match existing facts by kind and date, never by name.
- Code then runs the publishing rules.
- Forbidden: changing identity, owner, status, or anything a person wrote.
  Those become Inbox findings.

**Write** (one model call)

- Input: published facts with IDs, catalog numbers, source titles, the
  template's section slots for the kind, the length limits, and the style
  guide.
- Output: a lead and sections, each a list of sentences with fact IDs.
- Code checks:
  - Every sentence cites facts it was given.
  - Every year and number appears in its cited facts.
  - Sentence count limits and the 30-word sentence limit.
  - The banned-phrase list.
- Code checks only exact text. Tone and meaning go to scoring, per the policy
  rule against keyword lists deciding meaning.

**Score** (a separate model call)

- A checklist plus 3 articles written by people, chosen by kind.
- Returns pass or fail per checklist item, and the sentences that fail.
- One rewrite at most; a second failure publishes no prose.

**Publish** (code)

- Writes inside one transaction.
- Keeps unchanged sentences: the writer receives the previous section and the
  list of facts that changed, and sections whose `factsVersion` hash is
  unchanged are skipped.
- Updates the Entity description from the lead unless a person wrote the
  description.

Runs have limits on searches, fetches, model calls, and spend, plus a daily
limit across all runs. A run that hits a limit stores the facts it accepted
and stops before writing.

Alternative: one agent that researches and writes in one pass. Rejected: it
cannot be checked step by step, and it mixes memory with evidence.

### 5. Triggers and refresh

- **Backfill:** a scheduled job queues Entities with no completed run, most
  active first (`publicReviewAndTastingCount`), within the daily budget.
- **Fact change:** a moderator edit to a cited fact queues a write-only run
  for that Entity.
- **Slow refresh:** sources are fetched again every 12 months, with fresher
  checks for Entities that are open or under construction. Sources that stop
  loading are marked `unavailable`. A fact that loses its support is
  unpublished.
- **Catalog numbers** need no runs.

### 6. Catalog numbers routes

One route file per operation under
`apps/server/src/orpc/routes/entities/about/`, following
`docs/development/orpc-routes.md`:

- `entities.about.details`: published facts, events, sections, sources, and
  disagreements. Citation quotes are left out.
- `entities.about.vintages`: Bottle counts by vintage year, and the count
  without one.
- `entities.about.bottlers`: Bottle counts by bottler.
- `entities.about.distillers`: for Brands, Bottle counts by distillery.
- `entities.about.releaseYears`: Bottle counts by release year, and the count
  without one.

All are public reads, cached per `docs/architecture/web-caching.md`, and count
active Bottles with the same rules as the Entity Bottles tab. `bottles.list`
gains a `vintageYear` filter.

### 7. Web: widgets with display rules

`apps/web/src/features/entityAbout/` holds:

- one component per part: lead, `EntityLifeline`, `VintageChart`, bottler
  list, distillery list, key facts, owners, sources, disagreement note;
- each component's display rule as a plain function, such as
  `showVintageChart(counts)`;
- a template list per kind.

The route renders the template list, skipping parts whose rule fails. Parts
come from the proof of concept, rewired to the API.

The Overview replaces `EntityHistoryOverview` with key dates and a link when
About exists. Bottle pages get `BottleEraNote`, fed by the Bottle's single
distiller and vintage from `entities.about.details`. Each component gets one
Storybook Overview story, per `apps/web/AGENTS.md`.

### 8. Writing quality: people's articles set the standard

People write 12 articles by hand before any automated publishing, from the
Brora pattern:

- famous distilleries: Springbank, Bowmore
- lost: Port Ellen, St Magdalene
- revived: Brora
- huge: Glenlivet
- recent craft: Kingsbarns
- single-distillery brands: Ardbeg, Yamazaki
- a brand with many distilleries: Johnnie Walker
- a house label: Compass Box
- a thin record: a recent Indian single malt

They serve as the scoring model's examples, the model-check fixtures under
`pnpm evals`, and the bar for spot checks. The banned-phrase list and the
style rules go into the `peated-writing` skill, and the code check imports
the same list.

### 9. Safety nets

- **Spot checks:** a random 2% of new pages are sent to the Inbox as spot
  checks. They don't block publishing.
- **Corrections:** member reports reach the Inbox, and corrections become
  person-written facts.
- **Health view:** in Background work, showing:
  - accepted and rejected facts by reason,
  - drafts rejected by check,
  - spot-check error rates,
  - corrections per 1,000 views.
- **Pause:** an administrator switch stops runs and publishing; moderators can
  hide one Entity's generated content.
- **Stop rule:** if spot checks find wrong facts on more than 2% of checked
  pages in a week, the backfill pauses until the cause is fixed.

### 10. Brand and distillery split

Under the identity model, a distillery's own line is the same Entity, so
Ardbeg gets one About page. Separate Brand Entities, such as house labels and
owner collections, get brand pages. Their history is the brand's, and they
link to the distilleries that make them.

`docs/architecture/whisky-identity-model.md` gains one rule: history about a
production site belongs on the Distillery, and history about a label belongs
on the Brand.

## Risks / Trade-offs

- **Wrong facts published without review.**
  - Quotes are checked against the fetched page.
  - Support rules require a primary source or two independent ones.
  - People's edits are never overwritten.
  - Spot checks and corrections catch the rest, with a stop rule.
- **Bland but correct text.**
  - The scoring model and 12 human-written articles set the bar.
  - Thin records get no prose instead of padding.
- **Source sites change terms or block fetching.**
  - Tiers and access rules live in `sourceSites.ts`.
  - Only short private quotes are stored, never whole pages.
  - Fetching follows each site's terms, recorded in the audit.
- **Cost of 3,900 runs.**
  - Per-run and daily limits.
  - Phase 2 measures cost on 50 Entities before the backfill is sized.
- **A document schema change breaks stored documents.**
  - Changes are rare and backward compatible by rule.
  - Every saved document is parsed in a test against a sample of production
    shapes.
  - A breaking change needs a version bump, an upgrade function, and a
    checked migration.
- **Text churn.**
  - Unchanged sections are not rewritten; a section is rewritten only when
    its cited facts change.
- **Prompt injection from fetched pages.**
  - Page text is data. Models have no write tools.
  - Code validates every proposal against schemas and the run's Entity.
- **Copyright of prose.**
  - The writer sees facts and titles, not page text, so it cannot copy
    sentences.
- **Two sources that copy each other count as independent.**
  - Sources on the same site count once.
  - Pages a site's reviewed notes say copy another source count once.
  - Spot checks watch for the rest.

## Migration Plan

1. Add `entity_about` and `entity_about_run`, and the `entity_about` change
   object type. Generate migrations with `pnpm db:generate`.
2. Backfill a document for each Entity with events:
   - copy events and their `sourceUrl` as sources and citations;
   - mark each event `person` when a user created it;
   - check that the event count matches, Entity by Entity.
3. Point Overview history, owner acquisitions, and moderator event routes at
   the document. Stop writing `entity_event`.
4. Add `sourceSites.ts` from the dated audit.
5. Enter Brora's facts and article through the API, following the catalog
   maintenance approval and checks. Delete the code file.
6. Ship the catalog-numbers routes and the About tab with publishing paused.
7. Run the pipeline with publishing paused on the 12 human-written-article
   Entities plus 38 more, and compare the results.
8. Turn on publishing and start the backfill.
9. Drop `entity_event` after a release with no reads from it.

Rollback:

- Pause the pipeline, then hide About pages.
- Restore any document from change history.
- Until step 9, `entity_event` still holds the original history.

## Open Questions

- The first source-site list and tiers. A dated audit is needed before phase 6.
- The passing score for the scoring model, set from the human-written
  articles in phase 6.
