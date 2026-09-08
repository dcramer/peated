## Context

Ratings already combine tasting bands, member-review scores, and eligible
critic-review scores through `UpdateBottleStats`. Tasting-note reads now have a
partial implementation that unions all three source tables at request time,
while the existing `bottle_tag` cache is still maintained only by tasting
writes. Public counts, filters, sorting, and lists mostly remain tasting-only.

The source records must stay separate. They have different ownership,
permissions, identifiers, and rating formats. Public aggregate reads must be
fast and independent of the viewer, while row-level lists must honor the
viewer's existing access to private member activity.

## Goals / Non-Goals

**Goals:**

- Give public Bottle and catalog surfaces one consistent three-source meaning.
- Make flavor, tag, count, filter, and sort reads use small saved summaries.
- Recompute ratings and tasting-note summaries through one worker boundary.
- Give public Bottle and Entity pages one chronological reviews-and-tastings
  list without weakening source-specific permissions.
- Keep names accurate so `totalTastings` continues to mean tastings only.

**Non-Goals:**

- Merging the three source tables or normalizing their source-specific fields.
- Changing profile, recommendation, badge, comment, flight, or moderation rules.
- Making aggregate updates synchronous with every source write.
- Treating unscored records as scored or untagged records as flavor evidence.

## Decisions

### Save hot public aggregates on Bottle-owned summary records

Add `publicReviewAndTastingCount` and `notedReviewAndTastingCount` to Bottle and
BottleGroup. Add the combined public count to Entity. Keep `totalTastings`
unchanged for compatibility and tasting-specific behavior.

`bottle_tag` becomes the authoritative per-Bottle count of public records that
contain each note. Add `bottle_note_category` for per-Bottle category counts.
One record counts once for a tag and once for a category even when it contains
duplicates or several tags in the same category.

The alternative—unioning all source rows for every read—has less stored state
but makes global tag ranking, filtering, and Entity/region wheels scale with the
complete activity history. Saved summaries make these reads scale with matching
Bottles and tags instead.

### Recompute all Bottle aggregate state together

Extend `UpdateBottleStats` to calculate ratings, combined public counts, tag
counts, and category counts inside the same transaction. Replace manual
tasting-only `bottle_tag` increments with exact delete-and-rebuild behavior.
BottleGroup and Entity summaries derive their combined counts from active
Bottle summaries.

This follows the existing eventual-consistency boundary. A source record is
visible immediately, while all saved Bottle aggregate fields move together
after the worker runs.

### Keep public aggregate and viewer-list visibility explicit

Public aggregates include public-member tastings, public-member reviews, and
published visible critic reviews. They exclude private-member records so public
catalog ordering never varies by viewer. Critic tags do not require a usable
score; score and note eligibility have different denominators.

Combined lists use the existing activity-feed visibility rules: public records
plus private member records the current viewer may see, and visible critic
reviews. The list returns a discriminated union and orders by event time, kind,
and ID for stable pagination.

### Preserve routes while broadening public presentation

Existing `/tastings` page URLs remain valid during this change. Public Bottle,
Entity, and global pages using those URLs show and label the combined set as
“Reviews & tastings.” Personal profile URLs and source-specific detail routes
remain unchanged.

API responses gain accurately named combined count fields. Existing
tasting-only fields remain and are not silently redefined.

## Risks / Trade-offs

- **Saved summaries can drift** → Rebuild them from authoritative source rows,
  add source-matrix tests, and extend the existing maintenance repair path.
- **Privacy changes affect many Bottles** → Queue unique Bottle recomputes in
  bounded batches after the user update commits.
- **Tag taxonomy changes invalidate category rows** → Queue recomputes for
  Bottles using the changed tag.
- **Three-source pagination can be unstable** → Use one shared ordering tuple
  and keyset cursor rather than merging three independently paginated responses.
- **Deployment temporarily has empty new summaries** → Deploy additive schema,
  backfill through the repair job, then switch readers. Defaults keep reads safe
  during rollout.

## Migration Plan

1. Generate an additive migration for combined count fields and
   `bottle_note_category`.
2. Deploy writers/recompute logic that fills the new summaries.
3. Run the Bottle-count maintenance repair to backfill active Bottles and groups;
   recompute Entities after their Bottles.
4. Switch aggregate and list readers to the new behavior.
5. Remove manual tasting-only `bottle_tag` maintenance.

Rollback can switch readers back to existing source queries while leaving the
additive columns and table in place. Do not remove source data during rollback.

## Open Questions

None. Issue #1133 establishes the intended public scope and source-specific
exceptions.
