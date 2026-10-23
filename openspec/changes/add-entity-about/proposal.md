## Why

Peated has the largest open record of bottles, but its distillery and brand
pages say little beyond a model-written description with no sources. Peated
should be the best place to learn about a distillery or brand: what happened,
when, who owned it, how it works, and what came out of it, all checked
against sources. The bottle catalog gives Peated data no other reference has,
and the Brora proof of concept (`poc/entity-about`) shows the page works.

There are about 1,300 distilleries and 2,600 brands, so people cannot write
these pages. Software must research, check, and publish them without a person
approving each page. That only works if the rules that stop guesses and filler
live in code.

## What Changes

- Store each Entity's About data as **one typed JSON document**, checked by a
  schema in code. It holds sources, citations linking each fact to its
  supporting passage, history events, eras, names over time, distillery site
  facts, and prose sections. Conflicting sources stay visible instead of
  being settled by guesswork.
- Keep the list of site facts in a **typed file in code**, changed by pull
  request. Changes to the document schema should
  be rare and backward compatible.
- **BREAKING (internal):** move Entity history from `entity_event` into the
  document, then drop the table.
- Add **catalog numbers** routes built from Bottles: Bottles by year
  distilled, who bottled them, which distilleries make a brand, and releases
  by year. Add a vintage filter to the Bottle list.
- **Nothing is shown without a source.** Every event, site fact, and sentence
  cites sources, whether the pipeline or a moderator wrote it, and every page
  lists its numbered sources.
- Add an **About** tab for distilleries and brands. A fixed template places a
  sourced lead, short sections, a timeline, key facts, owners, catalog charts,
  and numbered sources. Each part shows only when its data passes a minimum.
- Add one **`writeEntityAbout` job**: a single model call searches and reads
  public pages and returns a document draft. Code checks that quotes appear on
  pages read, that every sentence carries a fact, length, and banned phrases,
  then publishes without approval. Runs happen when an administrator queues
  them.
- Show era context on Bottle pages, such as "Distilled during Brora's heavily
  peated years (1969–1973)."
- Replace each Entity's unsourced generated description with its sourced lead
  once one exists. `generateEntityDetails` stops writing descriptions.
- Move the Brora proof of concept from a code file to stored data and delete
  the code file.

## Capabilities

### New Capabilities

- `entity-facts`: Sources, citations, history events, eras, names over time,
  distillery site facts, conflicting sources, and the rules that decide which
  facts are published.
- `entity-about-pages`: The About tab, its template for distilleries and
  brands, catalog numbers, widget display rules, and era context on Bottle
  pages.
- `entity-about-pipeline`: The job that writes About documents and the code
  checks that guard what it publishes.

### Modified Capabilities

- `entity-identity`: An Entity's description comes from its sourced About lead
  once one is published.

## Impact

- **Database:** one new table, `entity_about` (one document per Entity), a
  new `change` object type, and a later drop of `entity_event`. Generated with `pnpm db:generate`.
- **Server:** new routes under `apps/server/src/orpc/routes/entities/about/`
  and catalog-number routes; a vintage filter on `bottles.list`; one new
  worker job; changes to `generateEntityDetails`.
- **Web:** About tab, widgets in `apps/web/src/features/entityAbout/`, Bottle
  page era line, overview changes.
- **Models and services:** web search and page fetching (the Firecrawl tooling
  the classifier already uses) and the AI gateway. One model check
  under `pnpm evals`.
- **Docs:** new `docs/features/entity-about.md`; updates to
  `docs/architecture/whisky-identity-model.md` and the `peated-writing`
  skill.
- **Operations:** an on/off switch and batches queued by activity.
