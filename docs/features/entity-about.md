# Entity About Pages

A distillery or brand can have an About tab: a short, sourced account of the
place or label, with a timeline, key facts, owners, and numbers from the
Bottle catalog. Every statement on the page traces to a fact, and every fact
traces to a source. Bottlers and companies will get About pages the same
way later; Bottles will need their own design.

## What Is Stored

Each Entity has at most one About document in `entity_about`. The schema in
`apps/server/src/schemas/entityAbout.ts` owns its exact shape. Changes to it
should be rare and backward compatible; the comment beside the schema states
the rule.

The document holds:

- **Sources**: pages that support facts. Each has a kind: `official`,
  `reference`, or `press`. Shops, auctions, and forums are never cited; the
  writer uses them only as leads.
- **Events**: dated history, such as openings, closings, renames,
  acquisitions, and eras (a span like "heavily peated, 1969 to 1973"). Each
  event lists its citations: the source, the value the source states, and a
  short quote.
- **Site facts**: typed facts about a production site, such as the number of
  stills or the water source. `apps/server/src/lib/entityAbout/aboutFactFields.ts`
  lists them. Adding one is one entry there.
- **Sections**: short sentences. Each sentence lists the facts it rests on.
  The section with key `lead` opens the page; every other section has a
  heading.

The page is a generated artifact. Each writer run returns the whole next
version, and moderators can patch it. Every save stores the full document in
the `change` table, so an earlier version can be restored. Facts that must
survive every run belong in notes or in the history timeline, not only on the
page.

Two other stores feed the writer:

- **History timeline** (`entity_event`): the Entity's dated history items,
  edited through `entities.events.*` and shown on the Overview. The writer
  reads them as leads, so the page's events roughly cover them.
- **Notes** (`entity_about_note`): plain-text notes moderators keep for the
  writer, such as a fact to keep or a trap to avoid, with an optional source
  URL. Every run reads them. They guide the writer but are never cited.

History about a production site belongs on the Distillery. History about a
label belongs on the Brand. See
[Whisky Identity Model](../architecture/whisky-identity-model.md#naming-and-entity-boundaries).

## What Is Shown

Rules in `apps/server/src/lib/entityAbout/display.ts` run on every read, so
nothing stored can go stale:

- A fact needs at least one source.
- When sources state different values, the page shows the chosen value and a
  "Sources disagree" note with each value and its sources. Values where one is
  a more exact form of the other, such as `1983` and `1983-03`, agree. Ranges
  such as `1969–1973` agree when their starts and ends do. For history, only
  stated dates count; a source that states a name instead does not disagree.
- A sentence that rests on a hidden fact is left out.
- Quotes stay private. The page lists sources and the date the page was last
  checked, and says nothing else about how the text was written.

The About tab appears only when the page has a lead and at least one other
part: a section, a timeline with 2 or more spans, or 2 or more key facts. The
sitemap uses the same rule, so it never lists a page that returns not found.
Both count what shows the way the page does, with linked Entities loaded.

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

A Bottle page with one distiller and a
vintage notes the era or former name that covers that vintage. The note
links to the About page only when that page exists.

## Who Can Change It

- Moderators read the full document, with quotes, through
  `entities.about.document`, and send back a new version through
  `entities.about.update`, along with the version they read. The public page
  leaves quotes out, so it is not a starting point for edits. Every event,
  site fact, and sentence needs a source. The next writer run may rewrite
  their edit; a fact that must stay belongs in a note. They can hide or show
  the page with `entities.about.status`.
- Moderators keep notes with `entities.about.notes.list`, `create`, and
  `delete`.
- The `writeEntityAbout` worker job writes as the `aboutPipeline` system
  actor. Administrators queue it with `/admin/catalog/write-entity-about`.
  `ENTITY_ABOUT_WRITER_ENABLED` turns it off; so does a missing
  `AI_GATEWAY_API_KEY` or `FIRECRAWL_API_KEY`, and the admin route then
  refuses to queue it.

## How The Job Writes A Page

`writeEntityAbout` makes one model call with web search and page-reading
tools and fixed limits. The model gets the Entity's fields, its notes, its
history timeline, and the current page, and returns the complete next
version. It may keep, correct, add, or drop anything. Code then checks it:

- Every item matches the stored schema, including its length limits.
- A quote must appear on a page the model read in this run, or be the same
  quote from the same page as one the current page already has, and state
  the citation's value. A fact stands only when a kept quote states its year
  (or number); a dated article's publication date counts when its year is on
  the page read or the current page has the same date. A name or new owner
  must appear whole in one quote, and every number in an event's text or
  title must appear in a quote. Citations that fail are dropped, then facts
  with no citations left.
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
nothing. A draft that passes is saved as the next version, with a version
check: a page a moderator edited during the run fails it, and the job is
retried from the new page. A bad run is undone by restoring an earlier
version from the change log.

New owners are stored by name. When exactly one Entity or alias has that
name, the job links it, and the page shows a link while that Entity exists,
following merges to the Entity it became. Otherwise the page shows the name.

A model check runs this job on 5 Entities with saved pages instead of the
live web: `apps/server/src/agents/entityAbout/writer.eval.test.ts`. Each case
in `apps/server/src/agents/entityAbout/evals/` lists its pages, the events a
careful writer should find, and review notes. See
`docs/development/model-checks.md`.

## Merges

Merging Entities does not combine their About pages. The destination keeps
its page, and the merged Entity's page is deleted with it; every saved
version stays in the `change` table. The merge moves the merged Entity's
history items and notes to the destination and queues a writer run, so the
destination's next version can draw on them.

## Descriptions

A run that publishes a lead replaces an empty or generated Entity
description. A description a person wrote, or one written before Peated
recorded who wrote descriptions, stays. A hidden page never changes the
description. After the writer has covered every distillery and brand,
`/admin/catalog/clear-entity-descriptions` clears each generated description
that is not the published lead, so no unsourced description remains.
Descriptions a person wrote stay.

The prompt is in `apps/server/src/agents/entityAbout/instructions.ts`. Its
examples are documents people wrote in
`apps/server/src/lib/entityAbout/examples/`: Brora for a distillery and Johnnie
Walker for a brand.
