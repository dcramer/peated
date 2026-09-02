## Context

Country and region detail pages predate the current `PageHeader`, `TabbedPage`, `PageColumns`, and section components. They repeat this structure, keep the map inside the page frame, and show less useful catalog information than entity and series pages.

Location totals also use any related brand, bottler, or distiller address. Peated's identity model treats the distiller as the producer. The current rule can therefore assign a bottle to a place where it was only branded or bottled. Country category counts already use distillers, so the totals can disagree with the category list.

## Goals / Non-Goals

**Goals:**

- Use one explicit production-location rule for stored totals and location lists.
- Add useful country and region overviews and browsable bottle sections.
- Build location pages from the existing shared page components.
- Give maintainers a small Storybook reference for this composition.
- Preserve existing public country and region URLs.

**Non-Goals:**

- A universal catalog page component or configuration system.
- New event, tasting, or inferred geography data.
- Production data writes or stored count updates.
- A redesign of entity, bottle, profile, or series routes.

## Decisions

### Production location follows distillers

A bottle matches a country or region when at least one assigned distillery is in that location. Brand and bottler addresses are excluded. A multi-distillery bottle can match more than one location, and a bottle without a located distillery matches none.

The server will keep this SQL rule in one small helper. Bottle lists, category summaries, and stored count jobs will use it. This keeps the rule consistent without adding a general catalog helper.

Alternative: retain the current union of brand, bottler, and distiller addresses. Rejected because it describes business addresses, not production origin, and cannot reconcile with category summaries.

### Route layouts own page behavior

Country and region layouts will own data loading, edit actions, tabs, and location details. They will use the existing shared page components. Overview, bottle, and distiller pages will load and show their own content.

The country root becomes Overview and keeps `/regions`. Distillers move to `/distillers`; bottles use `/bottles`. The region root becomes Overview, with `/bottles` and `/distillers` children. Existing root URLs remain valid.

Alternative: add a configurable `CatalogPage` component that owns queries and navigation. Rejected because it would mix route behavior into the shared component layer and require options for unlike pages.

### Overview content stays compact and evidence-based

Each overview shows bottle and distillery facts, a category distribution, a location visual, latest releases, and a short distillery list. The side column owns the location visual and category distribution. Country pages also show the existing production-rules summary and leading regions when present. Region pages show other regions in the same country in the side column. Widgets with no data are omitted; numeric facts still show zero.

Country and region previews use one shared `LocationPreviewCard`. Each card owns its available location visual, name, bottle count, optional description, and truncation. Country visuals use country silhouettes. US region visuals use state silhouettes. Other regions use their own verified outlines when available. Regions without an outline omit the visual; they must never substitute the parent country's shape. This rule also applies to the region overview map and demo data. Homepage and country overview grids own only their layout. The location route supplies country-scoped region data and the link to the complete Regions section.

Other overview lists use the catalog-page `PageSection`, `BottleList`, `RailList`, and `TextLink` components. Homepage section wrappers remain owned by the homepage.

The implementation will not add events, tasting demographics, or inferred regional facts because current APIs do not establish those relationships.

### Storybook documents the page structure

A static Storybook story will assemble `PageHeader`, `TabbedPage`, `PageColumns`, facts, sections, and side content. It will show a normal overview and a page with only required information. It will not reproduce API requests, sign-in state, URL search settings, or navigation behavior.

### Stored totals require a separate operation

Changing the stored count job changes future calculations but does not rewrite production data. A later count update must follow the catalog enrichment inventory, evidence, approval, and verification gates. Deployment does not depend on performing that write in this change.

## Risks / Trade-offs

- [Stored totals can temporarily use old semantics] → Do not claim that deployment recomputes them. Record the required follow-up operation and keep queries internally consistent where they calculate live results.
- [Moving distiller lists from root URLs changes bookmarked content] → Preserve the root URLs as useful overviews and expose clear Distillers tabs at stable child URLs.
- [Multi-distillery bottles can appear in several locations] → Treat each location page as a production relationship, not a partition of the global bottle count.
- [More overview queries can increase page work] → Run independent queries in parallel and keep each discovery list to a small first slice.

## Migration Plan

1. Deploy the origin rule, API filters, stored count job changes, and new pages together.
2. Verify country and region pages with live read-only queries and browser QA.
3. Prepare a separate count inventory and request approval before updating production counts.
4. If the UI must roll back, restore the old route content. The additive API filters can remain.

## Open Questions

None.
