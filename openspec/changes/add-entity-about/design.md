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
- Distillery site facts use typed columns.
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

### 2. Data model

New tables:

- `source`: `id`, `url`, `normalizedUrl` (unique), `title`, `publisher`,
  `publishedOn`, `siteId`, `license`, `status` (`available`, `unavailable`),
  `lastFetchedAt`.
- `source_site`: `id`, `domain` (unique), `name`, `tier` (`primary`,
  `reference`, `press`, `finder`), `notes`. People edit it; its first contents
  come from a dated source-site audit in `docs/research/`.
- `citation`: `id`, `sourceId`, a fact link (exactly one of `entityEventId`,
  `siteFactId`, `aboutSectionId`), `statedValue`, `quote` (≤ 300 characters,
  private), `createdByActorId`.
- `distillery_site_fact`: `entityId`, `field` (`washStills`, `spiritStills`,
  `otherStills`, `capacityLitres`, `waterSource`, `heating`, `listing`),
  `numberValue` or `textValue`, `asOf`, `published`, `createdByActorId`,
  `updatedByActorId`. Unique on (`entityId`, `field`). A database check allows
  rows only for Entities whose kind is `distillery`.
- `entity_about`: `entityId` (primary key), `leadSectionId`, `status`
  (`published`, `hidden`), `checkedOn`, `factsVersion` (a hash of the facts
  the prose cites).
- `entity_about_section`: `id`, `entityId`, `key`, `heading`, `position`,
  `eraEventId` (optional), `body` (sentences, each with its cited fact IDs,
  stored as checked JSON), `createdByActorId`, `updatedByActorId`.
- `entity_about_run`: `id`, `entityId`, `step` (`research`, `extract`,
  `write`, `score`, `publish`), `status`, `attempts`, `searches`, `fetches`,
  `modelCalls`, `costMicros`, `failureReason`, `startedAt`, `finishedAt`.

Changes to `entity_event`:

- New kinds `renamed` and `era`.
- New columns `name` (required for `renamed`), `title` (required for `era`),
  `endDate` (same format as `date`), `continuing`, `relatedEntityId`,
  `published`, `updatedByActorId`.
- `sourceUrl` becomes a citation in a backfill, then is dropped in a later
  migration.

A fact counts as written by a person when its last writer is a user actor. The
pipeline writes as a new system actor, `aboutPipeline`. Change history records
every write, as `docs/policies/database-correctness.md` requires.

Alternative: a generic key-value facts table. Rejected by decision: typed
columns can be filtered and compared, such as "distilleries with more than 6
stills."

Alternative: a separate claims table for disagreements. Rejected: storing each
source's stated value on its citation records the conflict where it happens,
with no extra concept.

### 3. Publishing rules live in code

`isFactPublishable(citations, sites)` applies the support rule: one `primary`
site, or two different `reference` or `press` sites. `chooseFactValue`
applies the conflict rule. Both are plain functions with unit tests, run on
every write and every refresh, and they set `published`.

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
  - Tiers and access rules live in the reviewed site list.
  - Only short private quotes are stored, never whole pages.
  - Fetching follows each site's terms, recorded in the audit.
- **Cost of 3,900 runs.**
  - Per-run and daily limits.
  - Phase 2 measures cost on 50 Entities before the backfill is sized.
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

1. Add the tables and columns; generate migrations with `pnpm db:generate`.
2. Backfill: copy each `entity_event.sourceUrl` into a source and citation,
   mark existing events as written by a person when a user created them, and
   mark them published. Drop `sourceUrl` in a later migration.
3. Load the reviewed source-site list.
4. Enter Brora's facts and article as stored data through the API, following
   the catalog maintenance approval and checks. Delete the code file.
5. Ship catalog-numbers routes and the About tab with publishing paused.
6. Run the pipeline with publishing paused on the 12 human-written-article
   Entities and 38 more, and compare results.
7. Turn on publishing and start the backfill.

Rollback:

- Pause the pipeline, then hide About pages.
- The tables can stay while hidden.
- Descriptions replaced by leads remain in change history and can be
  restored.

## Open Questions

- The first source-site list and tiers. A dated audit is needed before phase 6.
- The passing score for the scoring model, set from the human-written
  articles in phase 6.
