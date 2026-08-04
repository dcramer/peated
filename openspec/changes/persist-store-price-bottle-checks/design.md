## Context

Store-price matching already runs the shared Bottle reference classifier and stores its primary decision in a store-price match proposal and attempt. The same classifier result can also be stored as a linked `resolve_reference` Bottle check, which retains findings and proposed Bottle operations for moderator review. That persistence is currently guarded by a `generateBottleCheck` option: individual retries set it, while initial ingestion and bulk retries do not.

The linked-check schema, moderation controls, and Incoming Listings presentation already exist. The missing behavior is at the resolver boundary, not in classification or UI.

## Goals / Non-Goals

**Goals:**

- Retain the complete Bottle-check output for every full store-price classifier run.
- Make this invariant owned by the store-price resolver instead of its callers.
- Commit the proposal, attempt, and linked check as one durable transition.
- Preserve the existing separation between the primary price-match decision and supplemental Bottle operations.

**Non-Goals:**

- Run the classifier for deterministic alias matches that currently bypass it.
- Change classifier prompts, schemas, operation approval, or queue presentation.
- Add scraper source identity, reorder image capture, correlate later audits, or migrate other classifier consumers.

## Decisions

### Persist at the resolver boundary

After a full classifier result has produced a store-price proposal and attempt, the resolver will always pass that result to the existing Bottle-check persistence helper. This covers initial ingestion and every retry path because they all converge on the resolver.

The alternative was to set the existing option in every caller. That would leave a continuing footgun: any new caller could silently discard classifier operations. Removing the option makes retention the invariant of the component that owns the classifier run.

### Reuse the linked-check review model

The store-price proposal remains authoritative for selecting or creating the listing's Bottle. The linked check retains classifier findings and supplemental Bottle operations, associates them with the exact match attempt, and continues to render within the existing Incoming Listings row. Operations retain their existing moderator-only approval rules.

Creating a second queue item or translating the primary match decision into a generic Bottle operation would duplicate ownership and create conflicting review paths.

### Commit classifier persistence atomically

The resolver commits the primary proposal, immutable attempt, and linked Bottle check in one transaction. If check validation or persistence fails, that transaction rolls back and the resolver uses its existing error path to record an errored proposal and attempt. Automation starts only after the complete classifier record commits.

The alternative was to retain the previous catch-and-log helper. That would violate the persistence invariant by presenting a successful price-match attempt after silently discarding classifier findings and operations.

## Risks / Trade-offs

- **More Bottle-check rows and proposed operations** → Reuse the existing linked-check UI and moderation gates; no new inbox is introduced.
- **Invalid supplemental evidence can prevent a match proposal from completing** → Record the failure in the existing errored proposal and attempt flow so it can be inspected and retried without partial classifier state.
- **Deterministic alias matches still have no linked classifier check** → Treat this as intentional because no classifier run occurred; separately revisit only if alias matches need auditing.

## Migration Plan

Deploy the resolver transaction and caller type changes together. No data migration or backfill is required. Rollback restores the optional parameter behavior; checks created while the change is active remain valid review records.

## Open Questions

None for the MVP.
