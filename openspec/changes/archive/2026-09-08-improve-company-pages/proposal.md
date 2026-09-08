## Why

Company overviews expose only a four-item preview of directly owned Entities, so a company with a meaningful ownership chain appears to have a small or empty whisky portfolio. Visitors should be able to understand and browse the complete whisky portfolio without knowing the corporate structure stored between the company and its brands or producers.

## What Changes

- Add a company portfolio read that follows the existing current-owner chain and returns descendant whisky Entities with their ownership path.
- Keep the existing Brands and Distilleries sections, but populate them from the complete descendant portfolio and show exact totals.
- Separate recursive Bottlers from directly owned Companies so the page does not mix whisky roles with company structure.
- Give Company pages a Bottles section whose count and results cover distinct active Bottles associated with the company or any descendant portfolio Entity.
- Replace silent four-item truncation with explicit totals and links to complete, paginated portfolio and Bottle collections.
- Preserve the current Entity kinds, single `ownerId`, owner history, Company records, IDs, URLs, and ownership data.
- Omit empty optional sections and keep failures local to the section that could not load.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `entity-identity`: Expand Company page behavior from direct-owned previews to a complete descendant whisky portfolio while retaining direct company relationships as supporting group structure.

## Impact

- Entity and Bottle list contracts and server routes need company-descendant filters and distinct totals.
- Company overview queries, tabs, the nested Portfolio collection, mock API data, and focused web tests will change.
- Existing shared page sections, Entity rows, Bottle rows, and pagination controls will be reused; the visual design system and ownership model do not change.
- No migration, backfill, production catalog write, dependency, or public URL replacement is required.
