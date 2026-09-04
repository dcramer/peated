## Context

Company pages reuse the Entity detail frame but do not have a company-scoped catalog. Their overview makes three direct-owner requests—Brands, Distilleries, and bottlers or Companies—each limited to four results. Companies are also excluded from ordinary Entity catalog queries, so popular Bottles and latest releases do not appear unless a Bottle happens to reference the Company itself.

That behavior exposes the storage hierarchy instead of the useful catalog relationship. Suntory currently has 60 descendants across four ownership levels, including 55 non-Company portfolio Entities, but its overview can show only its directly owned slice. The existing `ownerId` tree, owner index, cycle validation, Entity kinds, and Bottle relationships already contain enough information to compute the intended view.

The non-normative [company page prototype](./company-page-prototype.html) shows the proposed hierarchy and responsive composition with current Suntory data. It follows the existing Entity page frame, typography, colors, flat sections, shared identity rows, and narrow-screen ordering.

## Goals / Non-Goals

**Goals:**

- Make a Company page answer which whisky brands and producers are part of its recorded group.
- Preserve meaningful intermediate Companies while removing the need to visit each one to discover the portfolio.
- Provide complete, filterable Portfolio and Bottle collections with exact totals.
- Reuse the current Entity and Bottle identity rows and the established detail-page composition.
- Keep recursive reads deterministic, cycle-safe, and efficient on the indexed owner tree.

**Non-Goals:**

- Changing `ownerId`, Entity kinds, ownership history, or the rules for creating a Company.
- Adding multiple owners, ownership percentages, legal-entity metadata, or a general relationship graph.
- Editing or backfilling production ownership data.
- Showing a nested corporate organization chart.
- Adding a new visual system or universal catalog-page abstraction.

## Decisions

### Derive one portfolio from the existing owner tree

Add a Company portfolio read that starts at one Company and follows `entities.ownerId` through every descendant level. The portfolio contains descendant Brands, Distilleries, and Bottlers once each; descendant Companies carry the traversal but appear only in the separate group-company presentation. Each portfolio result includes its immediate owner and its ordered path from the requested Company so a complete collection can explain indirect membership when needed.

The server will use a recursive CTE with a visited-id path in addition to existing write-time loop checks. Results use the established Entity serializer, deterministic sort tie-breakers, bounded pagination, and an exact total.

Alternative: flatten every portfolio Entity onto the ultimate Company. Rejected because it discards meaningful intermediate ownership and turns a single company acquisition into many unrelated owner updates.

Alternative: merge intermediate Companies such as Suntory Global Spirits into their parents. Rejected because a recognizable portfolio company with its own ownership history is useful catalog structure even when visitors normally browse from the parent.

### Keep the familiar categories and separate group structure

The overview retains the current **Brands** and **Distilleries** sections, but each preview uses the complete descendant portfolio rather than only direct children. A **Bottlers** section appears when matching descendants exist. Each heading shows its exact total and links into the full Portfolio collection with that kind selected.

The side column uses **Companies in this group** for directly owned Companies only. It does not recursively repeat the company tree or include Bottlers. A visitor can follow a Company row to inspect that intermediate company.

The overview keeps the existing facts, media, and other available sections. It does not add popular-Bottle, latest-release, metric, or ownership-chart widgets. The purpose of this change is to make the existing company information complete, not turn the page into a dashboard.

Alternative: replace the categories with one mixed Whisky portfolio list. Rejected because visitors commonly arrive looking for either a Brand or producer, and the current headings already support that scan.

Alternative: render an expandable organization tree. Rejected because the common task is finding whisky, not studying corporate structure, and deep trees work poorly in the existing narrow column and on mobile.

### Give Companies first-class Portfolio and Bottles collections

Company tabs become Overview, Portfolio, and Bottles when the corresponding computed totals are nonzero. `/companies/{company}/portfolio` lists the complete descendant portfolio with kind filters, normal pagination, and sorting. Overview **View all** links open this collection with Brands, Distilleries, or Bottlers selected. `/companies/{company}/bottles` lists the group's active Bottles under the same header.

The Bottle list contract gains a Company scope. A Bottle matches when its Brand, Bottler, or any Distiller is the Company itself or one of its descendants. SQL returns each Bottle once even when several matching descendants appear on the same Bottle. Overview previews and the Bottle tab use this same rule, so their counts cannot disagree.

Company totals are computed live rather than copied into the existing Entity counters. Summing descendant counters was rejected because one Bottle can reference several descendants and would be counted more than once. Stored Company aggregate counters were rejected because they would add update fanout, a migration, and another stale-data risk without a current need.

### Keep the page dense and consistent with other catalog pages

The existing Entity frame, `PageHeader`, `PageTabs`, two-column overview, `PageSection`, `EntityIdentityRow`, `BottleIdentityRow`, `RailList`, loading rows, and section errors remain the visual vocabulary. The main column owns the categorized portfolio previews; the 336px side column owns media and direct group-company context. The established mobile order is retained.

No ownership badges, cards, tree lines, decorative counts, or new accent colors are introduced. Ownership-path text is supporting context on the complete Portfolio list, not part of the reusable Entity identity row.

### Treat partial data and failures as ordinary states

A Company with no recorded descendants omits Portfolio and Companies in this group and retains its ordinary facts and history. A Company with direct Bottle relationships but no descendants can still expose Bottles. Each overview query keeps its current local loading, error, and retry state so a failed portfolio request does not replace the entire page.

## Risks / Trade-offs

- [A large ownership tree makes recursive reads or distinct Bottle matching slow] → Use the owner index, bound page sizes, inspect representative query plans, cache public page reads through existing boundaries, and avoid stored aggregates until measurements justify them.
- [Bad or missing owner links produce an incomplete portfolio] → Present recorded relationships without inference; this change does not silently repair catalog data.
- [One Bottle matches several descendants] → Count and paginate distinct Bottle IDs before serialization.
- [A loop introduced outside the application could make recursion unsafe] → Track visited IDs in the recursive query and retain current write-time loop rejection.
- [Several category sections make long pages] → Keep four-row previews, omit empty kinds, and route complete browsing through one filterable Portfolio collection.

## Migration Plan

1. Add and verify the recursive portfolio read and Company-scoped Bottle filtering without changing existing callers.
2. Add the Portfolio route and Company tab behavior, then switch the Company overview to the new queries.
3. Verify direct-only, nested, deep, empty, and duplicate-Bottle cases with deterministic tests and desktop/mobile browser QA.
4. Deploy without production data writes. If the UI must roll back, restore the previous overview and tabs; the additive read contracts can remain.

## Open Questions

None.
