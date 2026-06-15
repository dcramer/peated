# Bottle Creation And Alias Trust

This spec defines the target architecture for bottle and release creation across
manual entry, scraped sources, review ingestion, price matching, repair flows,
and backfills.

The central principle is that raw input is evidence, not canonical identity.
Users, retailers, reviewers, and scrapers can all provide names and facts that
are useful but not normalized to Peated's bottle and release model. The system
should use cheap deterministic checks when they are safe, and should rely on the
reviewed bottle classifier when semantic identity is unresolved.

## Goals

- Reuse prior accepted matches without paying for a classifier call.
- Use the classifier/agent for semantic normalization when no trusted prior
  decision exists.
- Keep deterministic code limited to safe structural checks, exact accepted
  aliases, and closed-form resolvers.
- Preserve source facts without promoting weak or exact source detail into
  canonical bottle or release fields.
- Make create, match, repair, ignore, and override decisions auditable.
- Apply one shared post-agent automation policy across all auto-create surfaces.

## Non-Goals

- Do not replace classifier judgment with deterministic whisky taxonomy rules.
- Do not infer bottle-vs-release scope from brand prefixes, years, batch-like
  tokens, cask wording, retailer names, or normalized strings alone.
- Do not make every write path synchronous on the classifier when a trusted exact
  alias already proves the target.
- Do not block manual saves on slow review work unless deterministic
  correctness requires it.

## Core Model

Peated has three identity layers:

- `bottle`: the stable parent product most users rate, search, and collect.
- `bottle_release`: optional reusable precision under a bottle.
- `bottle_observation`: source facts that are useful evidence but are not yet
  canonical bottle or release identity.

Raw names from users or external sources are not automatically any of those
canonical objects. They are references that need resolution.

## Alias Trust Model

`bottle_alias` should be treated as a durable identity assertion:

> This exact reference string has already been accepted as mapping to this
> bottle and, when present, this release.

An exact trusted alias hit is a prior decision cache. It can safely bypass the
classifier because the system is reusing an accepted match, not guessing from
text.

Aliases are not all equally trustworthy. The target model should distinguish at
least these alias categories:

- `canonical`: generated from the canonical bottle or release name.
- `source_approved`: accepted from a store price, review, or imported source by
  automation or a moderator.
- `classifier_approved`: accepted as part of a classifier-reviewed decision.
- `human_approved`: explicitly assigned by a moderator.
- `generated`: mechanically normalized or generated text that can support
  retrieval but must not decide identity unless `assignment_trusted = true`.
- `ignored`: known-bad alias text that should not resolve references.

Only trusted aliases should be used as the no-agent fast path:

- `canonical`
- `source_approved`
- `classifier_approved`
- `human_approved`
- `legacy`, for backfilled rows where `assignment_trusted = true`

Weak/generated aliases may be used for candidate retrieval. They must not be
used as final assignment evidence without classifier or human review.

### Alias Metadata

`bottle_alias` now carries the durable assignment boundary:

- `assignment_source`: `legacy`, `canonical`, `source_approved`,
  `classifier_approved`, `human_approved`, or `generated`
- `assignment_trusted`: whether this alias may bypass the classifier as an exact
  match
- `assigned_by_id`: optional user who accepted or created the assignment
- `ignored`: manual exclusion from alias matching/search

Current legacy aliases default to `assignment_source = legacy` and
`assignment_trusted = true` for compatibility. New unassigned placeholders
default to `generated` and untrusted. A sidecar history table may still be useful
later for decision/proposal ids, external-site scoping, and assignment history,
but the current resolver should treat `assignment_trusted` as the no-agent
fast-path gate.

This metadata should let ingestion answer two questions separately:

1. Can this alias bypass the classifier?
2. Can this alias help candidate retrieval?

### Historical Inference

Git history supports treating aliases as prior match decisions, not just generic
synonyms:

- `66d9f0c8` made aliases optionally unbound so reviews and prices could create
  alias rows before a bottle was eventually matched. This suggests aliases were
  intended to bridge raw external references and later accepted bottle targets.
- `8a189748` moved bottle conflict detection through aliases. This made the
  alias table part of canonical identity safety, not only search.
- `29fab8e0` reverted automatic alias overwrites and required deleting aliases
  first. This points toward aliases being owned assertions that should not be
  casually reassigned.
- `908c140f` explicitly says price matching should persist automation snapshots
  and trust exact matches. This is consistent with exact trusted aliases as a
  no-agent fast path.

Working assumption: current legacy aliases should be treated as trusted for
compatibility, while future generated or normalized aliases should carry
provenance and default to weak unless explicitly accepted.

## Decision Sources

Every bottle/reference resolution should record one of these decision sources:

