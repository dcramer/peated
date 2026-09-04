# Bottle Reference Resolution

This document defines the live architecture for creating and resolving Bottle
identity across manual entry, scraped sources, reviews, prices, photos,
classifier workflows, and migration.

The central principle is that every marketed version is one independently
complete Bottle. Raw source input is evidence, not canonical identity. Cheap
deterministic checks may reuse an already accepted identity, while semantic
normalization remains evidence-reviewed.

Related architecture:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Reference Normalization](./bottle-reference-normalization.md)
- [Bottle Classifier](./bottle-classifier.md)

## Goals

- Create, match, search, render, and edit one complete Bottle without hydrating
  its BottleGroup.
- Reuse exact accepted references without paying for a classifier call.
- Use reviewed classifier evidence when no accepted prior decision exists.
- Keep deterministic code limited to safe structural checks, accepted
  references, and verified identifier anchors.
- Preserve observation-only source facts without silently promoting them into
  canonical Bottle identity.
- Keep every assignment and automated create decision auditable.
- Create singleton BottleGroups automatically and keep group selection out of
  classifier, user, and normalization contracts.

## Non-Goals

- Do not recreate Bottle-versus-Bottling or parent-versus-release decisions.
- Do not expose create-release, repair-parent, or classifier-selected group
  actions in the live creation architecture.
- Do not infer semantic identity or grouping from brand prefixes, years, batch
  tokens, cask wording, retailer names, normalized strings, or fuzzy rank alone.
- Do not store generated, normalized, scraped, or unresolved candidate strings
  as references unless they have been accepted as assignments.
- Do not run the classifier when an exact accepted reference already proves
  Bottle identity.

## Canonical Model

Peated has three relevant identity layers:

- `Bottle`: one complete product release with a stable expression plus every
  supported structured exact field.
- `BottleGroup`: a same-expression relationship aggregate established by
  singleton creation or deterministic legacy migration. It owns shared editing
  semantics, representative selection, and member-derived aggregates, but a
  Bottle remains complete and renderable without group hydration.
- `BottleObservation`: source facts useful as evidence but outside canonical
  catalog identity.

Assigned references and other resolved consumers store one validated `bottleId`.
They do not store BottleGroup identity or invoke a second resolver after
selecting a Bottle. When a source identifies only a general expression, it may
resolve to the retained general Bottle in that group; otherwise it remains
unresolved.

### Stable And Exact Bottle Fields

The Bottle name stores the stable marketed expression relative to its brand.
Bottle fields store edition, distillation year, bottling year, release year,
effective stated age, ABV, single-cask and cask-strength flags, and cask
details. Bottle creation appends an explicit edition to the stable expression.
It does not generate name suffixes from age, year, ABV, or production flags.
Wording already marketed in the expression remains there. Bottling year is only
a detail unless the producer markets that bottling as a separate release.

A Bottle is the durable exact record. Shared BottleGroup values are copied into
every member Bottle so exact reads remain independently correct. A shared group
edit atomically regenerates every member from the new shared values and that
member's preserved exact fields; it is not runtime inheritance.

Facts that identify only a source listing or physical unit remain observations,
including retailer selectors, URLs, listing images, bottle numbers, outturn, and
unreviewed label fragments. A fact becomes canonical only when reliable evidence
establishes that it identifies the marketed Bottle.

### Group Assignment

Independent Bottle creation atomically creates a singleton BottleGroup and its
complete Bottle. Deterministic legacy migration places a retained parent and
its promoted release Bottles in one migration-created group. Classifier output
never contains a parent or group selection, and manual or ordinary API clients
cannot supply a source Bottle or group id to bypass that boundary.

Likely same-expression matches may be suggestions. Similar names, shared brand,
or shared series do not silently merge independently created groups. This
release ships no automatic regrouping service; that capability requires a
separate reviewed change.

## Reference Model

A BottleReference is a durable assertion:

> This accepted reference string resolves to this Bottle.

An exact accepted reference can bypass the classifier because the system is reusing
a prior decision, not guessing from text. Candidate evidence, generated
normalization output, and unresolved source text are not references.

- Every assigned reference stores one Bottle id.
- A general expression reference points to the retained general Bottle for that
  expression; it does not point to BottleGroup or select a representative.
- An ignored reference does not participate in exact matching.
- The assignment source record says whether the assertion came from canonical
  creation, an accepted source, classifier review, or human review.

Reference lookup and reference writes use the same identity-preserving key for a
workflow. Lossy or semantic normalization may retrieve evidence but cannot
assign a Bottle unless that exact key was already accepted.

A marketed Bottle title is not automatically an exact reference. Several structured
releases can use the same title, so creation, update, and review preflight check
the complete structured identity and leave reference assignment to accepted
source or human decisions. A reference conflict does not block a Bottle title.
Code does not overwrite or reinterpret another Bottle's accepted reference.
When an unchanged SMWS code proves that a subtitle was renamed, the previous
title remains a reference for that Bottle.

A BottleAlias is a moderator-verified alternate marketed name for display and
customer search. It does not resolve ingestion or move existing consumers. The
same alias text can belong to more than one Bottle. Bottle details show these
names as “Also known as.”

