# Bottle Creation And Alias System

This spec defines the target architecture for bottle and release creation across
manual entry, scraped sources, review ingestion, price matching, repair flows,
and backfills.

The central principle is that raw input is evidence, not canonical identity.
Users, retailers, reviewers, and scrapers can all provide names and facts that
are useful but not normalized to Peated's bottle and release model. The system
should use cheap deterministic checks when they are safe, and should rely on the
reviewed bottle classifier when semantic identity is unresolved.

Related policy:

- [Whisky Identity Model](./whisky-identity-model.md)
- [Bottle Normalization Contract](./bottle-normalization-contract.md)
- [Bottle Classifier](./bottle-classifier.md)

## Goals

- Reuse prior accepted matches without paying for a classifier call.
- Use the classifier/agent for semantic normalization when no accepted prior
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
- Do not make every write path synchronous on the classifier when an exact
  accepted alias already proves the target.
- Do not store generated, normalized, scraped, or unresolved candidate strings
  in `bottle_alias` unless they have been accepted as assignments.
- Do not block manual saves on slow review work unless deterministic correctness
  requires it.

## Core Model

Peated has three identity layers:

- `bottle`: the stable parent product most users rate, search, and collect.
- `bottle_release`: optional reusable precision under a bottle.
- `bottle_observation`: source facts that are useful evidence but are not yet
  canonical bottle or release identity.

Raw names from users or external sources are references that need resolution.
They are not automatically aliases, bottles, releases, or observations.

## Alias Model

`bottle_alias` is a durable identity assertion:

> This exact reference string has already been accepted as mapping to this
> bottle and, when present, this release.

An exact alias hit is a prior decision cache. It can bypass the classifier
because the system is reusing an accepted match, not guessing from text.

Aliases are assignable by definition. A row in `bottle_alias` should not mean
"maybe this text is related"; it should mean "this text is allowed to assign the
same target again." If a string is only candidate evidence, raw source evidence,
or generated normalization output, it belongs on the source record, in
`bottle_observation`, in classifier artifacts, or in a future proposal/evidence
table.

Alias categories:

- `legacy`: existing aliases before provenance was recorded. These preserve
  historical behavior.
- `canonical`: generated from canonical bottle or release names.
- `source_approved`: accepted from a store price, review, or imported source by
  automation or a moderator.
- `classifier_approved`: accepted as part of a classifier-reviewed decision.
- `human_approved`: explicitly assigned by a moderator.
- `ignored`: an existing alias row retained for audit/history but excluded from
  exact matching.

There is intentionally no `assignment_trusted` column. Trust is not a separate
state for this table. The table boundary is the trust boundary.

### Alias Metadata

`bottle_alias` carries assignment provenance:

- `assignment_source`: `legacy`, `canonical`, `source_approved`,
  `classifier_approved`, or `human_approved`
- `assigned_by_id`: optional user who accepted or created the assignment
- `ignored`: manual exclusion from exact alias matching and alias search

Current legacy aliases default to `assignment_source = legacy` for
compatibility. New aliases should provide a more specific source whenever the
caller knows how the mapping was accepted.

Unbound alias rows may still exist because older flows used them as reservation
or bridging records. New unresolved input should not create unbound aliases as
candidate evidence. If a workflow needs candidate storage, it should use a
separate proposal/evidence table with explicit lifecycle rules.

### Historical Inference

Git history supports treating aliases as accepted match decisions, not generic
synonyms:

- `66d9f0c8` made aliases optionally unbound so reviews and prices could create
  alias rows before a bottle was eventually matched. This explains why
  null-target aliases can exist, but it does not require future unresolved
  candidate text to live in `bottle_alias`.
- `8a189748` moved bottle conflict detection through aliases. This made the
  alias table part of canonical identity safety, not only search.
- `29fab8e0` reverted automatic alias overwrites and required deleting aliases
  first. This points toward aliases being owned assertions that should not be
  casually reassigned.
- `908c140f` explicitly says price matching should persist automation snapshots
  and trust exact matches. In this model, "trust exact matches" means exact
  accepted aliases may assign without a classifier call.

