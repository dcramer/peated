## Context

The legacy model splits catalog identity between `bottle` and
`bottle_release`. Consumers carry `(bottleId, releaseId)`, and the parent Bottle
becomes ambiguous when concrete releases exist.

The branch initially introduced a polymorphic `CatalogTarget` so activity could
point to either an exact Bottle or a generic BottleGroup. That design is not
needed. A legacy parent already provides a durable general or unversioned Bottle
for activity whose exact release was not recorded. Retaining that Bottle lets
every consumer use one direct Bottle foreign key.

## Goals / Non-Goals

### Goals

- Make Bottle the only selectable catalog and activity identity.
- Keep every Bottle independently complete and renderable.
- Preserve each legacy parent as a valid general/unversioned Bottle.
- Promote each BottleRelease to another Bottle in the same automatic group.
- Keep BottleGroup as relationship, shared-presentation, and aggregation scope.
- Keep grouping outside ordinary user creation and activity workflows.
- Migrate all data in one retained-audit-gated, fail-fast transaction.
- Preserve legacy URLs and release ids through durable mappings.
- Remove the unreleased CatalogTarget implementation rather than maintain two
  identity systems.

### Non-Goals

- Let users create or select BottleGroups.
- Store activity directly on BottleGroup.
- Infer exact identity for parent-only historical activity.
- Infer grouping from name prefixes, brand equality, or series membership.
- Delete production data or legacy schema in the first migration.
- Preserve BottleRelease as a second runtime business model.

## Final Model

```text
BottleGroup
  ├── Bottle (general or unversioned expression)
  ├── Bottle (specific batch/year/edition)
  └── Bottle (specific batch/year/edition)

Tasting ───────────────┐
Review ────────────────┤
Collection entry ──────┤
Flight member ─────────┼──> Bottle ──> BottleGroup
Store price ───────────┤
Alias / observation ───┤
Proposal / decision ───┘
```

Every Bottle has one `groupId`. Every consumer has one Bottle reference.
BottleGroup has no activity identity and no `CatalogTarget` row.

## Decisions

### Bottle is independently authoritative

Bottle durably stores its complete identity and rendering data: name, brand,
bottler, distillers, category, series, flavor profile, effective stated age,
edition, release/vintage year, ABV, flags, cask traits, exact content, aliases,
and statistics. Bottle reads do not hydrate BottleGroup to become correct.

BottleGroup owns shared editing intent, relationship presentation,
representative selection, and member-derived aggregates. A shared change is a
transactional fan-out: it updates the group and rematerializes the common fields
and complete names of all member Bottles. Previous canonical names remain exact
Bottle aliases. Any collision rolls back the full change.

### Every consumer selects a Bottle

All activity and integration boundaries accept and return `bottleId`.
BottleGroup is never a tasting, review, collection, Flight, price, alias,
observation, proposal, activity, cache, queue, or statistics target.

This is simpler than `CatalogTarget` because there is no polymorphic identity,
generic target row, discriminated target result, or target-to-Bottle resolver.
It is also semantically honest: unknown historical release specificity remains
attached to the retained general Bottle rather than an arbitrary promoted
release.

### Legacy parents remain Bottles

For a legacy family:

- the parent Bottle keeps its id and becomes the general/unversioned member;
- every BottleRelease becomes a new independently complete Bottle;
- all family Bottles belong to one migration-created BottleGroup;
- the parent may be the initial representative unless presentation policy
  selects a more suitable member;
- parent-only consumer references remain on the parent;
- release-specific references move to the promoted Bottle;
- the release-to-Bottle mapping remains durable for redirects and old API
  translation.

The parent is not synthetic migration debris and is not automatically deleted.
A later explicit Bottle merge may retire it only if product review establishes
that it duplicates another Bottle.

### Grouping is automatic and outside user workflows

Every ordinary creation creates a Bottle and singleton group atomically.
“Add another release” copies values into the same independent Bottle form and
also creates a singleton. Defining and operating an automatic grouping process
is intentionally outside this change; a later system-controlled process may
consolidate or separate groups.

There is no public group selection input and no moderator group-management UX
in this change. This change does not ship a dormant regrouping service. Any
future process must be audited, preserve Bottle ids and consumer references,
and rematerialize shared fields transactionally.

### Relationship pages are Bottle-anchored

`/bottles/:id` is the canonical Bottle page.
`/bottles/:id/releases` uses the Bottle only to locate its group and displays
related or other releases. User-facing copy does not expose “BottleGroup” as a
product concept or claim that the anchor is selected group activity.

Any action launched from the relationship page requires selection of a member
Bottle. The page may aggregate activity across member Bottles for display, but
no row points directly to the group.

### Statistics use raw Bottle activity

Bottle statistics use raw activity assigned to that Bottle. BottleGroup
statistics query raw activity across current member Bottle ids. They do not sum
materialized Bottle totals and do not add generic group activity.

Queue payloads carry Bottle ids. An exact Bottle update can recompute that
Bottle and its current group. Any future regrouping change must recompute the
affected source and destination groups without retargeting consumer rows.

### Aliases and integrations use Bottle ids

Exact aliases point directly to Bottle. A general expression alias may point to
the retained general Bottle. Alias propagation reuses that Bottle id for prices
and reviews.

Prices, observations, proposals, attempts, classifier decisions, photo flows,
activity notifications, badges, analytics, cache keys, and queue payloads all
use Bottle identity. Nullable unresolved states remain nullable where the
existing domain allows them; BottleGroup is not used as a fallback.

