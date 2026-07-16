## 1. Contract And Production Inventory

Implementation rule: a cutover task removes the superseded internal
implementation in the same slice. A retained compatibility route must delegate
to the new service, be instrumented, and map to an explicit task in section 9;
it must not preserve a parallel business-logic path.

- [x] 1.1 Mark `add-target-aware-catalog-creation` as superseded so it cannot be implemented alongside this change.
- [x] 1.2 Enumerate every database column, runtime schema, serializer, route, worker, CLI command, classifier contract, web route, and document that reads or writes `releaseId` or `bottle_release`.
- [x] 1.3 Define the field-ownership matrix for BottleGroup stable identity, concrete Bottle identity, observations, and unit-level collection data.
- [x] 1.4 Define versioned runtime schemas for BottleGroup, concrete Bottle, and discriminated CatalogTarget results, deriving exported TypeScript types from those schemas.
- [x] 1.5 Add a read-only catalog migration audit command with JSON and human-readable output.
- [x] 1.6 Report legacy parent counts by zero/one/multiple releases, parent release-like fields, child/parent age conflicts, invalid parent-release pairs, missing creators, and missing aliases/images.
- [x] 1.7 Report full-name and alias collisions that would occur when BottleReleases are promoted into the Bottle namespace.
- [x] 1.8 Report paired-reference counts and invalid references for tastings, reviews, collections, flights, prices, aliases, observations, decision logs, and proposals.
- [x] 1.9 Add deterministic audit tests covering clean, conflicting, missing, and already-mapped fixtures.
- [x] 1.10 Define the production audit as a deployment-phase freshness gate tracked by tasks 6.11, 6.13, 9.1, and 10.9 rather than a prerequisite for additive local implementation.

## 2. Additive Group And Target Schema

- [x] 2.1 Add `bottle_group` with stable identity, representative Bottle, aggregate fields, creator, timestamps, and group-tombstone support.
- [x] 2.2 Add nullable `groupId` membership to Bottle plus the uniqueness needed to enforce a target's `(bottleId, groupId)` relationship.
- [x] 2.3 Add `catalog_target` with one generic target per group, one exact target per Bottle, and database-enforced membership consistency.
- [x] 2.4 Add a durable, unique legacy BottleRelease-to-Bottle promotion mapping with migration status and audit metadata.
- [x] 2.5 Add nullable `targetId` foreign keys and indexes to every activity-bearing table while retaining legacy `bottleId`/`releaseId` columns.
- [x] 2.6 Add Drizzle relations and inferred types for groups, memberships, targets, mappings, and target-bearing consumers.
- [x] 2.7 Generate the additive migration with `pnpm db:generate`; do not hand-write SQL or edit migration metadata.
- [x] 2.8 Review the generated migration for lock duration, index creation, nullability, foreign-key order, and rollback feasibility.
- [ ] 2.9 Add database-backed constraint tests for singleton group targets, exact Bottle targets, duplicate targets, cross-group mismatches, and last-member protection.
- [x] 2.10 Update shared test fixtures to create valid group/Bottle/target graphs while retaining explicit legacy fixtures for migration tests.

## 3. Catalog Target Runtime

- [x] 3.1 Implement a target loader that fetches a generic group target or exact Bottle target and returns the discriminated runtime-owned schema.
- [x] 3.2 Implement target lookup by exact `bottleId`, generic `groupId`, and legacy `(bottleId, releaseId)` during compatibility.
- [x] 3.3 Return distinct not-found, retired-target, invalid-mapping, and integrity-mismatch errors without substituting a representative Bottle.
- [x] 3.4 Add serializers for BottleGroup summaries, exact Bottle results, and CatalogTarget results with explicit actor/permission context.
- [x] 3.5 Add integration tests for exact, generic, retired, missing, mismatched, and legacy-mapped target loading.
- [x] 3.6 Add a deterministic target-assignment helper used by all dual-write consumers instead of rebuilding target logic per route.
- [x] 3.7 Instrument legacy target resolution and writes with operation and caller context so compatibility removal can be measured.
- [x] 3.8 Add target-aware unique constraints or conflict handling for collections, flights, aliases, and other set-membership tables.

