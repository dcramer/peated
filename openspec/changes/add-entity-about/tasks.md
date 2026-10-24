## 1. About document storage

- [x] 1.1 Add the About schema module with the document schema, `aboutFactFields.ts`, and a `schemaVersion`; put the backward-compatibility rule in a comment beside the schema
- [x] 1.2 Add the `entity_about` table and the `entity_about` change object type; generate the migration
- [x] 1.3 Add read and write functions that parse `unknown`, check the saved version on every write, save the full document to change history, check linked Entities on write, and follow merged Entities on read; integration tests for each
- [x] 1.4 Add a test that parses a sample of real document shapes, so schema changes that break stored documents fail CI
- [x] 1.5 Write `isFactShown` and `getDisagreement` and run them in the public serializer, with tests for unsourced facts and conflicting values
- [x] 1.6 Add moderator API routes to edit events, site facts, sources, and sections in the document, with tests for permissions, stale versions, and the rule that the pipeline never overwrites a person's edit
- [x] 1.7 Backfill a document for each Entity with `entity_event` rows, copying `sourceUrl` into sources and citations; check event counts per Entity
- [x] 1.8 Point Overview history, owner acquisitions, and existing event routes at the document; stop writing `entity_event`
- [x] 1.9 Update `mergeEntity` to leave About documents alone and queue a writer run for the destination, with an integration test
- [x] 1.10 Add a moderator route to hide and show an About page, with tests
- [x] 1.11 Add mock API routes and fixtures for the new routes under `apps/server/src/orpc/mock/`

## 2. Catalog numbers

- [x] 2.1 Add a `vintageYear` filter to `bottles.list` and the Entity Bottles tab, with tests
- [x] 2.2 Add `entities.about.vintages`, `bottlers`, `distillers`, and `releaseYears` routes that count active Bottles the same way as the Bottles tab, with tests
- [x] 2.3 Add caching for the new routes per `docs/architecture/web-caching.md`

## 3. About pages

- [x] 3.1 Add `entities.about.details`, returning published facts, events, sections, sources, and disagreements without quotes, with tests
- [x] 3.2 Move the proof-of-concept widgets onto the API and add display-rule functions with tests for each minimum
- [x] 3.3 Add per-kind templates for distilleries, brands, and distilleries that are also brands
- [x] 3.4 Add the bottler list, distillery list, and disagreement note widgets, each with one Storybook Overview story
- [x] 3.5 Show the About tab only when a lead and one other part exist; test the tab rule
- [x] 3.6 Link chart bars to the filtered Bottle list
- [x] 3.7 Replace the Overview history list with key dates and a link when About exists
- [x] 3.8 Add `BottleEraNote` to Bottle pages for single-distiller Bottles with a vintage, with tests for eras, former names, and no match
- [x] 3.9 Add canonical URLs, sitemap entries, and structured data for About pages per `docs/features/catalog-page-seo.md`
- [x] 3.10 Check desktop and phone layouts in light and dark mode in a browser

## 4. Brora on stored data

- [x] 4.1 Get approval for Brora's production changes under `docs/operations/catalog-maintenance.md`
- [ ] 4.2 Enter Brora's sources, events, eras, names, site facts, status, and sections through `pnpm cli api`; verify each write by reading it back
- [x] 4.3 Delete `apps/web/src/features/entityAbout/articles/brora.ts` and the in-code article map

## 5. Writing rules

- [x] 5.1 Add the banned-phrase list and About style rules to the `peated-writing` skill as a file the code check imports
- [x] 5.2 Write one brand article by hand as the second prompt example, as stored data

## 6. The job

- [x] 6.1 Add `writeEntityAbout`: one model call with the existing web search and page-fetch tools, fixed search and read limits, and output parsed with the document schema
- [x] 6.2 Add the code checks: quotes on pages read, sentence facts, years and numbers, no catalog numbers in prose, length limits, banned phrases, and sentence length; one retry, then save nothing
- [x] 6.3 Merge drafts into the stored document, keeping items a person wrote; save with a version check; update the description from the lead unless a person wrote it
- [x] 6.4 Add the `aboutPipeline` system actor, an on/off switch, and an admin action to queue one Entity or a batch ordered by activity
- [x] 6.5 Stop `generateEntityDetails` from writing descriptions; keep pronunciation and other fields
- [x] 6.6 Add tests for each check, the merge, and the switch
- [ ] 6.7 Add a model check under `pnpm evals` with 5 Entities
- [x] 6.8 Give the writer stored history without a source as leads; a matching draft event adds its citations to the stored event, and unmatched history stays hidden
- [x] 6.9 Add `/admin/catalog/clear-entity-descriptions` to clear generated descriptions that are not the published lead, with a test

## 7. Rollout

- [ ] 7.1 Run the job on 20 Entities and read every result; fix the prompt or checks
- [ ] 7.2 Queue batches by activity
- [ ] 7.3 After every Distillery and Brand has run, clear the generated descriptions still left

## 8. Docs and cleanup

- [x] 8.1 Write `docs/features/entity-about.md` and link it from `CLAUDE.md`
- [x] 8.2 Add the Distillery and Brand history rule to `docs/architecture/whisky-identity-model.md`
- [ ] 8.3 Drop `entity_event` after a release with no reads from it
- [ ] 8.4 Trim `docs/research/catalog/2026-10-23-brora-about.md` to sources, traps, and unknowns once Brora's facts are stored
- [ ] 8.5 Run full `pnpm test`, typechecks, and lint
