# Entity About Pages

A distillery or brand can have an About tab: a short, sourced account of the
place or label, with a timeline, key facts, owners, and numbers from the
Bottle catalog. Every statement on the page traces to a fact, and every fact
traces to a source.

## What Is Stored

Each Entity has at most one About document in `entity_about`. The schema in
`apps/server/src/schemas/entityAbout.ts` owns its exact shape. Changes to it
should be rare and backward compatible; the comment beside the schema states
the rule.

The document holds:

- **Sources**: pages that support facts. Each has a kind: `official`,
  `reference`, `press`, or `retailer`.
- **Events**: dated history, such as openings, closings, renames,
  acquisitions, and eras (a span like "heavily peated, 1969 to 1973"). Each
  event lists its citations: the source, the value the source states, and a
  short quote.
- **Site facts**: typed facts about a production site, such as the number of
  stills or the water source. `apps/server/src/lib/entityAbout/aboutFactFields.ts`
  lists them. Adding one is one entry there.
- **Sections**: short sentences. Each sentence lists the facts it rests on.
  The section with key `lead` opens the page.

Every item records who wrote it: a `person` or the `pipeline`. The pipeline
never replaces an item a person wrote. Every save stores the full document in
the `change` table, so an earlier version can be restored.

History about a production site belongs on the Distillery. History about a
label belongs on the Brand. See
[Whisky Identity Model](../architecture/whisky-identity-model.md#naming-and-entity-boundaries).

## What Is Shown

Rules in `apps/server/src/lib/entityAbout/display.ts` run on every read, so
nothing stored can go stale:

- A fact needs at least one source that is not a retailer.
- When sources state different values, the page shows the chosen value and a
  "Sources disagree" note with each value and its sources. Values where one is
  a more exact form of the other, such as `1983` and `1983-03`, agree.
- A sentence that rests on a hidden fact is left out.
- Quotes stay private. The page lists sources and the date the page was last
  checked, and says nothing else about how the text was written.

The About tab appears only when the page has a lead and at least one other
part: a section, a timeline with 2 or more spans, or 2 or more key facts. The
sitemap uses the same rule, so it never lists a page that returns not found.

Each part of the page has a minimum and is hidden below it, with no heading or
placeholder. The constants live in
`apps/web/src/features/entityAbout/entityAbout.ts`:

| Part                        | Shown when                  |
| --------------------------- | --------------------------- |
| Timeline (status and names) | 2 or more spans             |
| Bottles by vintage          | 10 or more Bottles with one |
| Bottlers                    | 3 or more bottlers          |
| Bottles by release year     | 10 or more Bottles with one |
| Key facts                   | 2 or more facts             |

Catalog numbers are counted from active Bottles at read time, the same way as
the Entity Bottles tab. Prose never states them; they change daily. Chart bars
link to the Bottle list filtered to that year.

When an Entity has an About page, its Overview shows key dates and a link
instead of the full history list. A Bottle page with one distiller and a
vintage notes the era or former name that covers that vintage. The note
links to the About page only when that page exists.

## Who Can Change It

- Moderators read the full document, with quotes and who wrote each item,
  through `entities.about.document`, and send it back with their edits
  through `entities.about.update`, along with the version they read. The
  public page leaves quotes out, so it is not a starting point for edits.
  Their edits are marked as written by a person. They can hide or show the
  page with `entities.about.status`.
- The legacy Entity history routes (`entities.events.*`) edit the same
  document. A new history item needs a source URL.
- The `writeEntityAbout` worker job writes as the `aboutPipeline` system
  actor. Administrators queue it with `/admin/catalog/write-entity-about`.
  `ENTITY_ABOUT_WRITER_ENABLED` turns it off.

## How The Job Writes A Page

`writeEntityAbout` makes one model call with web search and page-reading
tools and fixed limits. The model returns a draft document. Code then checks
it:

- A quote must appear on a page the model read in this run and state the
  citation's value. A fact stands only when a kept quote states its year (or
  number); a dated article's publication date counts. Citations that fail
  are dropped, then facts with no citations left.
- Every sentence cites facts in the draft. Every year and number in a
  sentence appears in those facts.
- When sources disagree on a date or number, the chosen value must be one a
  source states.
- Length limits depend on how many facts are shown. No sentence is over 30
  words. No banned phrases, from
  `apps/server/src/lib/entityAbout/bannedPhrases.ts`.

Site facts that do not apply to the Entity's kind are dropped, and the
store's own save rules run as a check too, so a draft the store would reject
gets its retry. A draft with no sourced facts fails.

A draft that fails gets one retry with the reasons. After that, the job saves
nothing. A draft that passes is merged into the stored document, keeping
every item a person wrote and every pipeline fact a person's section cites.
After the merge, the pipeline's sentences are checked again against the
facts they cite, so a sentence cannot contradict a value a person set. A run
never leaves the page with fewer shown facts; such a draft, for example one
written while search was failing, saves nothing. A moderator
removes facts by editing. The merge is saved with a version check.

## History Without Sources

All shown history needs a source. History copied from `entity_event` often has
none, so it is stored but hidden until a source is found:

- The job lists each stored event the page cannot show in the writer's input,
  as a lead to check. It is not evidence.
- When a draft event has the same kind as a kept event (one a person wrote, or
  one with no citations), the dates agree, and no name, owner, or title
  conflicts, the draft's citations are added to the kept event. Its date and
  text stay as stored, and no second event is added. A generic event matches
  only the same text, or a listed item whose number the writer reuses,
  because many different things happen in one year.
- History nobody can source stays stored and hidden. A moderator can add a
  source later.

## Copying Legacy History

`/admin/catalog/backfill-entity-about` copies `entity_event` rows into About
documents. Each copied item records its row in `legacyEventId`, and the
backfill copies a row only when no item records it, so repeat runs are safe.
Deleting a history item also deletes its row. Copied history counts as
written by a person: the writer can add sources to it but never replaces it.

## Merges

Merging Entities combines their About documents. Site facts that do not apply
to the destination's kind are dropped, and so is an acquisition by the
destination itself. A merge never reveals a page a moderator hid: a hidden
page's content joins only a destination that is hidden or new, and a new
page then starts hidden. Links to a merged Entity are followed to the Entity
it became when the page or history is read.

## Descriptions

A run that publishes a lead replaces an empty or generated Entity
description. A description a person wrote, or one written before Peated
recorded who wrote descriptions, stays. A hidden page never changes the
description. After the writer has covered every distillery and brand,
`/admin/catalog/clear-entity-descriptions` clears each generated description
that is not the published lead, so no unsourced description remains.
Descriptions a person wrote stay.

The prompt is in `apps/server/src/agents/entityAbout/instructions.ts`. The
person-written Brora document in
`apps/server/src/lib/entityAbout/examples/brora.ts` is its example.
