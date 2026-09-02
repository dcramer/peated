## Why

Country and region pages use a one-off layout and expose less catalog context than other detail pages. Their bottle totals also use brand and bottler addresses as origin, which can make location pages internally inconsistent.

## What Changes

- Define bottle production location from the assigned producing distilleries. Brand and bottler addresses do not establish origin.
- Add country and region bottle queries and category summaries that use the same production-location rule.
- Give country and region pages a shared detail structure with overview, bottles, and distillers sections. Keep the existing country regions section.
- Add compact overview content: catalog facts, bottle categories, a map, production rules when available, latest releases, and the most recorded distilleries.
- Show a country's leading regions in the main overview column with the same region cards used on the homepage.
- Add a Storybook example for catalog detail pages using the existing page components.
- Keep the production count update outside this change. It requires the catalog operation inventory, approval, and verification gates.

## Capabilities

### New Capabilities

- `location-catalog-pages`: Defines location origin, location catalog queries, and the country and region detail-page behavior.
- `catalog-detail-composition`: Defines how catalog detail pages use the shared components and Storybook example.

### Modified Capabilities

None.

## Impact

- Server bottle lists, country and region category lists, and stored count jobs.
- Country and region web routes and their shared location page components.
- Shared web page-layout documentation and Storybook stories.
- Existing stored country and region bottle totals will need a separately approved recomputation after deployment.
