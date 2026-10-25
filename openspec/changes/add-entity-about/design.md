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
- Publish without approval.
- Pages must not read like generated filler.
- Pages show sources and a checked date, with no other statement about how
  the text was written.
- About data lives in one typed document per Entity. Site facts come from a
  typed field list in code. Schema changes should be rare and backward
  compatible.
- The About page is a generated artifact. Each run writes the whole next
  version; change history keeps the old ones.
- The history timeline stays in `entity_event`, as its own simple widget.
  The writer reads it as leads.
- Facts moderators want every run to know go in a notes table.
- Unsourced descriptions are replaced as sourced leads are published. Those
  left after the full run are cleared. Descriptions a person wrote stay.

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
- Make low-quality text hard to publish with a few exact checks in code.
- Keep the pipeline small: one job, one model call, no new review queues.
- Keep layout in code so 3,900 pages stay consistent and change together.
- Keep the page easy to regenerate: no merge rules between runs and edits.

**Non-Goals:**

- Bottler and Company About pages. Companies still gain owner timelines from
  events.
- Bottle articles.
- Member-written articles or a rich-text editor.
- Showing source quotes publicly.
- Changing Entity identity, ownership, or status automatically.
- Scheduled refreshes, scoring models, spot-check queues, run tracking, and
  quality dashboards. Add them only if real errors show they are needed.
- A web editor for moderators. They edit through the API and `pnpm cli api`.
- Adding About text to search documents.

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
This keeps storage to one table and puts the shape of the data in one
reviewed place.

**Table**

- `entity_about`
  - `entityId`: primary key.
  - `document`: JSON.
  - `schemaVersion`.
  - `version`: for saved-version checks on every write.
  - `status`: `published` or `hidden`.
  - `checkedOn`, `updatedAt`.

**The document**

- `sources`: list of `{ id, url, title, publisher, publishedOn, kind }`.
  `kind` is `official`, `reference`, or `press`.
  `url` is unique within the document.
- `events`: list of `{ id, kind, date, endDate, continuing, name, title,
text, relatedEntityId, newOwnerId, newOwnerName, citations }`.
  - Kinds: `opened`, `closed`, `mothballed`, `reopened`, `acquired`,
    `renamed`, `era`, `generic`.
- `siteFacts`: an object keyed by field, each value
  `{ value, asOf, citations }`. Distilleries only.
- `sections`: list of `{ key, heading, eraEventId, sentences }`.
  Each sentence is `{ text, factIds }`. A fact ID is an event `id` or
  `site:<field>`. The lead is the section with key `lead`. Sentences never
  state catalog numbers, which change daily and belong in charts.
- Every `citations` entry is `{ sourceId, statedValue, quote }`. Quotes are
  at most 300 characters and are removed by the public serializer.
- Whether a fact is shown is computed by the display rules on read, not
  stored, so it can't go stale.

**Typed files in code** (changed by pull request, so review comes from code
review):

- `aboutFactFields.ts` lists the site facts: key, label, value type, unit,
  and the Entity kinds it applies to (wash stills, spirit stills, other
  stills, capacity in litres of alcohol a year, water source, heating,
  building listing). The document schema is built from this list. Adding a
  fact is one entry, not a migration.

**Schema rules** (the schema module states this in a comment beside the
schema):

- Changes to the document schema should be rare and backward compatible: add
  optional fields, never rename or remove one, and never change a field's
  meaning.
- Every saved document must still parse after a change.
- The public `entities.about.details` response follows the same rule: add
  fields, never rename or remove them.
- A change that cannot meet this needs a `schemaVersion` bump, an upgrade
  function that runs when a document is read, and a bounded migration that
  rewrites stored documents and checks the result.

**History, links, and concurrency**

- **History:** every write saves the full document to the existing `change`
  table under a new object type, `entity_about`, with the actor. The pipeline
  writes as a new system actor, `aboutPipeline`. Rollback restores an
  earlier version.