## 4. Automatic Bottle And Group Domain Services

- [x] 4.1 Implement transactional independent Bottle creation that creates a singleton group, generic target, Bottle, exact target, aliases, and change records atomically.
- [x] 4.2 Implement “create another release” using a trusted source Bottle to reuse its group while creating only a new Bottle and exact target.
- [x] 4.3 Prevent arbitrary client-supplied group ids from bypassing trusted group-reuse authorization.
- [x] 4.4 Apply exact duplicate detection to Bottle identity while returning likely group matches as non-blocking suggestions.
- [x] 4.5 Keep catalog verification, indexing, and other slow post-save work idempotent and outside the committed request path.
- [x] 4.6 Implement moderator-authorized Bottle updates: exact-only edits affect only the selected Bottle; shared edits atomically update the BottleGroup and every member's complete durable identity; effective-age normalization preserves only non-null exact overrides differing from the pre-update current group age, with exact null materializing the resulting group age; old canonical exact names remain exact aliases; collisions roll back all changes; one existing `bottle` update audit row is written per affected member with a combined row for the selected member in a mixed edit; no `bottle_group` audit enum is added; ids, targets, representative selection, activity, and Bottle/BottleGroup activity and rating aggregates remain unchanged; and shared series fan-out or drift repair recomputes only affected old and new BottleSeries `numReleases` membership counts.
- [x] 4.7 Implement an explicit moderator one-source-to-one-destination group merge: destination shared identity atomically rematerializes moved Bottles while preserving exact Bottle/target ids and old canonical exact aliases; source-generic consumers and stable aliases repoint before source target/group retirement behind the existing tombstone support; destination collection rows win with blank-image fill, flight duplicates collapse, and tasting/identity/alias/SMWS ambiguity rolls back; identical retries are unchanged while other destinations conflict; generated audit and membership-constraint changes support `bottle_group` snapshots plus reversible per-Bottle audits and source-row removal; and the shared raw-target BottleGroup aggregate helper is brought forward without completing task 4.11.
- [x] 4.8 Implement an audited group split transaction that moves selected Bottles and keeps ambiguous generic activity on the source group by default.
- [x] 4.9 Implement exact Bottle merge independently from group merge and handle cross-group exact duplicates deliberately.
- [x] 4.10 Implement representative-Bottle selection and group editorial-content ownership without mutating member Bottle content.
- [ ] 4.11 Complete idempotent exact Bottle recomputation plus the remaining reusable BottleGroup statistics job/service entry points, reusing the raw-target group aggregate helper introduced by task 4.7 without double counting.
- [ ] 4.12 Add database-backed service tests for creation rollback, retries, duplicate conflicts, trusted reuse, exact-only update isolation, effective-age normalization, shared-update fan-out, per-member audit cardinality, collision rollback, merge, split, representative selection, deletion, and aggregate counts.

## 5. New-Write API Cutover

- [ ] 5.1 Change the standard Bottle create route to accept stable and exact fields and return the created concrete Bottle plus its target/group summary.
- [ ] 5.2 Add an authenticated “another release” Bottle create operation with explicit source Bottle context and a unique OpenAPI operation id.
- [ ] 5.3 Change Bottle update and moderator proposal flows so exact edits persist only on the selected Bottle and shared edits use the atomic BottleGroup-to-member materialization service.
- [ ] 5.4 Convert BottleRelease create/update/delete routes into instrumented compatibility adapters over concrete Bottle operations.
- [ ] 5.5 Update aliases and observations so new writes reference one target and exact aliases resolve directly to a Bottle.
- [ ] 5.6 Update tasting, review, collection, flight, and price mutations to dual-write `targetId` from exact or generic intent.
- [ ] 5.7 Update store-price matching, match proposals, and decision logs to emit `create_bottle` or group-aware match decisions instead of create-release decisions.
- [ ] 5.8 Update classifier application and repair services to create concrete Bottles and automatic groups while retaining source evidence.
- [ ] 5.9 Update worker jobs, importers, and CLI mutations so no supported new-write path inserts `bottle_release` directly.
- [ ] 5.10 Add route and service integration tests for authentication, exact creation, singleton grouping, another-release grouping, conflicts, generic targets, and adapter behavior.
- [ ] 5.11 Regenerate and inspect OpenAPI/client types and remove new compile-time dependencies on `BottleRelease` from cut-over callers.

