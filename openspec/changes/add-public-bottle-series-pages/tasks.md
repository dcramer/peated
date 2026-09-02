## 1. Public Series identity and lifecycle

- [x] 1.1 Extend Peated IDs, Series schemas, serializers, and details reads with public Series identity and Brand context.
- [x] 1.2 Add Bottle Series tombstones and generate the database migration.
- [x] 1.3 Guard Series deletion, implement same-Brand Series merging, and test assignment, count, change-log, and tombstone behavior.

## 2. Series discovery

- [x] 2.1 Add Series groups, facets, nearest matches, and exact Peated ID resolution to the global search contract and server query.
- [x] 2.2 Render Series results and scope controls in web search with canonical links and focused tests.

## 3. Public Series routes

- [x] 3.1 Add canonical Series URL helpers, stale/merged/root-ID redirects, metadata, and sitemap support.
- [x] 3.2 Build the responsive Series detail page from shared page, Bottle list, sorting, pager, error, and empty-state components.

## 4. Bottle overview integration

- [x] 4.1 Extract a reusable Bottle rail section from the existing recommendation presentation.
- [x] 4.2 Add the linked Series fact and other-Series-Bottles rail with a canonical see-all destination and partial-failure handling.

## 5. Verification and documentation

- [x] 5.1 Update the Peated ID architecture documentation for Series identity and lifecycle.
- [x] 5.2 Run focused server and web tests, typechecks, lint, formatting, and OpenSpec validation.
- [x] 5.3 Verify the Series page and Bottle widget at desktop and mobile widths with production-shaped Series data.

## 6. Series overview and Library progress

- [x] 6.1 Add signed-in Library filtering to the Bottle list API with focused tests.
- [x] 6.2 Move Series identity and counts above the Bottle list, then add the Library count and filters.
- [x] 6.3 Omit empty ratings from shared Bottle lists and keep long page titles inside narrow screens.
- [x] 6.4 Run focused tests, typechecks, lint, formatting, and desktop and mobile UI checks.

## 7. Series overview facts

- [x] 7.1 Present Series counts with the compact overview facts used on Bottle and Entity pages, then verify desktop and mobile layouts.

## 8. Series Distilleries

- [x] 8.1 Add the full-Series Distillery breakdown to the side rail with a short expandable preview, focused tests, and desktop and mobile UI checks.
- [x] 8.2 Match the established Bottle rail collection pattern and add Storybook examples for linked and expandable rail sections.
- [x] 8.3 Place rail collection actions below their headings and match the established text-link treatment.