- **Entity links:** `relatedEntityId` and `newOwnerId` are optional links
  with no database foreign keys.
  - An acquisition always stores the owner's name (`newOwnerName`). The
    writer sets IDs from an Entity search tool built on the classifiers'
    `searchClassifierEntities`; the job keeps an ID only when that search
    returned it in the run or the current page has it.
  - Reads resolve merged Entities through `entity_tombstone` and show a link
    while the Entity exists, else the name. A merge never edits documents.
  - The pipeline never creates Entities.
- **Concurrency:** writes send the version they read. A stale version is
  rejected and the writer retries from the new document, per
  `docs/policies/database-correctness.md`.
- **Checking:** the schema module parses `unknown` at every read and write,
  per `docs/policies/data-and-permissions.md`.

**Merges.** `mergeEntity` does not combine About documents. The destination
keeps its document, the merged Entity's document is deleted with it (its
versions stay in change history), and the merge moves history rows and notes
to the destination and queues a writer run.

**History timeline and notes stay outside the document.**

- `entity_event` stays the history timeline: a simple widget, such as the
  Overview list, edited through the existing `entities.events.*` routes.
  The writer reads its rows as leads, so the page's events roughly cover it.
- `entity_about_note` holds plain-text notes (up to 500 characters, with an
  optional source URL) that moderators keep through
  `entities.about.notes.*`. Every run reads them. They guide the writer but
  are never cited, so every shown fact still has a web source.

Alternatives considered:

- **Separate tables for sources, citations, site facts, and sections.**
  Rejected: seven tables and many migrations for data that is always read
  and written together, one Entity at a time.
- **Data files in the repository.** Rejected: every pipeline write and every
  moderator correction would be a commit, and moderators could not edit in
  the product.
- **Moving `entity_event` into the document.** Rejected: a page that is
  rewritten on every run is the wrong home for history people curate, and
  copying it in needed a backfill and merge rules that kept breaking.
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
pipeline leaves the column alone. A moderator fixes whichever is wrong.

### 3. Display rules live in code

Two plain functions run in the public serializer on every read:

- `isFactShown(citations)` hides a fact with no source.
- `getDisagreement(citations)` returns every stated value when citations
  disagree, for the "Sources disagree" note.

The model picks the best-supported value when sources conflict. Code checks
that the pick is one of the stated values.

### 4. Pipeline: one job, one model call

`writeEntityAbout(entityId)` is one worker job, with arguments checked as
`docs/policies/background-work.md` requires.

1. **One model call with tools.**
   - Tools: web search and page fetch, with a fixed limit of searches and
     page reads, and Entity search over the classifiers' search.
   - Input: the Entity's name, kind, location, owner, aliases, its notes,
     its history timeline, the current page, the field list, the style
     rules, and two examples written by people (Rosebank and Johnnie
     Walker).
   - Output: the complete next version of the page, parsed with the
     document schema. It may keep, correct, add, or drop anything.
   - Page text is data, not instructions. The model has no write tools.
2. **Checks in code.** Each check works on exact text:
   - Drop citations whose quote is not in a page read during this run, unless
     it is the same quote from the same page as one the current page already
     has. Then drop facts with no citations left.
   - Every sentence lists facts in the draft, and every year or number in it
     appears in those facts.
   - Length limits match the number of shown facts.
   - No banned phrases, and no sentence over 30 words.
3. **Retry.** A draft that fails gets one retry with the failure reasons.
   After that, the job logs the reason and saves nothing.
4. **Save.**
   - Keep only Entity links from search or the current page, then save the
     draft as the next version with a version check and record the change.
     When a moderator saves the page during the run, their version stays
     and the job saves nothing.
   - Update the Entity description from the lead unless a person wrote it.

The job writes as a new system actor, `aboutPipeline`. It never changes the
Entity's name, kind, owner, status, or Bottles.

An administrator queues runs for one Entity or for a batch ordered by
`publicReviewAndTastingCount`. There is no schedule. A configuration switch
stops new runs.

Alternatives considered:

- **Separate research, extract, write, and score steps with run tracking.**
  Rejected for now. It adds a table, a state machine, and a second model for
  a quality problem we have not measured. Revisit if the checks above let
  bad pages through.
- **No quote check.** Rejected. It is the one cheap guard against a model
  inventing facts, and it is exact string matching.

### 5. Catalog numbers routes

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

### 6. Web: widgets with display rules