## Migration Design

### Additive schema

Keep:

- `bottle_group`;
- `bottle.groupId`;
- durable BottleRelease-to-Bottle promotion mapping;
- BottleGroup tombstone/redirect support where required;
- legacy BottleRelease tables and columns until cleanup approval.

Remove before release:

- `catalog_target`;
- every `targetId`, `currentTargetId`, and `suggestedTargetId` column, relation,
  index, constraint, runtime schema, serializer, and generated client type.

Consumer tables continue to use their Bottle foreign key. Release-specific
legacy rows are repointed to the promoted Bottle during migration. Nullable
Bottle references remain nullable only where unresolved identity is a supported
domain state.

The first additive migration preserves the existing release-aware collection,
Flight, and tasting uniqueness constraints. Replacing those constraints with
direct-Bottle-only keys before the data transaction would reject valid legacy
rows that share a parent Bottle but reference different releases. After the
one-shot transaction has repointed those rows, a separately generated,
non-destructive activation migration removes `releaseId` from the uniqueness
keys. This ordering is mandatory; application code does not issue ad hoc DDL.

### Read-only preflight

The retained audit reports:

- parent counts by release cardinality;
- invalid parent/release pairs;
- missing creators and required materialization data;
- Bottle and alias collisions for promoted identities;
- counts for every consumer Bottle/release slot;
- nullable unresolved consumer rows;
- expected promoted Bottle, group, mapping, and repointed-consumer counts;
- exact Git revision, database migration revision, generation time, and
  database identity.

Production application requires a fresh reconciled report and explicit
approval. Local fixtures do not satisfy this gate.

### One fail-fast transaction

The migration executes once inside one database transaction:

1. acquire affected tables in a fixed documented order;
2. rerun collision and integrity preflight under the transaction;
3. create or validate one BottleGroup per legacy parent;
4. keep each parent Bottle and assign it to its group;
5. promote every BottleRelease to a complete Bottle;
6. create completed durable release-to-Bottle mappings;
7. repoint every release-specific consumer Bottle reference to the promoted
   Bottle while retaining `releaseId` as historical migration evidence until
   separately approved cleanup;
8. leave every parent-only Bottle reference on the parent;
9. materialize aliases, observations, proposals, and attempts with the same
   direct-Bottle rule;
10. assert mapping completeness, valid Bottle foreign keys, group membership,
    uniqueness, counts, and no remaining supported release-specific runtime
    reference;
11. commit or roll back everything.

No checkpoint state machine, per-family partial commit, shadow target parity, or
generic target reconciliation remains. Table locks intentionally queue writes
for the bounded transaction. Activation must ensure old application and worker
processes cannot write legacy-only release references after commit.

### Postflight and cleanup

Immediately after migration, rerun and retain the audit. Validate Bottle,
group, mapping, direct-reference, aggregate, URL, and primary UX behavior.
Then apply the separately reviewed direct-Bottle uniqueness activation before
accepting new catalog-consumer traffic.

The first migration does not drop BottleRelease or consumer release columns.
The retained `(bottleId, releaseId)` values are no longer interpreted as a
parent/release pair after `bottleId` is repointed; rollback to the old
application therefore uses the verified database backup rather than mixed-mode
reads.
Destructive cleanup requires:

- a database backup;
- successful preflight, migration, and postflight evidence;
- no supported BottleRelease writes;
- compatibility traffic review;
- full test and visual QA gates;
- explicit user approval.

## Implementation Slices

1. Correct OpenSpec and architecture documentation.
2. Remove CatalogTarget schema and regenerate the unreleased additive migration.
3. Replace target loaders, schemas, serializers, and domain services with
   direct Bottle ownership.
4. Replace the resumable target backfill with one fail-fast direct-Bottle
   migration transaction and retained pre/post audit.
5. Cut server consumers, routes, workers, statistics, badges, analytics, and
   integrations to Bottle ids.
6. Cut web workflows and generated clients to Bottle-only selection and
   related-release presentation.
7. Remove target compatibility, parity, tests, docs, and generated artifacts.
8. Run focused integration/type/lint/schema/UI verification and manually review
   the complete diff.

Each slice must remove the superseded implementation, leave the repository
working, and receive focused verification before commit.

## Risks / Trade-offs

- **A parent-only row may describe a specific but unknown release.** Keeping it
  on the general Bottle preserves recorded knowledge without inventing detail.
- **A one-shot transaction can block writes.** Use the retained production
  audit to establish bounded size, lock tables in a fixed order, run during the
  low-traffic migration window, and fail before mutation on ambiguity.
- **An old process can write a release reference after migration.** Coordinate
  application/worker activation so legacy writers are stopped or rejected
  before transaction commit.
- **Promotion names or aliases can collide.** Detect every collision in
  preflight and again under lock; never suffix or choose arbitrarily.
- **Shared edits can partially drift member identity.** Lock the group, members,
  and aliases and roll back the entire fan-out on collision.
- **Future automatic grouping can be wrong.** Start ordinary Bottles in
  singleton groups. A later grouping change must define strong evidence, audit
  regrouping, and preserve Bottle ids so correction does not move activity.
- **Cleanup is hard to undo.** Keep it separate, backup-gated, and explicitly
  approved.

## Open Questions

None required for additive local implementation. Production timing, backup, and
explicit execution approval remain deployment decisions.