- `exact_alias`: trusted exact alias reused; no classifier needed.
- `canonical_alias`: canonical name alias reused; no classifier needed.
- `deterministic_resolver`: closed-form resolver applied, such as SMWS code
  resolution.
- `agent_match`: classifier matched an existing bottle or release.
- `agent_repair`: classifier identified a current bottle that needs canonical
  metadata repair.
- `agent_create`: classifier proposed creating a bottle, release, or both.
- `automation_approved`: post-agent automation accepted a classifier decision.
- `human_review`: moderator chose or changed the outcome.
- `manual_entry`: user-created bottle without an existing trusted match.
- `unresolved`: no safe target.
- `ignored`: source should not be matched to a standard bottle.

Decision source must be persisted anywhere the system mutates source assignment,
creates canonical identity, or creates a trusted alias.

## Resolution Pipeline

All source references should follow the same conceptual pipeline.

1. Preserve raw source facts.
2. Check exact trusted aliases for the raw reference string.
3. Apply closed-form deterministic resolvers only when available.
4. If no trusted match exists, retrieve candidates.
5. Run the classifier.
6. Validate classifier output structurally.
7. Apply shared automation policy.
8. Persist the result, queue review, or leave unresolved.

Candidate retrieval may use:

- normalized text
- embeddings
- weak/generated aliases
- current assignment
- exact local aliases
- release text
- brand/entity search

Candidate retrieval is not a final decision. It supplies evidence to the
classifier.

### Historical Inference

`16b63903` moved review ingestion and review-driven backfills from older exact
or prefix-style entity matching into the shared bottle classifier, while keeping
direct alias short-circuits when identity is already known. The commit message
calls out the bug class directly: scraped reviews and missing-review backfills
were able to mint or rewrite bottle identity from weaker heuristics than price
matching and release repair.

Working assumption: review ingestion, store-price ingestion, and backfills
should share the same resolution boundary:

- exact trusted alias can bypass the classifier
- unresolved identity should go to the classifier
- weak normalized or prefix-style evidence should not create identity directly

## Classifier Ownership

The classifier owns semantic identity decisions:

- whether a reference matches an existing bottle or release
- whether an existing row needs repair
- whether a new bottle, release, or bottle plus release should be created
- whether a year is release year, vintage year, not identity, or ambiguous
- whether a batch/cask/ABV detail is canonical release identity or observation
- whether a brand, distillery, bottler, or parent-company mention is the right
  entity boundary
- whether a candidate is too broad or too specific
- whether available web evidence is supportive, weak, conflicting, or not needed

Deterministic code may validate and downgrade unsafe outputs. It must not
promote `no_match` or weak candidate evidence into create, repair, or match
outcomes.

## Deterministic Boundaries

Deterministic code is appropriate for:

- exact trusted alias lookup
- schema validation
- known id validation
- release belongs to bottle validation
- duplicate alias and duplicate release identity checks
- impossible state blocking
- exact closed-form resolvers such as SMWS code identity
- obvious non-whisky, bundle, gift set, sampler, or damaged-condition ignores
- confidence caps and post-agent automation gates

Deterministic code is not appropriate for:

- brand-vs-product semantics
- bottle-vs-release scope
- cask or barrel identity semantics outside closed-form systems
- deciding whether a year is canonical identity
- converting a bare numeric expression into an age-statement expression only
  because a separate structured `statedAge` field has the same value
- inferring reliable source truth from retailer domain names
- choosing a new canonical bottle based on normalized text alone

Bare numbers are especially risky because the same token can be a product name,
edition, volume number, batch number, release number, or stated age depending on
label context. For example, `The Last Drop 42` with `statedAge = 42` must not be
mechanically rewritten to `The Last Drop 42-year-old`; the name `42` and the
age fact are separate evidence until the classifier or a moderator decides the
canonical expression.

## Create Automation Policy

Create automation is a post-agent gate. The classifier may propose a create
decision, but automation decides whether the system may persist it without human
review.

The shared automation policy must be used for store prices, review ingestion,
create-missing-bottles backfills, and future external ingestion surfaces.

Auto-create may proceed only when all of these are true:

- the classifier action is create bottle, create release, or create bottle and
  release
- classifier confidence clears the configured create threshold
- the classifier's confidence basis has no unresolved risks that should block
  automation
- the proposed bottle and/or release is schema-valid
- known ids in the decision were part of the classifier candidate set
- duplicate bottle, alias, and release checks pass or resolve to the same target
- decisive bottle traits are internally consistent
- every proposed differentiating release trait is validated by acceptable
  evidence or explicitly left as observation-only
