# Entity Classifier

This document defines the boundary for reviewed entity decisioning.

The implementation lives in:

- `packages/entity-classifier/src/classifierRuntime.ts`
- `packages/entity-classifier/src/classifierTypes.ts`
- `packages/entity-classifier/src/contract.ts`
- `packages/entity-classifier/src/instructions.ts`

Server composition lives in:

- `apps/server/src/agents/entityClassifier/service.ts`

Suspect-row discovery is separate and remains server-owned:

- `apps/server/src/lib/entityAuditCandidates.ts`
- `apps/server/src/orpc/routes/entities/audit-candidates.ts`

## Goal

The classifier should be the only module that turns one suspect entity reference
into a reviewed decision.

It owns:

1. structured classifier input and output schemas
2. local sibling-entity lookup tools
3. optional web-search-backed reasoning
4. reviewed verdict selection
5. structured remediation output

It does not own queue discovery, ranking, or bulk repair application.

## Queue Versus Classifier

There are two separate concepts:

1. `Entity audit/review queue`
   This is moderator-facing discovery of suspicious entity rows.

2. `Entity classifier`
   This is the reviewed decision engine that evaluates one queued entity and
   returns the safest corrective action.

The queue may stay named `audit` in admin surfaces because it is a review
workflow. The underlying engine is a classifier because it is producing a typed
identity/remediation decision, not merely surfacing suspicion.

## Public Contract

The classifier entrypoint is:

- `classifyEntity({ reference })`

`reference` is a server-assembled snapshot containing:

- current entity record
- suspicion reasons
- sample bottles
- candidate target entities

The classifier returns:

- `decision`
- `artifacts`

`decision` contains the reviewed action:

- `reassign_bottles_to_existing_brand`
- `fix_entity_metadata`
- `possible_duplicate_entity`
- `generic_or_invalid_brand_row`
- `manual_review`
- `keep_as_is`

`artifacts` contains supporting resolution data such as:

- resolved local entity matches
- web-search evidence

## Invariants

- Queue discovery should not decide the fix.
- The classifier should operate on one explicit reference at a time.
- Local entity search should be preferred before web search.
- Web evidence should support a decision, not invent one.
- Bottle reassignment should only include verified bottle ids.
- Metadata repair should require authoritative support.
- Brand/entity remediation must distinguish label brand from distillery, owner, bottler, importer, and product/category wording.
- `fullName` and aliases are weak evidence for reassignment because they may contain stale brand text or source-specific prefixes.
- Deterministic grouped repairs should only surface zero-ambiguity moves whose after-state is valid; product-suffix expansions and reversible brand moves belong in classifier or manual review.

## Admin Flow

The current admin workflow is:

1. discover suspicious entities with `audit-candidates`
2. run `classify` for one entity
3. optionally apply verified grouped bottle repairs

That split is intentional. Discovery and decisioning should remain decoupled.
