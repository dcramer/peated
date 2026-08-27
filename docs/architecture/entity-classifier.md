# Entity Classifier

This document defines the boundary for reviewed Entity advice.

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

The classifier should be the only module that turns one suspect Entity reference
into reviewed identity advice.

It owns:

1. structured classifier input and output schemas
2. local sibling-entity lookup tools
3. optional web-search-backed reasoning
4. reviewed advice selection

It does not own queue discovery, ranking, Suggested Changes, Review Operations,
or catalog mutation.

Bottle Review may discover related Entity work while checking one Bottle. In
that workflow it can propose the narrow `update_entity` or `merge_entities`
Suggested Changes. The server prepares each proposal as an independent Review
Operation. Each operation needs moderator approval. This does not turn the
Entity classifier into a sub-agent or merge the two classifier contracts.

## Queue Versus Classifier

There are two separate concepts:

1. `Entity audit/review queue`
   This is moderator-facing discovery of suspicious entity rows.

2. `Entity classifier`
   This evaluates one queued Entity and returns read-only identity advice.

The queue may stay named `audit` in admin surfaces because it is a review
workflow. The underlying engine is a classifier because it returns typed
identity advice, not only a suspicion score.

## Public Contract

The classifier entrypoint is:

- `classifyEntity({ reference })`

`reference` is a server-assembled snapshot containing:

- current Entity record
- suspicion reasons
- sample Bottles
- candidate target Entities

The classifier returns:

- `advice`
- `artifacts`

`advice` contains one reviewed finding:

- `brand_assignment_issue`
- `metadata_issue`
- `possible_duplicate`
- `generic_or_invalid`
- `insufficient_evidence`
- `no_issue`

Advice can identify a known target Entity id. It cannot include Bottle
reassignments, Entity patches, Suggested Changes, or Review Operations.

`artifacts` contains supporting resolution data such as:

- resolved local entity matches
- web-search evidence

## Invariants

- Queue discovery should not decide the fix.
- The classifier should operate on one explicit reference at a time.
- Local Entity search should be preferred before web search.
- Web evidence should support a decision, not invent one.
- Advice must not select Bottle ids or catalog fields to change.
- Metadata advice requires authoritative support.
- Brand and Entity advice must distinguish Brand from distillery, owner, bottler, importer, and product or category text.
- `fullName` and aliases are weak evidence for a Brand assignment issue. They can contain stale Brand text or source-specific prefixes.
- Deterministic grouped repairs should only surface zero-ambiguity moves whose after-state is valid; product-suffix expansions and reversible brand moves belong in classifier or manual review.

## Admin Flow

The current admin workflow is:

1. discover suspicious entities with `audit-candidates`
2. run `classify` for one Entity
3. optionally apply verified grouped bottle repairs

The repair path is separate. It must not infer a mutation from classifier
advice.

## Relationship To Bottle Checks

An Entity classification starts with an Entity as its subject and returns
advice. A Bottle check starts with a Bottle or Bottle Reference. Bottle Review
is the agent path that can return related Entity Suggested Changes. The server
validates them as Review Operations. Do not convert Entity advice into either
object by implication.

Entity-classifier local search requires one Entity kind and returns only that
kind. Bottle relationship resolution can search all kinds because an Entity's
kind does not restrict its Bottle use.

For Bottle checks:

- existing Entity targets must have been inspected;
- every Entity has one canonical kind;
- Bottle relationships do not depend on Entity kind;
- create-versus-existing Entity choices are explicit inside the Bottle
  operation;
- the server builds a live diff and impact preview;
- approval revalidates current state, and asynchronous Entity merge stays
  `applying` until its canonical job reports a terminal result;
- only failed operations can be retried; stale work requires a new check or
  manual correction.