## Resolution Pipeline

All source-reference workflows follow the same conceptual pipeline:

1. Keep the source name and available source facts for review.
2. Build the workflow's identity-preserving reference key.
3. Reuse an exact accepted reference when it resolves one valid Bottle.
4. Extract verified identity anchors, such as an exact SMWS code, for the
   classifier.
5. Retrieve local Bottle and entity candidates.
6. Run reviewed classification when semantic identity remains unresolved.
7. Validate candidate ids, resolved entities, canonical fields, and Bottle
   integrity.
8. Derive the automation tier from action risk and structured evidence.
9. Persist the Bottle id, queue review, or leave the source unresolved.

Candidate retrieval is evidence, not a decision. Text rank, fuzzy references,
similar names, sibling rows, and web results cannot independently select a
Bottle or BottleGroup.

## Classifier Ownership

The classifier decides:

- whether the source matches an existing complete Bottle;
- whether an existing Bottle needs a separate Suggested Change;
- whether evidence supports creating one complete Bottle;
- which wording is the stable expression and which facts are structured
  exact-Bottle fields or observations;
- whether Entities fill the correct Bottle relationships;
- whether a candidate is too broad or too specific; and
- whether available local, label, image, or web evidence is supportive,
  conflicting, or insufficient.

Classifier actions are `match`, `create_bottle`, and `no_match`. A required
catalog correction is a separate Suggested Change and the identity result stays
`no_match`. `create_bottle` contains one independently complete Bottle. There is
no live create-release, create-bottle-and-release, repair-parent, or group
selection action.

Deterministic validation may reject unknown ids, direct source-field conflicts,
invalid Bottles, or impossible states. It must not promote `no_match`, infer
whisky-family semantics, or replace the classifier decision with prefix or
similarity rules.

## Evidence-Derived Automation

Automation does not use a model-authored numeric confidence score, confidence
band, or post-hoc numeric confidence cap. Code derives `auto` versus `review`
from the action's risk and structured evidence, including identity basis,
positive evidence, web-evidence status when applicable, and typed unresolved
risks.

An asserted unresolved risk forces review. No evidence field upgrades a decision
that the derived tier routes to review. Exact accepted references may bypass
classifier review because they reuse an accepted decision. Verified identifiers
are evidence supplied to the classifier; normalized text cannot decide identity.

Automation may create or assign only when:

- the decision can be traced to its stored source record and available evidence;
- the selected Bottle or create draft is independently complete;
- duplicate Bottle and reference checks are safe;
- required entities resolve or can be safely created;
- observation-only detail remains outside canonical identity; and
- the decision and its evidence sources are retained.

Conflicting identity, unsafe reference collisions, unresolved canonical fields, or
an invalid Bottle leave the source unresolved or route it to review.

## Workflow Boundaries

### Manual Entry

The Add a bottle form accepts stable expression fields and structured exact
fields in one form and always creates one Bottle. Independent entry receives an
automatic singleton group. “Add a similar bottle” may prefill the same form from
an existing Bottle, but submission still uses independent creation and starts in
a singleton group. It does not silently join the source group.

### Store Prices And Reviews

Store-price and review ingestion keep the source name needed for review. An
accepted reference supplies its validated Bottle ID. Otherwise the row remains
unresolved until reviewed resolution succeeds. Some older paths retain only a
normalized source name; do not treat that as the complete original evidence.

A successful classifier match or create supplies one Bottle id. When the
workflow genuinely knows only the general expression, it may select the
retained general Bottle; it never substitutes a group representative.
Unresolved source text does not create an unbound reference as candidate storage.

### Observations

Observations preserve exact source facts that remain outside canonical identity,
including source URL, raw title, retailer image, price/volume context, selector,
bottle number, outturn, and unreviewed maturation fragments. They attach through
the same validated Bottle id when identity is known.

## Legacy Compatibility

BottleRelease is not a public identity or a path for new product behavior.
Some schema fields, audit tools, deletion paths, and migration checks still
support old BottleRelease data. Do not remove or expand that support without a
separate inventory, migration plan, and database verification.

## Minimum Test Coverage

Deterministic coverage should prove:

- exact accepted references resolve one Bottle;
- the shared server classifier entry point returns that accepted Bottle without
  a model call;
- general references resolve the retained general Bottle without selecting a
  representative;
- ignored and ambiguous references do not resolve;
- reference lookup and write keys are identical for each workflow;
- semantic or lossy normalization does not auto-assign;
- duplicate Bottle and reference conflicts roll back creation;
- independent creation produces a singleton group and complete Bottle
  atomically;
- direct Bottle identity cannot be downgraded by retained legacy fields; and
- compatibility resolution is measured and delegates to canonical services.

Classifier and eval coverage should prove:

- one complete `create_bottle` draft with stable and structured exact fields;
- exact candidate matching versus over-broad or over-specific candidates;
- observation-only treatment of source-specific facts;
- evidence-reviewed brand, distillery, and bottler relationships;
- evidence-derived automation routing without numeric confidence; and
- a production-miss source record using the real observed source and Peated DB
  outcome.
