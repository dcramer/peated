## 1. Contract And Inventory

Implementation rule: every cutover removes its superseded internal
implementation in the same slice. A retained compatibility route may only
translate legacy input/output, delegate to Bottle logic, emit bounded telemetry,
and map to an explicit removal task.

- [x] 1.1 Supersede `add-target-aware-catalog-creation`.
- [x] 1.2 Inventory every `bottle_release`, `releaseId`, BottleGroup,
      CatalogTarget, target id, consumer, route, worker, CLI, web, and documentation
      dependency.
- [x] 1.3 Define stable BottleGroup fields, independently complete Bottle
      fields, observations, and unit-level collection ownership.
- [x] 1.4 Define the unified Bottle creation and edit workflow.
- [x] 1.5 Add read-only migration audit tooling and deterministic local tests.
- [x] 1.6 Report legacy cardinality, invalid pairs, required materialization,
      aliases, images, and promotion collisions.
- [x] 1.7 Establish the direct-Bottle decision: retain legacy parents as
      general/unversioned Bottles, promote releases to Bottles, and make
      BottleGroup non-targetable.
- [x] 1.8 Replace the CatalogTarget proposal, design, and delta specification
      with direct Bottle identity.
- [x] 1.9 Rerun the code inventory and record the exact target-system removal
      map and independently verifiable implementation slices.
- [x] 1.10 Define a fresh retained production audit as a deployment-phase gate
      immediately before migration, not a prerequisite for additive local work.

## 2. Direct Bottle And Group Schema

- [x] 2.1 Add `bottle_group`, representative membership, aggregate fields,
      creator/timestamps, and required tombstone support.
- [x] 2.2 Add Bottle `groupId` and group membership relations.
- [x] 2.3 Add durable BottleRelease-to-Bottle promotion mappings.
- [x] 2.4 Remove `catalog_target` schema, relations, inferred types, indexes,
      constraints, and generated migration state.
- [x] 2.5 Remove consumer `targetId`, `currentTargetId`, and
      `suggestedTargetId` schema additions while preserving direct Bottle foreign
      keys and supported nullable unresolved states.
- [x] 2.6 Define direct-Bottle foreign keys and staged uniqueness activation
      for tastings, collections, Flights, aliases, and other membership surfaces;
      preserve release-aware uniqueness until the one-shot repoint completes.
- [x] 2.7 Generate the revised additive migration with `pnpm db:generate`;
      never hand-write SQL or migration metadata.
- [x] 2.8 Review generated DDL, table locks, indexes, foreign-key order,
      nullability, and rollback feasibility.
- [x] 2.9 Add database-backed tests for Bottle membership, direct consumer
      references, runtime duplicate membership, invalid Bottle ids, last-member
      group protection, and the post-repoint direct-only uniqueness activation.
- [x] 2.10 Update shared fixtures to create Bottle/group graphs without targets.

## 3. Bottle And Group Domain

- [x] 3.1 Simplify canonical independent Bottle creation to atomically create
      only the singleton group, independently complete Bottle, aliases, and audits.
- [x] 3.2 Keep ordinary creation and “add another release” independent; callers
      cannot supply a source group as authority.
- [x] 3.3 Remove public and moderator group selection, merge, and split
      workflows without retaining a dormant regrouping service; automatic
      grouping is a separate future change.
- [x] 3.4 Preserve atomic shared-field fan-out so a group change rematerializes
      complete member Bottles and retains old canonical names as aliases.
- [x] 3.5 Simplify exact Bottle merge so all consumers and promotion mappings
      converge directly on the selected surviving Bottle.
- [x] 3.6 Recompute Bottle statistics from direct Bottle activity and
      BottleGroup statistics from raw member-Bottle activity.
- [x] 3.7 Keep indexing, verification, and other slow post-save work
      idempotent and post-commit.
- [x] 3.8 Add database-backed tests for creation rollback, duplicate conflicts,
      shared fan-out, Bottle merge, representatives, and direct aggregates.

## 4. One-Shot Legacy Migration

- [x] 4.1 Replace target/checkpoint migration writers with one transaction
      owner and one retained read-only pre/post audit boundary.
- [x] 4.2 Lock affected tables in a documented fixed order and rerun collision
      and integrity preflight before the first mutation.
- [x] 4.3 Assign every legacy parent Bottle to one migration-created group and
      retain it as the general/unversioned member.
- [x] 4.4 Promote every BottleRelease into an independently complete Bottle in
      its parent's group and persist a durable release-to-Bottle mapping.
- [x] 4.5 Repoint every release-specific consumer Bottle reference to the
      promoted Bottle while retaining its release id as historical evidence until
      separately approved cleanup.
- [x] 4.6 Preserve every parent-only consumer reference on the retained parent
      Bottle.
- [x] 4.7 Migrate aliases, observations, reviews, collections, Flights, prices,
      decisions, proposals, and attempts using the same direct-Bottle rule without
      invoking runtime side effects.
- [x] 4.8 Assert counts, mappings, Bottle materialization, group membership,
      direct foreign keys, and membership uniqueness before commit.
- [x] 4.9 Remove the external checkpoint state machine, filesystem report lock,
      resumable three-phase orchestrator, target parity runtime, and their tests.
- [x] 4.10 Add integration tests for clean, collision, invalid-pair,
      concurrent-drift, rollback, complete migration, and postflight cases.
- [x] 4.11 Keep the first migration non-destructive: do not drop BottleRelease,
      legacy columns, or permanent redirect evidence.

## 5. Server And API Cutover

