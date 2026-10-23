## 1. About document storage

- [ ] 1.1 Add the About schema module with the document schema, `aboutFactFields.ts`, and a `schemaVersion`; put the backward-compatibility rule in a comment beside the schema
- [ ] 1.2 Add `sourceSites.ts` with types for domain, name, tier, and notes, starting empty until the audit in 5.1
- [ ] 1.3 Add `entity_about` and `entity_about_run` tables and the `entity_about` change object type; generate the migration
- [ ] 1.4 Add read and write functions that parse `unknown`, check the saved version on every write, save the full document to change history, check linked Entities on write, and follow merged Entities on read; integration tests for each
- [ ] 1.5 Add a test that parses a sample of real document shapes, so schema changes that break stored documents fail CI
- [ ] 1.6 Add the `aboutPipeline` system actor
- [ ] 1.7 Write `isFactPublishable` and `chooseFactValue` and run them in the public serializer, with integration tests covering one primary source, two reference sites, same-site citations, finder-only sources, and even conflicts
- [ ] 1.8 Add moderator API routes to edit events, site facts, sources, and sections in the document, with tests for permissions, stale versions, and the rule that the pipeline never overwrites a person's edit
- [ ] 1.9 Backfill a document for each Entity with `entity_event` rows, copying `sourceUrl` into sources and citations; check event counts per Entity
- [ ] 1.10 Point Overview history, owner acquisitions, and existing event routes at the document; stop writing `entity_event`

## 2. Catalog numbers

- [ ] 2.1 Add a `vintageYear` filter to `bottles.list` and the Entity Bottles tab, with tests
- [ ] 2.2 Add `entities.about.vintages`, `bottlers`, `distillers`, and `releaseYears` routes that count active Bottles the same way as the Bottles tab, with tests
- [ ] 2.3 Add caching for the new routes per `docs/architecture/web-caching.md`

## 3. About pages

- [ ] 3.1 Add `entities.about.details`, returning published facts, events, sections, sources, and disagreements without quotes, with tests
- [ ] 3.2 Move the proof-of-concept widgets onto the API and add display-rule functions with tests for each minimum
- [ ] 3.3 Add per-kind templates for distilleries, brands, and distilleries that are also brands
- [ ] 3.4 Add the bottler list, distillery list, and disagreement note widgets, each with one Storybook Overview story
- [ ] 3.5 Show the About tab only when a lead and one other part exist; test the tab rule
- [ ] 3.6 Link chart bars to the filtered Bottle list
- [ ] 3.7 Replace the Overview history list with key dates and a link when About exists
- [ ] 3.8 Add `BottleEraNote` to Bottle pages for single-distiller Bottles with a vintage, with tests for eras, former names, and no match
- [ ] 3.9 Add canonical URLs, sitemap entries, and structured data for About pages per `docs/features/catalog-page-seo.md`
- [ ] 3.10 Check desktop and phone layouts in light and dark mode in a browser

## 4. Brora on stored data

- [ ] 4.1 Get approval for Brora's production changes under `docs/operations/catalog-maintenance.md`
- [ ] 4.2 Enter Brora's sources, events, eras, names, site facts, status, and sections through `pnpm cli api`; verify each write by reading it back
- [ ] 4.3 Delete `apps/web/src/features/entityAbout/articles/brora.ts` and the in-code article map

## 5. Writing standard

- [ ] 5.1 Audit source sites and write the dated tier list in `docs/research/`; load it into `source_site`
- [ ] 5.2 Add the banned-phrase list and About style rules to the `peated-writing` skill as a file the code check imports
- [ ] 5.3 Write the remaining 11 human-written articles from the design's list, as stored data
- [ ] 5.4 Write the scoring checklist

## 6. Pipeline

- [ ] 6.1 Add the run workflow with stored state, per-run and daily limits, idempotent steps, and a pause switch
- [ ] 6.2 Add the research step using the shared web search and page-fetch tooling, filtered by the source-site list
- [ ] 6.3 Add the extract step with quote checks, schema checks, matching by kind and date, publishing rules, and Inbox findings for identity changes and conflicts with people's edits
- [ ] 6.4 Add the write step with sentence-level fact IDs and code checks for citations, years, numbers, length, and banned phrases
- [ ] 6.5 Add the scoring step with one rewrite and the fall-back to facts only
- [ ] 6.6 Add the publish step: keep unchanged sections, rewrite only sections whose facts changed, and update the Entity description unless a person wrote it
- [ ] 6.7 Stop `generateEntityDetails` from writing descriptions; keep pronunciation and other fields
- [ ] 6.8 Add model checks under `pnpm evals` for extraction and writing, using the 12 human-written articles and their evidence packs
- [ ] 6.9 Add tests for limits, resume after failure, the pause switch, and keeping people's edits

## 7. Safety nets

- [ ] 7.1 Add About spot-check tasks and About finding tasks to the moderation Inbox
- [ ] 7.2 Route member reports on About pages to the Inbox, and turn corrections into person-written facts that trigger a write-only run
- [ ] 7.3 Add the pipeline health view to Background work, including the weekly stop rule
- [ ] 7.4 Add a moderator action to hide one Entity's generated About content

## 8. Rollout

- [ ] 8.1 Run the pipeline with publishing paused on the 12 human-written-article Entities plus 38 more; compare against the articles and record fact error rate, draft rejection reasons, and cost
- [ ] 8.2 Set the scoring threshold and budgets from those results
- [ ] 8.3 Turn on publishing and start the backfill ordered by activity
- [ ] 8.4 Review spot checks weekly for the first month

## 9. Docs and cleanup

- [ ] 9.1 Write `docs/features/entity-about.md` and link it from `CLAUDE.md`
- [ ] 9.2 Add the Distillery and Brand history rule to `docs/architecture/whisky-identity-model.md`
- [ ] 9.3 Drop `entity_event` after a release with no reads from it
- [ ] 9.4 Trim `docs/research/catalog/2026-10-23-brora-about.md` to sources, traps, and unknowns once Brora's facts are stored
- [ ] 9.5 Run full `pnpm test`, typechecks, and lint
