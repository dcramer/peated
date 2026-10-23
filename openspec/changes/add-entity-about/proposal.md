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
- Keep the list of site facts and the reviewed source sites in **typed files
  in code**, changed by pull request. Changes to the document schema should
  be rare and backward compatible.
- **BREAKING (internal):** move Entity history from `entity_event` into the
  document, then drop the table.
- Add **catalog numbers** routes built from Bottles: Bottles by year
  distilled, who bottled them, which distilleries make a brand, and releases
  by year. Add a vintage filter to the Bottle list.
- Add an **About** tab for distilleries and brands. A fixed template places a
  sourced lead, short sections, a timeline, key facts, owners, catalog charts,
  and numbered sources. Each part shows only when its data passes a minimum.
- Add an automated **research and writing pipeline**: find sources, extract
  facts with quotes, write short prose from accepted facts only, check it in
  code and with a scoring model, then publish without approval.
- Add safety nets that do not block publishing: member corrections, sampled
  spot checks in the moderation Inbox, quality measures, and a pause switch.
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
- `entity-about-pipeline`: Automated research, fact extraction, writing,
  quality checks, publishing, refresh, and measurement.

### Modified Capabilities

- `entity-identity`: An Entity's description comes from its sourced About lead
  once one is published.
- `moderation-workspace`: The Inbox includes About spot checks and conflicts
  between automated updates and people's edits.

## Impact

- **Database:** two new tables, `entity_about` (one document per Entity) and
  `entity_about_run`, a new `change` object type, and a later drop of
  `entity_event`. Generated with `pnpm db:generate`.
- **Server:** new routes under `apps/server/src/orpc/routes/entities/about/`
  and catalog-number routes; a vintage filter on `bottles.list`; new worker
  jobs; changes to `generateEntityDetails`.
- **Web:** About tab, widgets in `apps/web/src/features/entityAbout/`, Bottle
  page era line, overview changes.
- **Models and services:** web search and page fetching (the Firecrawl tooling
  the classifier already uses) and the AI gateway. New model checks under
  `pnpm evals`.
- **Docs:** new `docs/features/entity-about.md`; updates to
  `docs/architecture/whisky-identity-model.md`, the `peated-writing` skill,
  and a source-site audit in `docs/research/`.
- **Operations:** cost limits, a pause switch, and a backfill ordered by
  activity.