## 6. Resumable Legacy Backfill

- [ ] 6.1 Implement idempotent batched creation of one BottleGroup and generic target for every legacy parent Bottle.
- [ ] 6.2 Assign parents with no releases to their singleton groups and create their exact targets without changing existing Bottle ids.
- [ ] 6.3 Promote each legacy BottleRelease into a new concrete Bottle by combining stable parent fields with release-owned fields.
- [ ] 6.4 Persist release-to-Bottle mappings before migrating dependents and make reruns reuse completed promotions.
- [ ] 6.5 Copy or re-home distillers, series, tags, flavor profiles, descriptions, images, suggested tags, creators, aliases, and observations according to the ownership matrix, leaving every promoted Bottle with a complete durable exact record.
- [ ] 6.6 Stop and report rather than invent data when promoted names/aliases collide or parent release-like fields remain ambiguous.
- [ ] 6.7 Backfill non-null legacy release references to the promoted Bottle's exact target across every consumer table.
- [ ] 6.8 Backfill null-release references under parents with releases to the BottleGroup generic target.
- [ ] 6.9 Backfill null-release references under parents without releases to the retained Bottle exact target.
- [ ] 6.10 Backfill parent-only aliases under split parents to group targets and release aliases to promoted Bottle targets.
- [ ] 6.11 Add batch checkpoints, progress metrics, retry-safe errors, bounded transactions, and dry-run mode to the backfill command; retained reports identify the deployed Git revision and database migration revision in addition to the generated timestamp and database name.
- [ ] 6.12 Add migration integration tests proving row counts, idempotency, field ownership, mappings, exact/generic target rules, aliases, and interruption recovery.
- [ ] 6.13 After the additive schema and backfill tooling are deployed, run and retain a fresh production dry-run from that deployed revision, reconcile every audit count, and require explicit approval before the live run.

## 7. Read Parity And Backend Cutover

- [ ] 7.1 Add dual-read parity assertions comparing legacy resolution with CatalogTarget resolution for every target-bearing serializer and route.
- [ ] 7.2 Record actionable parity mismatches with consumer table, row id, legacy ids, target id, and resolved identities.
- [ ] 7.3 Switch tastings, reviews, collections, flights, prices, aliases, observations, decisions, proposals, and activity feeds to target-backed reads.
- [ ] 7.4 Switch Bottle list/details/search serializers to independently complete concrete Bottles without group hydration and include optional group summaries without release-shaped nesting.
- [ ] 7.5 Index promoted and new Bottles in the ordinary Bottle search index and remove release-only search indexing.
- [ ] 7.6 Add BottleGroup details/list APIs for generic targets, related releases, aggregate stats, aliases, and moderator actions.
- [ ] 7.7 Update exact and group statistics jobs to read raw target activity and verify aggregate parity with legacy totals.
- [ ] 7.8 Add permanent legacy nested-bottling redirects to promoted Bottle URLs.
- [ ] 7.9 Add retired-parent redirects to BottleGroup pages without choosing the representative Bottle as the activity target.
- [ ] 7.10 Update cache keys, revalidation, queue payloads, and activity payloads to use exact Bottle or CatalogTarget identity consistently.
- [ ] 7.11 Add backend integration tests covering every consumer's exact target, generic target, promoted release, redirect, pagination, and authorization behavior.

## 8. Unified Web Workflow

