## 1. Migration Safety And Schema

- [x] 1.1 Add a retained read-only reference preflight report with counts and deterministic fingerprints for names, assignments, ignored state, provenance, actors, canonical coverage, and collisions.
- [x] 1.2 Add integration tests for preflight output against assigned, unresolved, ignored, canonical, duplicate-normalization, and retired-Bottle fixtures.
- [x] 1.3 Rename the existing schema model to BottleReference, add a stable primary key and nullable review actor/time fields, and define the new BottleAlias table with per-Bottle normalized uniqueness.
- [x] 1.4 Generate the database migration with `pnpm db:generate`; verify that it preserves every existing reference field and creates no display aliases.
- [x] 1.5 Add the matching postflight report and tests that fail on count or reference-identity drift.

## 2. BottleReference Hard Cutover

- [x] 2.1 Rename BottleAlias resolver, reservation, assignment, conflict, and propagation types and functions to BottleReference without changing exact-match behavior.
- [x] 2.2 Cut accepted source assignment, SMWS rename preservation, merges, and deletion over to BottleReference while preserving structured Bottle title invariants.
- [x] 2.3 Cut StorePrice ingestion, price proposals, external-review ingestion, classifier resolution, repair flows, and consumer synchronization over to BottleReference.
- [x] 2.4 Rename reference embedding and change jobs, job payloads, CLI indexing commands, fixtures, and telemetry events; prove no internal reference consumer still imports the BottleAlias domain.
- [x] 2.5 Replace the public internal-alias routes with authorized BottleReference list, assignment, and management contracts and update all web and CLI callers.
- [x] 2.6 Update integration tests for exact resolution, structured title reuse, source propagation, indexing, concurrent changes, merges, and route authorization under BottleReference terminology.

## 3. Reference Review And Quarantine

- [x] 3.1 Add BottleReference review operations that verify or quarantine one state-token-protected reference and record the moderator and review time.
- [x] 3.2 Make quarantine clear reference embeddings and refresh affected reference and Bottle indexes without clearing or retargeting existing consumers.
- [x] 3.3 Add authorized review and quarantine routes with conflict responses for stale assignment, ignored state, provenance, or review state.
- [x] 3.4 Add integration tests proving verified references keep matching, quarantined references stop matching, and historical prices and reviews remain assigned.

## 4. Customer-Facing BottleAlias Ownership

- [x] 4.1 Add a BottleAlias service that validates an active Bottle, rejects its current canonical name, enforces per-Bottle normalized uniqueness, and records the acting moderator.
- [x] 4.2 Add public alias reads and moderator-only create/delete contracts without calling BottleReference assignment or consumer propagation.
- [x] 4.3 Add BottleAlias merge and Bottle lifecycle handling that moves aliases to the survivor and deduplicates equivalent target names.
- [x] 4.4 Add integration tests for authorization, duplicate handling, shared names on different Bottles, canonical-name rejection, independent reference behavior, merges, and tombstones.

## 5. Bottle Details And Search

- [x] 5.1 Extend Bottle details with aliases sorted by name while keeping Bottle list responses free of alias hydration.
- [x] 5.2 Include BottleAliases in Bottle search vectors as name evidence without adding them to exact ingestion resolution.
- [x] 5.3 Refresh Bottle search indexes after alias create, delete, merge, and quarantine operations.
- [x] 5.4 Add backend tests for Bottle detail aliases, tombstone resolution, alias search discovery, and the separation from exact reference matching.

## 6. Deterministic Reference Audit

- [x] 6.1 Implement tested deterministic signal functions for SMWS-code conflicts, explicit age/year/ABV/edition/cask conflicts, normalized overlap, generic prefixes, and sibling ambiguity.
- [x] 6.2 Build a paginated administrator-only audit read model for active assigned noncanonical references with target identity, group context, provenance, review state, signals, and bounded matching consumer impact.
- [x] 6.3 Add audit filters for review state and signal, stable ordering, and state tokens suitable for reference review mutations.
- [x] 6.4 Add integration tests proving the audit reports evidence without mutating references, Bottles, prices, or reviews.
- [x] 6.5 Add a lightweight admin reference-audit page with actions to keep exact resolution, quarantine the reference, and independently add or remove a displayed alias.
- [x] 6.6 Add focused browser QA for audit filtering, impact disclosure, stale-state errors, independent alias/reference decisions, and successful navigation after review.

## 7. Bottle Page Presentation

- [x] 7.1 Show verified aliases under the plain label “Also known as” on Bottle details and omit the section when the list is empty.
- [x] 7.2 Add moderator alias management from the Bottle context without exposing BottleReference state to public users.
- [x] 7.3 Add focused browser QA for Bottle aliases on desktop and mobile, including no-alias, multiple-alias, duplicate-name, and tombstone cases.

## 8. Documentation, Validation, And Rollout

- [x] 8.1 Update Bottle identity, normalization, creation, matching, API, and feature documentation to use BottleAlias only for marketed alternate names and BottleReference for exact resolution.
- [x] 8.2 Reconcile the active `flatten-bottlings-into-bottles` artifacts and tests that currently require previous canonical names or source strings to remain exact aliases.
- [x] 8.3 Run the smallest relevant backend and frontend tests, server and web typechecks, lint, formatting, OpenSpec validation, and a final `rg` audit for stale domain terminology.
- [x] 8.4 Prepare an explicit production cutover checklist covering preflight, worker pause, migration, postflight, rollback, and worker resume; do not run production mutations without separate authorization.
- [ ] 8.5 After approved deployment, review the highest-risk generic references first and add only a bounded, evidence-backed SMWS alias seed through the moderator-owned operations.