- originating retailer evidence alone is not decisive for differentiating traits
- exact-cask identity creates a bottle, not a child release
- no hard automation blockers remain

When no local candidates exist, the evidence bar must not drop to only brand and
name. Any proposed release trait still needs explicit validation before
automation may create a release or bottle-and-release pair.

If automation fails, the system should persist a pending decision/proposal for
review rather than silently creating or discarding the classifier output.

## Existing Match Automation

Existing match verification is lower risk than create automation, but it still
needs deterministic blockers.

An existing match may auto-approve only when:

- the target comes from a trusted alias, deterministic resolver, or classifier
  match
- classifier confidence clears the relevant threshold unless exact trusted alias
  already resolved the target
- release-specific source facts do not point at a bottle-only target unless the
  target bottle already represents those facts
- extracted identity does not conflict with the target
- release id, when present, belongs to the bottle

If bottle confidence is high but release confidence is weak, assign the bottle
and keep `releaseId = null`. Preserve release-like source detail as observation.

## Bottle Vs Release Persistence

Bottle identity fields:

- brand
- bottler
- distillery
- expression/name
- series
- category
- stated age only when stable across canonical releases

Release identity fields:

- edition
- release year
- vintage year
- release-specific stated age
- ABV
- single cask
- cask strength
- cask fill
- cask type
- cask size

Observation-first facts:

- cask number
- barrel number
- bottle number
- outturn
- market or store-exclusive wording
- retailer title fragments
- unmodeled maturation text
- exact source facts not yet promoted to canonical identity

Release-like fields may live on `bottle` only when:

- the classifier or a moderator marks the row as a single-known-release case
- exact-cask identity belongs at bottle level
- legacy repair or migration requires temporary compatibility

Otherwise, release-like fields belong on `bottle_release` or
`bottle_observation`.

### Historical Inference

`94c8c1cd` introduced release-aware precision with `bottle_observation` for raw
source evidence and `bottle_release` only for shared canonical variants. Its
commit message describes a bottle-first model that preserves enthusiast
precision without forcing every exact source detail into canonical identity.

`df41ee16` then made bottles the default identity object across tastings,
collections, and bottle pages. The commit message says bottlings should be
optional exact precision and that moderator workflows still support legacy
bottle-owned release metadata so older rows can be split without losing context.

Working assumption: bottle-first is intentional product policy, but storing
release-like fields on `bottle` should be a reviewed or legacy-compatible
exception, not the default result of untrusted input.

## Manual Creation Policy

Manual bottle creation should remain fast and bottle-first.

For normal users:

- `POST /bottles` should create parent bottle identity.
- release-like fields should be rejected, routed to release creation, or stored
  as pending observation/review.
- exact trusted alias duplicate checks should remain deterministic and cheap.
- slow duplicate review and catalog verification should run after save.

For moderators:

- advanced parent-level release fields may remain available for repair and
  single-known-release cases.
- using those fields should record explicit moderator intent.
- creating parent release-like fields while child releases exist should be
  blocked unless a repair flow is intentionally splitting/merging data.

If manual creation later gains classifier assistance, it should be asynchronous
or explicitly invoked. The request path should not depend on slow model calls
unless the product intentionally chooses that latency.

### Historical Inference

`55c32169` moved slow save work out of the bottle request path. That supports
keeping manual bottle creation responsive and queuing review/verification work
after persistence.

Working assumption: manual create should not synchronously call the classifier
by default. The safer direction is fast parent-focused persistence plus
post-save review, or an explicit classifier-assisted flow when users/moderators
ask for help.

## External Ingestion Policy

External ingestion includes store prices, reviews, scraped listings, and
backfills.

The ingestion fast path is:

1. exact trusted raw alias hit
2. closed-form deterministic resolver
3. otherwise classifier

Mechanically normalized names must not auto-assign by alias. They may be used as
candidate search input.

When ingestion resolves a target:

- update the source row assignment
- create or preserve a trusted alias only when the decision was accepted
- record the decision source
- persist observations for raw source facts
- queue review when automation does not pass

Review ingestion and create-missing-bottles backfills must not be looser
auto-create lanes. They should use the same post-agent automation policy as
price matching.

### Historical Inference

`0aba61dd` added auto-creation for trusted price-match bottles before the later
classifier and release-precision hardening. Subsequent commits such as
`908c140f`, `10f87f42`, and `d18cc914` tightened automation snapshots,
confidence/evidence behavior, and agent-driven approvals. The direction of
travel is toward auto-create being allowed, but only after reviewed classifier
output and durable automation evidence.

Working assumption: auto-create is an intended capability, not a temporary hack,
but the policy should be centralized and stricter than raw classifier output.

## Proposal And Moderator Policy