- [ ] 8.1 Merge the existing BottleForm and ReleaseForm field ownership into one reusable concrete Bottle add/edit form.
- [ ] 8.2 Make `/bottles/new` accept all exact fields and always submit one Bottle creation mutation.
- [ ] 8.3 Replace Add Bottling with “Add another release,” prefilled from an existing Bottle and backed by the trusted reuse operation.
- [ ] 8.4 Remove the Bottle-versus-Bottling choice, hidden release-detail mode, and any query-prefill behavior that changes entity type.
- [ ] 8.5 Update search results and Bottle pages to show exact Bottle details with an unobtrusive related-releases/group link.
- [ ] 8.6 Add a BottleGroup page for generic activity, aggregates, related Bottles, and moderator merge/split controls.
- [ ] 8.7 Update tasting, Library, collection, flight, price, review, and photo-identification flows to carry one `targetId` and display whether exactness is known.
- [ ] 8.8 Update return intents and post-create image uploads to use the created concrete Bottle without reconstructing a release pair.
- [ ] 8.9 Remove nested Bottling edit/detail/list UI after redirects and compatibility coverage are active.
- [ ] 8.10 Add focused web tests for unified form fields, singleton creation, another release, exact/generic target selection, redirects, and return intents.
- [ ] 8.11 Verify Add Bottle, edit Bottle, add another release, group details, Library, and tasting flows at desktop and mobile widths using the local verification playbook.

## 9. Constraint Cutover And Legacy Removal

- [ ] 9.1 Require a completed production audit, zero target nulls/mismatches, complete release mappings, rebuilt indexes, and zero supported legacy write traffic before constraint cutover.
- [ ] 9.2 Generate a migration making Bottle `groupId` and consumer `targetId` references non-null where the domain requires them.
- [ ] 9.3 Deploy the constraint migration separately and verify write latency, foreign-key failures, queue health, and target parity.
- [ ] 9.4 Disable BottleRelease writes with an explicit gone/replacement response while retaining measured read compatibility.
- [ ] 9.5 Observe the agreed legacy read window and verify old nested URLs and API references resolve only through mappings.
- [ ] 9.6 Remove `releaseId` columns, release foreign keys/indexes, and `bottle_release` using a generated Drizzle migration only after backup approval.
- [ ] 9.7 Remove BottleRelease routes, schemas, serializers, workers, forms, repair paths, enums, and compatibility branches.
- [ ] 9.8 Remove retired legacy parent Bottle rows only after every reference and URL has a durable group or Bottle mapping.
- [ ] 9.9 Remove runtime dependence on BottleGroup hydration for exact Bottle rendering and verify all creation, shared-update, merge, split, and repair writers preserve complete durable Bottle materialization and atomic fan-out.
- [ ] 9.10 Run the final audit and assert zero legacy tables/columns/runtime references except intentional permanent redirect mappings, plus zero incomplete Bottle materializations or group/member synchronization defects.

## 10. Documentation And Final Verification

- [ ] 10.1 Rewrite `docs/architecture/whisky-identity-model.md` around concrete Bottle, automatic BottleGroup, BottleSeries, CatalogTarget, and Observation identities.
- [ ] 10.2 Update schema conventions to remove the single-known-release rule and define shared BottleGroup editing semantics versus complete durable exact-Bottle materialization.
- [ ] 10.3 Update bottle-entry, photo-tasting, store-price-matching, and rating documentation for unified Bottle creation and generic group targets.
- [ ] 10.4 Add any new migration/runbook documentation to the root `AGENTS.md` docs index.
- [ ] 10.5 Run targeted migration, schema, service, route, serializer, worker, classifier, and repair tests after each backend slice.
- [ ] 10.6 Run server and web package typechecks plus file-scoped lint/format checks for every touched slice.
- [ ] 10.7 Run classifier tests and replay/live evals when identity output or decision contracts change, committing required recordings.
- [ ] 10.8 Run focused web Vitest and Playwright coverage for the changed form, route, redirect, and target workflows.
- [ ] 10.9 Run the full repository test gate and production migration audit before the cleanup release.
- [ ] 10.10 Record post-deploy counts for Bottles, groups, exact/generic targets, legacy redirects, unmapped references, and aggregate parity.
