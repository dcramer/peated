# Bottle Creation And Alias System

This document defines the live target architecture for creating and resolving
Bottle identity across manual entry, scraped sources, reviews, prices, photos,
classifier workflows, and backfills.

The central principle is that every marketed version is one independently
complete Bottle. Raw source input is evidence, not canonical identity. Cheap
deterministic checks may reuse an already accepted identity, while semantic
normalization remains evidence-reviewed.

Related architecture:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Normalization Contract](./bottle-normalization-contract.md)
- [Bottle Classifier](./bottle-classifier.md)

## Goals

- Create, match, search, render, and edit one complete Bottle without hydrating
  its BottleGroup.
- Reuse exact accepted aliases without paying for a classifier call.
- Use reviewed classifier evidence when no accepted prior decision exists.
- Keep deterministic code limited to safe structural checks, exact accepted
  aliases, and closed-form resolvers.
- Preserve observation-only source facts without silently promoting them into
  canonical Bottle identity.
- Keep every assignment and automated create decision auditable.
- Assign BottleGroups automatically rather than asking a classifier, user, or
  normalization helper to select one.

## Non-Goals

- Do not recreate Bottle-versus-Bottling or parent-versus-release decisions.
- Do not expose create-release, repair-parent, or classifier-selected group
  actions in the live creation architecture.
- Do not infer semantic identity or grouping from brand prefixes, years, batch
  tokens, cask wording, retailer names, normalized strings, or fuzzy rank alone.
- Do not store generated, normalized, scraped, or unresolved candidate strings
  as aliases unless they have been accepted as assignments.
- Do not make every write path synchronous on the classifier when an exact
  accepted alias or closed-form identifier already proves the target.

## Canonical Model

Peated has four relevant identity layers:

- `Bottle`: one concrete marketed version with a stable expression plus every
  supported structured exact field.
- `BottleGroup`: the automatically managed same-expression aggregate across
  related Bottles. It owns shared editing semantics and a generic target, but a
  Bottle remains complete and renderable without group hydration.
- `CatalogTarget`: the authoritative subject id for an exact Bottle or a generic
  BottleGroup when exactness is unknown.
- `BottleObservation`: source facts useful as evidence but outside canonical
  catalog identity.

Every Bottle has one exact CatalogTarget. Every BottleGroup has one generic
CatalogTarget. Consumers store one validated `targetId`; they do not construct
an independent Bottle/group pair or a Bottle/Release pair.

### Stable And Exact Bottle Fields

The Bottle name stores the stable marketed expression relative to its brand.
Structured exact-Bottle fields store edition, release year, vintage year,
effective stated age, ABV, single-cask and cask-strength flags, and canonical
cask traits. Canonical creation materializes those values into the Bottle's
complete display name without duplicating exact markers.

A Bottle is the durable exact record. Shared BottleGroup values are copied into
every member Bottle so exact reads remain independently correct. A shared group
edit atomically regenerates every member from the new shared values and that
member's preserved exact fields; it is not runtime inheritance.

Facts that identify only a source listing or physical unit remain observations,
including retailer selectors, URLs, listing images, bottle numbers, outturn, and
unreviewed label fragments. A fact becomes canonical only when reliable evidence
establishes that it identifies the marketed Bottle.

### Automatic Group Assignment

Independent Bottle creation atomically creates a singleton BottleGroup, its
generic target, the Bottle, and its exact target. Trusted existing-member,
migration, or curated context may reuse a known group. Classifier output never
contains a parent or group selection, and clients cannot supply an arbitrary
group id to bypass that boundary.

Likely same-expression matches may be suggestions. Similar names, shared brand,
or shared series do not silently merge independently created groups. Curated
group merge and split operations are separate audited catalog operations.

## Alias Model

An alias is a durable assertion:

> This accepted reference string resolves to this CatalogTarget.

An exact accepted alias can bypass the classifier because the system is reusing
a prior decision, not guessing from text. Candidate evidence, generated
normalization output, and unresolved source text are not aliases.

- An exact marketed alias references an exact Bottle target.
- A stable expression alias references a generic BottleGroup target.
- A generic alias never substitutes the representative or another member
  Bottle during exact lookup.
- An ignored alias does not participate in exact matching.
- Assignment provenance records whether the assertion came from canonical
  creation, an accepted source, classifier review, or human review.

Alias lookup and alias writes use the same identity-preserving key for a
workflow. Lossy or semantic normalization may retrieve evidence but cannot
assign a target unless that exact key was already accepted.

Canonical Bottle creation reserves the Bottle's exact canonical alias in the
same transaction. Alias conflicts block creation or require an explicit merge;
code does not overwrite, suffix, or reinterpret another target's assertion.

## Resolution Pipeline

All source-reference workflows follow the same conceptual pipeline:

1. Preserve raw source facts.
2. Build the workflow's identity-preserving alias key.
3. Reuse an exact accepted alias when it resolves one valid target.
4. Apply a closed-form deterministic resolver when one exists, such as an exact
   SMWS code.
5. Retrieve local Bottle and entity candidates.
6. Run reviewed classification when semantic identity remains unresolved.
7. Validate candidate ids, resolved entities, canonical fields, and target
   integrity.
