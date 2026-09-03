## 1. Migration Safety And Schema

- [x] 1.1 Add a retained read-only reference preflight report with counts and deterministic fingerprints for names, assignments, ignored state, provenance, actors, canonical coverage, and collisions.
- [x] 1.2 Add integration tests for preflight output against assigned, unresolved, ignored, canonical, duplicate-normalization, and retired-Bottle fixtures.
- [x] 1.3 Rename the existing schema model to BottleReference, add a stable primary key, retain nullable historical review fields for migration compatibility, and define the new BottleAlias table with per-Bottle normalized uniqueness.
- [x] 1.4 Generate the database migration with `pnpm db:generate`; verify that it preserves every existing reference field and creates no display aliases.
- [x] 1.5 Add the matching postflight report and tests that fail on count or reference-identity drift.

## 2. BottleReference Hard Cutover

- [x] 2.1 Rename BottleAlias resolver, reservation, assignment, conflict, and propagation types and functions to BottleReference without changing exact-match behavior.
- [x] 2.2 Cut accepted source assignment, SMWS rename preservation, merges, and deletion over to BottleReference while preserving structured Bottle title invariants.
- [x] 2.3 Cut StorePrice ingestion, price proposals, external-review ingestion, classifier resolution, repair flows, and consumer synchronization over to BottleReference.
- [x] 2.4 Rename reference embedding and change jobs, job payloads, CLI indexing commands, fixtures, and telemetry events; prove no internal reference consumer still imports the BottleAlias domain.
- [x] 2.5 Replace the public internal-alias routes with authorized BottleReference list, assignment, and management contracts and update all web and CLI callers.
- [x] 2.6 Update integration tests for exact resolution, structured title reuse, source propagation, indexing, concurrent changes, merges, and route authorization under BottleReference terminology.

## 3. Customer-Facing BottleAlias Ownership

- [x] 3.1 Add a BottleAlias service that validates an active Bottle, rejects its current canonical name, enforces per-Bottle normalized uniqueness, and records the acting moderator.
- [x] 3.2 Add public alias reads and moderator-only create/delete contracts without calling BottleReference assignment or consumer propagation.
- [x] 3.3 Add BottleAlias merge and Bottle lifecycle handling that moves aliases to the survivor and deduplicates equivalent target names.
- [x] 3.4 Add integration tests for authorization, duplicate handling, shared names on different Bottles, canonical-name rejection, independent reference behavior, merges, and tombstones.

## 4. Bottle Details And Search

- [x] 4.1 Extend Bottle details with aliases sorted by name while keeping Bottle list responses free of alias hydration.
- [x] 4.2 Include BottleAliases in Bottle search vectors as name evidence without adding them to exact ingestion resolution.
- [x] 4.3 Refresh Bottle search indexes after alias create, delete, and merge operations.
- [x] 4.4 Add backend tests for Bottle detail aliases, tombstone resolution, alias search discovery, and the separation from exact reference matching.

## 5. Bottle Page Presentation

- [x] 5.1 Show verified aliases under the plain label “Also known as” on Bottle details and omit the section when the list is empty.
- [x] 5.2 Add moderator alias management from the Bottle context without exposing BottleReference state to public users.
- [x] 5.3 Add focused browser QA for Bottle aliases on desktop and mobile, including no-alias, multiple-alias, duplicate-name, and tombstone cases.

## 6. Documentation, Validation, And Rollout

- [x] 6.1 Update Bottle identity, normalization, creation, matching, API, and feature documentation to use BottleAlias only for marketed alternate names and BottleReference for exact resolution.
- [x] 6.2 Reconcile the active `flatten-bottlings-into-bottles` artifacts and tests that currently require previous canonical names or source strings to remain exact aliases.
- [x] 6.3 Run the smallest relevant backend and frontend tests, server and web typechecks, lint, formatting, OpenSpec validation, and a final `rg` audit for stale domain terminology.
- [x] 6.4 Prepare an explicit production cutover checklist covering preflight, worker pause, migration, postflight, rollback, and worker resume; do not run production mutations without separate authorization.
- [ ] 6.5 After approved deployment, add only a bounded, evidence-backed SMWS alias seed through the moderator-owned operations.
