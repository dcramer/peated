# Entity Pages

A distillery, brand, bottler, or company has one main page, its Overview. It
shows what Peated holds for the Entity: its sourced history, its Bottles, and
the people drinking them. Other tabs hold full lists: Bottles, Series,
Reviews, and a company's Portfolio.

The About document (see [Entity About Pages](entity-about.md)) has no page of
its own. Its parts sit on the Overview among the catalog lists. Old `/about`
links redirect to the Overview.

## Order

Each part is hidden when it has nothing to show. The main column reads top to
bottom:

1. The About lead, with its sources.
2. The timeline of names and producing years.
3. A short catalog band: a company's brands, distilleries, and bottlers;
   latest releases; Series; other bottlings.
4. The History: the About sections, then the vintage and release-year charts.
   The first 3 sections show; the rest wait behind a "Show the full history"
   button and stay in the page's HTML.
5. Recent activity.
6. Sources: a count and the date they were checked. The list opens with a
   button, or when a reader follows a citation number to it.

The sidebar holds facts to check at a glance:

1. Images, or a placeholder.
2. Facts: origin, status, founding year, owner, website, short name, then the
   About document's sourced facts.
3. Owners over time.
4. Map, flavor profile, the distilleries or bottlers behind its Bottles, and
   other Entities with the same owner.

On phones the parts stack in one column: lead, images, facts, timeline,
catalog band, History, activity, sidebar lists, then Sources.
`EntityOverviewLayout` in
`apps/web/src/app/(app)/entities/[entityId]/entityOverviewLayout.stylex.tsx`
owns this order.

## One Of Each

The page states each thing once:

- One summary. When the About document shows, its lead opens the Overview and
  the header leaves out the Entity's description there. Other tabs keep the
  description.
- One founding year. A sourced founding year replaces the stored one.
- One list of distilleries or bottlers, in the sidebar.
- One history. The About document is the Entity's public history. Moderators'
  history items (`entity_event`) are not shown; the About writer reads them as
  leads.

Entities without a shown About document show the same page without its parts.