Working assumption: current legacy aliases are accepted aliases for
compatibility. Future generated or normalized strings are not aliases until a
classifier, moderator, deterministic resolver, or accepted source flow assigns
them to a target.

## Decision Sources

Every bottle/reference resolution should record one of these decision sources:

- `exact_alias`: exact accepted alias reused; no classifier needed.
- `canonical_alias`: canonical name alias reused; no classifier needed.
- `deterministic_resolver`: closed-form resolver applied, such as SMWS code
  resolution.
- `agent_match`: classifier matched an existing bottle or release.
- `agent_repair`: classifier identified a current bottle that needs canonical
  metadata repair.
- `agent_create`: classifier proposed creating a bottle, release, or both.
- `automation_approved`: post-agent automation accepted a classifier decision.
- `human_review`: moderator chose or changed the outcome.
- `manual_entry`: user-created bottle without an existing alias match.
- `unresolved`: no safe target.
- `ignored`: source should not be matched to a standard bottle.

Decision source must be persisted anywhere the system mutates source assignment,
creates canonical identity, or creates an alias.

## Resolution Pipeline

All source references should follow the same conceptual pipeline.

1. Preserve raw source facts.
2. Build the workflow's deterministic alias key from the source reference.
3. Check exact accepted aliases for that key.
4. Apply closed-form deterministic resolvers only when available.
5. If no accepted match exists, retrieve candidates.
6. Run the classifier.
7. Validate classifier output structurally.
8. Apply shared automation policy.
9. Persist the result, queue review, or leave unresolved.

Candidate retrieval may use:

- normalized text
- embeddings
- raw source names
- observations
- current assignment
- exact local aliases
- release text
- brand/entity search

Candidate retrieval is not a final decision. It supplies evidence to the
classifier.

### Alias Key Rule

For no-agent exact matching, the alias lookup key and the alias write key must
be the same accepted reference string for that workflow.

That key may be raw source text or an identity-preserving normalized form. The
normalization must satisfy the
[Bottle Normalization Contract](./bottle-normalization-contract.md): it can make
the text comparable, but it cannot infer age, year, batch, cask, release, brand,
or entity identity.

Lossy or semantic normalized text can still be used for storage, search,
retrieval, or classifier evidence. It must not create a deterministic assignment
unless that exact string has already been accepted as an alias.

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

- exact accepted alias lookup
- ignored-alias exclusion
- schema validation
- known id validation
- release belongs to bottle validation
- duplicate alias and duplicate release identity checks
- impossible state blocking
- exact closed-form resolvers such as SMWS code identity
- obvious non-whisky, bundle, gift set, sampler, or damaged-condition ignores
- confidence caps and post-agent automation gates

Deterministic code is not appropriate for:

- brand/entity identity based on prefix matching
- assigning normalized strings to bottles by text similarity alone
- deciding bottle-vs-release scope from age/year/batch/cask tokens alone
- turning raw retailer titles into release aliases by default
- creating canonical release rows from exact cask or store-pick detail unless
  classifier or moderator review accepts that detail as shared identity

## Store Price Ingestion

Store price ingestion should:

1. Preserve the raw retailer listing name and URL.
2. Normalize the stored price name only for the price record's display/search
   needs.
3. Build the deterministic alias key from the listing name.
4. If an alias target exists, assign the price immediately and write/update the
   same alias key as `source_approved`.
5. If no alias target exists, create/update the price without a bottle target
   and enqueue resolver work.

Store listing aliases should stay bottle-level unless an existing canonical
release alias already owns the same text. Retailer titles frequently include
store-specific packaging, SEO, exclusive wording, or partial release detail.

## Review Ingestion

Review ingestion should:

1. Preserve the raw review title and issue.
2. Build the deterministic alias key from the review title.
3. If no alias target exists, run the classifier.
4. If the classifier matches or creates a target, assign the review and create a
   `classifier_approved` alias for the same accepted key.
5. If the classifier cannot resolve the target, store the review unresolved and
   do not create a `bottle_alias` row.