- [x] 5.1 Remove CatalogTarget runtime schemas, loaders, resolvers, serializers,
      assignment descriptors, parity readers, and error types.
- [x] 5.2 Make Bottle the response and input identity for creation, aliases,
      observations, tastings, reviews, collections, Flights, prices, proposals,
      decisions, activity, and photo flows.
- [x] 5.3 Update alias propagation and direct consumer writers to validate and
      write one Bottle id atomically without a second resolver.
- [x] 5.4 Update StorePrice ingestion, matching, proposals, attempts, approvals,
      and assignment clearing to one direct Bottle identity tuple.
- [x] 5.5 Update classifier, importers, scraper, CLI mutations, and background
      workers to create or consume independently complete Bottles.
- [x] 5.6 Update cache, revalidation, notification, indexing, and queue payloads
      to Bottle ids; remove generic-target branches.
- [x] 5.7 Update statistics, badges, Library, country/entity/user analytics, and
      activity feeds to Bottle-owned data and member-derived group aggregates.
- [x] 5.8 Keep BottleRelease compatibility routes translation-only over the
      promotion mapping and canonical Bottle services.
- [x] 5.9 Regenerate OpenAPI/client types and remove target-shaped contracts.
- [x] 5.10 Add focused API integration tests for every direct-Bottle consumer,
      nullable unresolved state, promotion mapping, authorization, pagination, and
      conflict behavior.

## 6. Unified Web Workflow

- [x] 6.1 Use one Bottle form for stable and exact fields.
- [x] 6.2 Make `/bottles/new` and “add another release” create independent
      Bottles without manual group selection.
- [x] 6.3 Replace target selectors and exact/generic discriminated rendering
      with Bottle selection and Bottle summaries.
- [x] 6.4 Keep `/bottles/:id/releases` as a related-release page and remove
      group activity actions plus manual group merge/split controls.
- [x] 6.5 Update tasting, Library, collection, Flight, price, review, photo, and
      return-intent flows to carry Bottle ids.
- [x] 6.6 Keep nested BottleRelease pages removed and permanent redirects
      active.
- [x] 6.7 Remove obsolete target components, helpers, tests, and copy.
- [x] 6.8 Add focused web tests for Add Bottle, edit Bottle, add another
      release, direct Bottle selection, related releases, redirects, and return
      intents.
- [x] 6.9 Run constrained desktop/mobile visual QA using the local playbook.

## 7. Cleanup, Documentation, And Local Verification

- [x] 7.1 Rerun the legacy and target inventory; remove obsolete helpers,
      schemas, types, routes, workers, forms, comments, tests, and abstractions.
- [x] 7.2 Rewrite identity, schema, Bottle entry, photo tasting, price matching,
      rating, and migration docs for direct Bottle references and non-targetable
      groups.
- [x] 7.3 Validate OpenSpec and generated migration history.
- [x] 7.4 Run focused schema, migration, service, route, serializer, worker,
      classifier, and repair tests.
- [x] 7.5 Run server/web typechecks and file-scoped lint/format checks.
- [x] 7.6 Run classifier tests and evals in automatic recording/replay mode
      only when classifier identity contracts change.
- [x] 7.7 Run focused web Vitest and constrained end-to-end coverage.
- [x] 7.8 Manually review the full diff for UX, architecture, type safety,
      duplicate business logic, and unexpected file-tree growth.
- [x] 7.9 Remove BottleGroup-owned exact editorial presentation and its manual
      writer; use the representative Bottle for relationship presentation.
- [x] 7.10 Simplify the durable BottleRelease promotion record to committed
      release-to-Bottle identity without checkpoint lifecycle state.
- [x] 7.11 Remove BottleGroup tombstones and retired-group branches; preserve
      user-facing retirement through canonical Bottle tombstones.
- [x] 7.12 Regenerate the unreleased additive migration history from the
      corrected schema and rerun focused schema, migration, API, and web
      verification.
- [x] 7.13 Consolidate the canonical Bottle creation module and correct
      similar-Bottle labels and legacy redirect delegation found in final
      runtime review.
- [x] 7.14 Remove stale BottleGroup editorial and retirement assertions exposed
      by the full CI server shards.
- [x] 7.15 Correct production preflight false positives for Bottle-owned exact
      fields and same-family aliases, and make the retained-audit CLI
      self-contained.
- [x] 7.16 Group literal same-name legacy parents deterministically without
      merging Bottle identities or creating ambiguous canonical aliases.

## 8. Production Migration And Later Destructive Cleanup

- [ ] 8.1 Immediately before production migration, run and retain a fresh
      read-only audit from the exact candidate Git and database revisions,
      reconcile every count, and obtain explicit approval.
- [ ] 8.2 Take and verify a production database backup.
- [ ] 8.3 Ensure old application and worker processes cannot write legacy-only
      release references after the transaction commits.
- [ ] 8.4 Run the approved one-shot transaction and retain the postflight audit.
- [ ] 8.5 Validate counts, mappings, direct Bottle references, aggregates,
      redirects, queue health, latency, and major user workflows; then generate,
      review, and apply the non-destructive direct-only uniqueness activation
      before accepting new catalog-consumer traffic.
- [ ] 8.6 Observe compatibility traffic and disable BottleRelease writes with
      explicit replacement responses.
- [ ] 8.7 Only after separate backup and explicit approval, generate and apply
      cleanup that removes BottleRelease tables/columns, release-specific runtime,
      migration-only writers, and compatibility branches while retaining permanent
      redirect mappings and read-only audit support.
- [ ] 8.8 Run and retain the final zero-legacy audit and full repository test
      gate before cleanup release.