8. Derive the automation tier from action risk and structured evidence.
9. Persist the exact target, queue review, or leave the source unresolved.

Candidate retrieval is evidence, not a decision. Text rank, fuzzy aliases,
similar names, sibling rows, and web results cannot independently select a
target or BottleGroup.

## Classifier Ownership

The classifier decides:

- whether the source matches an existing complete Bottle;
- whether an existing Bottle needs a canonical repair;
- whether evidence supports creating one complete Bottle;
- which wording is the stable expression and which facts are structured
  exact-Bottle fields or observations;
- whether brand, distillery, and bottler entities have the correct roles;
- whether a candidate is too broad or too specific; and
- whether available local, label, image, or web evidence is supportive,
  conflicting, or insufficient.

Classifier actions are `match`, `repair_bottle`, `create_bottle`, and
`no_match`. `create_bottle` contains one independently complete Bottle. There is
no live create-release, create-bottle-and-release, repair-parent, or group
selection action.

Deterministic validation may reject unknown ids, direct source-field conflicts,
invalid targets, or impossible states. It must not promote `no_match`, infer
whisky-family semantics, or replace the classifier decision with prefix or
similarity rules.

## Evidence-Derived Automation

Automation does not use a model-authored numeric confidence score, confidence
band, or post-hoc numeric confidence cap. Code derives `auto` versus `review`
from the action's risk and structured evidence, including identity basis,
positive evidence, web-evidence status when applicable, and typed unresolved
risks.

An asserted unresolved risk forces review. No evidence field upgrades a decision
that the derived tier routes to review. Exact accepted aliases and closed-form
identifiers may bypass classifier review because they prove identity directly;
semantic normalized text cannot.

Automation may create or assign only when:

- the raw source is retained;
- the selected Bottle or create draft is independently complete;
- duplicate Bottle, target, and alias checks are safe;
- required entities resolve or can be safely created;
- observation-only detail remains outside canonical identity; and
- the decision and evidence provenance are retained.

Conflicting identity, unsafe alias collisions, unresolved canonical fields, or
an invalid target leave the source unresolved or route it to review.

## Workflow Boundaries

### Manual Entry

The Add Bottle workflow accepts stable expression fields and structured exact
fields in one form and always creates one Bottle. Independent entry receives an
automatic singleton group. A trusted existing-member context may create another
Bottle in that member's group without exposing group selection as ordinary
input.

### Store Prices And Reviews

Store-price and review ingestion preserve the raw reference first. An accepted
alias supplies its validated exact or generic CatalogTarget. Otherwise the row
remains targetless until reviewed resolution succeeds.

A successful classifier match or create supplies one exact Bottle target. A
generic target is used only when the workflow genuinely knows the expression
but not the exact Bottle; it never selects a representative Bottle. Unresolved
source text does not create an unbound alias as candidate storage.

### Observations

Observations preserve exact source facts that remain outside canonical identity,
including source URL, raw title, retailer image, price/volume context, selector,
bottle number, outturn, and unreviewed maturation fragments. They attach through
the same validated exact or generic CatalogTarget when identity is known.

## Staged BottleRelease Compatibility

BottleRelease is not part of live creation. The only retained release-shaped
behavior is measured compatibility for existing data and callers while legacy
rows are promoted:

- classifier search may expose a retained legacy release candidate only to
  match an existing historical identity;
- a completed promotion mapping resolves a legacy `releaseId` to its promoted
  Bottle and exact target;
- retained `(bottleId, releaseId)` projections support dual-write/parity and
  historical responses, but a non-null `targetId` is authoritative;
- compatibility adapters translate legacy input/output and delegate to the
  canonical concrete-Bottle services; they do not insert or update
  `bottle_release`; and
- old nested URLs resolve through retained mappings and redirects.

This compatibility is instrumented and removal-owned. Tasks 7.3 and 9.5 cut
reads over and verify the compatibility window; task 9.6 removes obsolete pair
storage and the `bottle_release` table; task 9.7 removes release routes, schemas,
workers, serializers, and runtime branches. New architecture must not add a
second release business system while those adapters remain.

## Minimum Test Coverage

Deterministic coverage should prove:

- exact accepted aliases resolve one exact or generic target;
- generic aliases do not select a representative Bottle;
- ignored and ambiguous aliases do not resolve;
- alias lookup and write keys are identical for each workflow;
- semantic or lossy normalization does not auto-assign;
- duplicate Bottle, target, and alias conflicts roll back creation;
- independent creation produces a singleton group and exact target atomically;
- target-backed consumer identity cannot be downgraded by a retained legacy
  pair; and
- compatibility resolution is measured and delegates to canonical services.

Classifier and eval coverage should prove:

- one complete `create_bottle` draft with stable and structured exact fields;
- exact candidate matching versus over-broad or over-specific candidates;
- observation-only treatment of source-specific facts;
- evidence-reviewed brand, distillery, and bottler roles;
- evidence-derived automation routing without numeric confidence; and
- production-miss provenance using the real observed source and Peated DB
  outcome.