Moderator proposal flows may edit classifier output. This is necessary.

When a moderator changes the target shape or fields from the classifier
proposal, the system should record:

- original classifier decision
- original proposed bottle/release drafts
- final moderator-applied bottle/release inputs
- whether the target changed from bottle to release, release to bottle, or
  bottle-only to bottle-and-release
- moderator user id and timestamp

The resulting alias should be trusted as human-approved, not merely
classifier-approved.

## Observation Persistence

Observations should not be limited to store prices. Any external or manually
entered reference can carry useful source facts that should not be canonicalized
yet.

Observation records should capture:

- source kind
- source id/key
- raw name/title
- source URL
- image URL when relevant
- external site id when relevant
- extracted identity
- observed exact facts
- proposed bottle/release facts not promoted
- decision/proposal linkage
- actor/created by when available

Creating an observation should not imply that a release exists. It preserves
evidence for later repair, moderation, and classifier evaluation.

### Historical Inference

`17e4baa4` narrowed observation sources shortly after the release-aware model was
introduced. That looks like an implementation simplification rather than a
rejection of observations as a general evidence layer; `94c8c1cd` explicitly
introduced observations to keep raw source evidence.

Working assumption: expanding observations beyond store prices is aligned with
the identity model, but it should be staged carefully so observations remain
source evidence and do not become another canonical identity surface.

## Decision Logging

Decision logs should distinguish:

- alias reused
- deterministic resolver applied
- classifier matched
- classifier proposed repair
- classifier proposed create
- automation approved
- human approved
- human changed target shape
- human ignored
- repair applied
- unresolved or errored

Logs should include enough context to audit why a bottle, release, alias, or
source assignment exists.

## Migration Plan

1. Document current aliases as trusted by default for compatibility.
2. Add alias provenance/trust metadata or a sidecar alias provenance table.
3. Mark future generated normalized aliases as weak.
4. Remove normalized alias fallback as automatic assignment in store-price
   ingestion.
5. Define and implement a shared bottle reference resolution contract.
6. Move create automation into a shared post-agent policy.
7. Route review ingestion and backfills through that shared policy.
8. Harden no-candidate auto-create so release traits still require validation.
9. Tighten manual bottle creation around release-like fields.
10. Generalize observation persistence beyond store prices.
11. Backfill alias provenance and observations where reliable source data
    exists.

## Test Matrix

Alias trust:

- trusted raw alias resolves without classifier
- ignored alias does not resolve
- weak/generated alias can appear as candidate evidence but cannot auto-assign
- canonical release alias preserves release id
- store listing alias remains bottle-level unless a canonical release alias
  already owns the exact text

Ingestion:

- normalized store-price name does not auto-assign through alias fallback
- raw exact trusted alias still pre-fills store price
- review ingestion and store-price ingestion use the same create automation gate
- unresolved classifier result preserves source row without creating identity

Classifier and automation:

- no-candidate bottle-and-release create requires evidence for release traits
- low-confidence create cannot auto-create even with high field score
- originating retailer-only evidence blocks create automation
- exact-cask create cannot create a child release
- bottle-only target does not auto-verify when extracted release facts exceed
  the bottle identity

Manual creation:

- normal user bottle create rejects, routes, or reviews release-like fields
- moderator can explicitly create single-known-release bottle state
- bottle with child releases cannot gain new parent release traits through normal
  create/repair paths
- release creation has the same account trust requirements as bottle creation,
  unless documented otherwise

Proposals and logging:

- applying classifier proposal records classifier decision source
- moderator target-shape override records original and final shapes
- duplicate create collision reuses existing target and logs that no new object
  was created
- every approved external source assignment leaves an observation

## Open Questions

- Alias provenance location: history suggests preserving legacy alias behavior
  is important. A sidecar table may be safer than widening `bottle_alias` in a
  way that changes conflict behavior, but this needs schema design.
- Manual release-like fields: history favors fast manual saves and bottle-first
  UX. The open product choice is whether normal users should be routed to
  release creation, saved with pending review, or blocked when they submit
  release-like fields.
- Create thresholds: history supports auto-create after classifier review, but
  exact thresholds for bottle, release, bottle-and-release, and exact-cask
  bottle remain policy decisions.
- Observation rollout: history supports observations as raw evidence. The open
  sequencing question is whether to add review/user observations immediately or
  start with external source references.
- Alias backfill: legacy aliases should be trusted by default, but only some
  provenance can be reconstructed from store prices, reviews, changes, and
  decision logs.
- Retrieval-only aliases: weak/generated alias text should probably not live in
  the same trusted fast-path set unless it has explicit trust metadata. Whether
  embeddings belong on weak aliases or a separate retrieval table remains open.