Unresolved review titles are source evidence, not aliases. They may be useful
for future backfills, but they must not become deterministic assignment rows
until accepted.

## Manual Entry

Manual bottle creation should:

- check exact aliases for duplicate prevention
- create canonical aliases for the new bottle and releases
- record canonical alias provenance with the acting user when available
- leave semantic repairs or uncertain source mappings to classifier or moderator
  review

Manual alias assignment should record `human_approved` provenance.

## Release Aliases

Release aliases are stronger than store or review title aliases because they can
assign both `bottle_id` and `release_id`.

Create canonical release aliases only from release records or accepted moderator
actions. Store/review aliases should remain bottle-level unless the source text
is accepted as the canonical release alias or already exactly matches one.

When an alias already belongs to a release, assignment helpers should preserve
that release ownership unless the caller is explicitly creating or updating a
canonical release alias for the same bottle.

## Observations And Evidence

Exact source detail should be preserved before it is promoted:

- raw retailer/review title
- URL
- image URL
- price and volume
- issue or publication details
- cask number, barrel number, bottle number, outturn, store pick, and exclusive
  wording
- raw maturation or label fragments that do not fit current canonical fields

`bottle_observation` is the preferred place for exact store-price facts that are
useful evidence but not yet shared bottle/release identity.

## Automation Policy

Automation may create or assign a bottle/release only when:

- the input source is preserved
- duplicate alias and release checks pass or resolve to the same target
- classifier confidence clears the workflow threshold unless an exact accepted
  alias or closed-form resolver provided the target
- required entities exist or can be safely created
- exact source details that are not canonical are preserved as observations
- the decision is logged with source, model, confidence, and rationale when a
  classifier was used

Automation should leave records unresolved when:

- required identity components conflict
- the target depends on lossy or semantic normalized text alone
- release detail is present but ambiguous
- the classifier returns `no_match`, low confidence, or an unsafe create/repair
  decision
- duplicate aliases point to a different target

## Minimum Test Coverage

Core deterministic tests should cover:

- exact accepted alias resolves without classifier
- ignored alias does not resolve
- unresolved review does not create a `bottle_alias` row
- classifier-approved review creates alias provenance
- source-approved store price creates alias provenance
- exact accepted alias key pre-fills store price
- alias lookup and alias write use the same workflow key
- lossy normalized store-price or review text does not auto-assign unless it was
  explicitly accepted as an alias
- canonical release alias preserves release id
- store listing alias remains bottle-level unless a canonical release alias
  already owns the same text
- alias upsert preserves existing targets and updates provenance only when the
  target is the same or previously unbound
- duplicate alias conflicts block unsafe bottle/release creation
- deterministic normalization follows the
  [Bottle Normalization Contract](./bottle-normalization-contract.md)

Classifier/eval coverage should include:

- raw source text with misleading normalized form
- retailer titles with SEO/category suffixes
- review titles with release year, vintage year, batch, or cask detail
- independent bottler cases where brand and distillery differ
- exact cask/store-pick details that should remain observations
- production misses with provenance showing the real source page and Peated DB
  outcome

## Rollout

1. Add alias provenance columns: `assignment_source` and `assigned_by_id`.
2. Backfill existing aliases as `legacy`.
3. Exclude ignored aliases from exact alias lookup.
4. Remove generated/unresolved alias writes from review ingestion.
5. Preserve raw source facts on reviews, prices, observations, and decision logs.
6. Ensure accepted classifier/source/manual assignments write alias provenance.
7. Keep no-agent lookup limited to exact accepted alias keys and closed-form
   deterministic resolvers.
8. Expand eval fixtures around normalization failures, release detail, and
   production misses.
9. Add proposal/evidence storage later if candidate strings need their own
   lifecycle.

## Open Questions

- Should legacy unbound aliases be migrated into a separate proposal/evidence
  table once that table exists?
- Which source-approved flows should be allowed to write release-level aliases,
  if any, without moderator review?
- Should alias provenance later include a decision log id or external site id for
  better audit trails?