`apps/web/src/features/entityAbout/` holds:

- one component per part: lead, `EntityLifeline`, `VintageChart`, bottler
  list, distillery list, key facts, owners, sources, disagreement note;
- each component's display rule as a plain function, such as
  `showVintageChart(counts)`;
- a template list per kind.

The route renders the template list, skipping parts whose rule fails. Parts
come from the proof of concept, rewired to the API.

Bottle pages get `BottleEraNote`, fed by the Bottle's single
distiller and vintage from `entities.about.details`. Each component gets one
Storybook Overview story, per `apps/web/AGENTS.md`.

### 7. Writing quality

- The banned-phrase list and the About style rules go into the
  `peated-writing` skill. The code check imports the same list.
- The prompt uses two examples written by people: Rosebank for a distillery
  and Johnnie Walker for a brand. Rosebank replaced the Brora article, so
  Brora and Clynelish, whose histories overlap, can be model-check cases.
- `pnpm evals` gets a model check on Entities with saved, reviewed pages,
  including a rebuilt silent distillery, a famous distillery, a recent craft
  distillery, a brand with many distilleries, a thin record, and two
  distilleries that shared one name. Rosebank and Johnnie Walker are the
  prompt's examples, so they are not cases. The check runs the real job's
  checks, per `docs/development/model-checks.md`.
- Problems on live pages arrive through the existing Entity reports. A
  moderator patches the page, and adds a note when the fix must survive
  later runs.

### 8. Brand and distillery split

Under the identity model, a distillery's own line is the same Entity, so
Ardbeg gets one About page. Separate Brand Entities, such as house labels and
owner collections, get brand pages. Their history is the brand's, and they
link to the distilleries that make them.

`docs/architecture/whisky-identity-model.md` gains one rule: history about a
production site belongs on the Distillery, and history about a label belongs
on the Brand.

### 9. Extending later

Each likely change has one place to make it, without reworking storage:

| Change                                | Where it goes                                                    |
| ------------------------------------- | ---------------------------------------------------------------- |
| New site fact                         | One entry in `aboutFactFields.ts`                                |
| New event kind                        | An added enum value in the schema (backward compatible)          |
| New page part                         | A component, its display rule, and one template entry            |
| About pages for Bottlers or Companies | A template for that kind; same document                          |
| About pages for Series                | The same schema in a `series_about` table                        |
| Filter or sort by a fact              | A projection table rebuilt from documents                        |
| Review before publishing              | Add a `draft` status; the job saves drafts instead of publishing |
| Scheduled refresh                     | A job that queues Entities by `checkedOn` age                    |
| Stronger quality checks               | A scoring step after the code checks                             |

## Risks / Trade-offs

- **Wrong facts published without review.**
  - Quotes are checked against pages read in the run.
  - Shops, auctions, and forums are never cited.
  - A bad run is rolled back from change history.
  - Reports and moderator edits fix the rest.
  - If errors are common, add a review step then.
- **Bland but correct text.**
  - Every sentence must carry a fact.
  - Thin records get no prose.
  - Banned phrases are rejected.
- **Pages stay out of date because nothing refreshes them.** An administrator
  reruns a batch when needed.
- **A document schema change breaks stored documents.**
  - Changes are rare and backward compatible by rule.
  - A test parses sample documents.
- **A run rewrites a moderator's patch.** Patches are versions, not
  protected items. A fix that must last goes in a note.
- **Copying source text.** Quotes are private and short. The style rules and
  the sentence-per-fact rule keep prose in Peated's own words.

## Migration Plan

1. Add `entity_about`, `entity_about_note`, and the `entity_about` change
   object type in migration `0322_add_entity_about`, generated with
   `pnpm db:generate`.
2. Enter Brora's document through `pnpm cli api`, following the catalog
   maintenance approval and checks. Delete the code file.
3. Ship the catalog-numbers routes and the About tab.
4. Run the job on 20 Entities, read every result, and fix the prompt or
   checks.
5. Queue batches by activity, then run `clear-entity-descriptions`.

Rollback:

- Turn off the job switch.
- Hide About pages.
- Restore any document from change history.

## Open Questions

None.
