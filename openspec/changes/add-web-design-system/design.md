## Context

Peated's web styles are embedded in route and component Tailwind class strings. The current design package only exports Tailwind configuration, the root layout forces a dark palette, and email templates consume the resolved Tailwind theme. The new visual direction defines semantic colors, three type roles, tight radii, tonal structure, and separate light and dark schemes.

The redesign will stay on one long-lived branch but move through small visual-review slices. Existing product behavior and data contracts must remain stable while screens migrate.

## Goals / Non-Goals

**Goals:**

- Make the visual contract authoritative and easy to find.
- Use StyleX for new React component styles.
- Follow the operating system light or dark preference without client theme state.
- Give reviewers a stable Storybook workspace for foundations and component states.
- Encode repeated visual and domain rules in small named components.
- Keep the app usable while product surfaces migrate.

**Non-Goals:**

- Add a product theme picker or persist a theme preference.
- Change API, database, rating, or catalog behavior as part of styling work.
- Create generic layout primitives or a configurable theme framework.
- Move StyleX components into a cross-package library before the web build and test transforms are proven.

## Decisions

### Keep StyleX source in the web app

StyleX token files and React components will live under `apps/web/src` and use a `*.stylex.ts` or `*.stylex.tsx` suffix. Next and PostCSS will use the StyleX SWC integration, while Vitest uses the official Babel transform. This keeps the application on Next's default compiler and avoids unresolved external-package transform behavior in Vitest. `packages/design` will continue to serve its existing email consumers until a later reviewed slice changes that boundary.

### Let the operating system select the color scheme

Semantic color variables will use light defaults and `prefers-color-scheme: dark` overrides. The root document will declare `color-scheme: light dark`. Product surfaces will not use a theme provider, cookie, local storage, hydration script, or theme toggle. Storybook may use its own non-persistent review toolbar to select an explicit scheme for the story canvas.

### Migrate beside Tailwind

StyleX and Tailwind will coexist during migration. A new component will use StyleX on its owned elements and will not mix Tailwind utilities onto those elements. Legacy surfaces will keep their existing classes until their review slice. The web build will not load Tailwind Forms, so it cannot inject native-control visuals into StyleX components. Tailwind can be removed only after its final consumer migrates.

### Cut over one complete route at a time

Product routes will not mix a new page frame with legacy page content. Each
route will keep its current layout until its new StyleX components and product
adapter are ready together. Storybook will render reusable components with
representative data. Route-specific sections and complete page compositions
stay in the application. The product route will supply live data,
authentication, navigation, and mutations and assemble the complete page in one
cutover. When browser hooks are required, a small `*Client` component stays
beside the route. Route-only code does not live in the design-system folders.
Route groups may separate migrated and legacy layouts while work is in progress,
but they will not change public URLs. Migration-only layout scaffolding will be
removed after the final route moves.

### Use Storybook as the living catalog

Storybook will list the implemented shared system in its sidebar. Foundation topics and reusable components grouped by domain render the same tokens and components used by product pages. Each component keeps its story file beside its implementation. A simple component uses one overview story to show its useful static variants together; controls handle arbitrary prop permutations. Separate named stories are reserved for behavior, asynchronous state, permissions, errors, or responsive composition that needs a stable direct review URL. Named behavior stories render their scenario directly and deterministically instead of requiring a reviewer to perform setup interactions. Storybook does not add a product route or appear in product navigation. Groups exist only when they contain a real story.

Stories use one plain canvas treatment for spacing and width. They render each real component without decorative preview chrome. A shared composite component stays in its owning component category. Storybook does not use a pattern category for route-specific sections or complete page compositions; those stay in the application. One Storybook toolbar control changes the full story canvas between light and dark. It keeps no product preference and does not add product theme state.

Stories use plain headings and unnumbered sections. They do not add editorial slogans, status labels, completion counts, planned categories, or placeholder specimens.

Design-system presentation will be reviewed in Storybook with manual browser snapshots at desktop and mobile widths in each color scheme. Named Peated viewport presets cover the full responsive ladder. Direct Folded and Phone toolbar actions select exact review widths. The direct Wide action releases the fixed device frame so bounded components use the available canvas; the exact 1320px Wide checkpoint remains in the viewport menu. Direct Light and Dark actions update the same review-only theme global as the theme menu. It will not use component snapshots or presentation tests.

Storybook will include the accessibility addon as a non-blocking manual review aid. Its local MCP addon will expose component and story manifests to supported agents. React prop metadata will use TypeScript docgen, with concise JSDoc reserved for semantic constraints that types do not explain. Global Autodocs pages remain disabled so agent metadata does not add sidebar clutter. CI will build Storybook as a compile gate.

### Keep component APIs narrow

Components will expose semantic variants and native element props. They will not expose arbitrary design configuration. Parent layouts will wrap components when they need spacing instead of reaching into component internals.

### Migrate admin through one shared workspace

Admin keeps its existing routes, authorization checks, data ownership, and
mutations. A small StyleX workspace owns the responsive navigation rail, mobile
navigation, content width, page headings, sections, and common metadata. Admin
routes reuse the existing Button, DataTable, PageTabs, form, feedback, and
pagination components. Admin-only components are added only for repeated
workspace structure that has no public product meaning. Complete admin pages do
not move into Storybook; only new reusable components receive focused stories.

The migration starts with the workspace and dashboard, then moves through list,
detail, form, and moderation families. Tailwind remains scoped to admin until
the final family moves, then the legacy stylesheet and unused dependencies are
removed together.

Links own visible interaction beyond the browser cursor. Neutral text links move from ink to the deeper accent on hover and to accent while pressed. Linked surface cards and rows step from surface to inset on hover and to accent tint while pressed without moving or gaining elevation. Keyboard focus uses the shared 2px inset ring on the complete actionable surface. Header navigation keeps database destinations available on every page. Its current destination uses ink-colored display type at weight 700 with `aria-current="page"`; the accent rule remains reserved for page tabs.

The rating model separates tasting bands from review scores. `BandMark` accepts one tasting band. `BandStack` accepts five tasting-band counts and never converts them into a point. `Score` accepts a whole-number review median, member and external score counts, and optional low and high scores; it withholds the number below the product floor. Published critic reviews remain attributed records. The interface shows a critic number only when its permitted native score already uses the 100-point scale and never converts another scale. The scoped-search control combines a stationary scope trigger, an over-trigger menu, and a search input. The menu aligns its top and left outer edges with the control, aligns its option labels with the active scope label, lists the scopes directly without a redundant purpose label, and suppresses the query control's active ring while it is open. Pressing the existing query input closes the scope menu and gives query entry control without remounting the input or replacing caller-owned behavior. Query, scope, result, and permission state remain owned by the caller. These contracts preserve product meaning without creating a generic style API.

The search box owns disclosure and keyboard behavior. Up and Down traverse supplied results across groups. Enter selects the active result or submits the query. Escape clears the query before it closes the floating panel, and `/` focuses the field outside editable controls. The 2px active ring is inset from the edge of the 40px scope-and-query control so the field fill remains visible around it, while the open results use only the floating panel shadow. Searching keeps the previous groups visible with a live status line. The caller supplies group order, totals, “See all” destinations, result ranking, contribution permission, and any recent or nearest matches. The component does not fabricate data that the current search API does not return.

Facet rows accept an optional real count and total and calculate their own share when both exist. A count-free row remains an interactive filter without a fabricated statistic. A `null` count means the field is unavailable and disabled. Row menus accept explicit groups of links or actions. The numbered pager accepts explicit page facts and URLs; it does not infer page numbers from the application's cursor pagination contracts.

The bottle catalog route owns API queries, URL filters, and cursor links. Its reusable list and filter components receive resolved records and callback props. Storybook documents those shared components instead of copying route-specific sections or the full product page. The route renders category and age statement as counted facets from the bottle-list response. Age statement uses the API-owned NAS, under-12, 12–17, 18–24, and 25-plus keys; the existing exact-age query remains readable for compatibility and is replaced when a member selects an age band. Full-result totals and facet buckets remain API-owned and never derive from the visible cursor page. The bottle catalog does not offer community score, community verdict, or flavor profile as filters. It keeps cursor actions and does not infer numbered pages from the total.

Public catalog, detail, and member-profile route files own the request-time API reads needed for their indexable content. They pass those results into the same interactive React Query components as initial query state, so the first HTML response contains record names, links, facts, and public activity instead of depending on a streamed loading shell. Anonymous requests use the anonymous server client. Routes that render member-specific bottle state or enforce profile privacy use the session server client only when needed. Secondary detail modules may fail independently and retry on the client without removing the server-rendered identity and primary content.

The distiller, brand, bottler, and blender routes share one client component in their route group and reusable Storybook components. The routes own entity kind, query, location, sort, and cursor URL state. Rows show the resolved Peated ID, kind, location, bottle count, and tasting count. The countries endpoint supplies count-free country choices because it does not own entity facet counts. An active region from an existing URL remains removable without inventing a region result set. The lists show only their visible-page count and supplied Previous or Next cursors. Phone rows keep the bottle count visible while their accessible name retains both real measures. The API cutover from the legacy type filter to kind is tracked in GitHub issue #773.

The signed-out homepage fetches public stats, reviews, countries, Scottish regions, distilleries, recent bottles, and the published median-score ranking through the anonymous server client and hydrates the same React Query keys used by its client components. Highest rated uses the bottle list's `-score` order and `minScore` presence filter, so the route does not derive a ranking or expose a median below the publication floor. The origin directory groups API-owned Scottish regions under Scotland and lists other countries from their real bottle totals. The route remains request-time rendered because the application shell varies by session. Signed-in activity and member data remain client-owned. Both homepage states use the page ground for the application header so the shell reads as one surface; inner routes keep the separate header surface. The signed-out root header shows database navigation and omits its global search because the hero owns the page search. Popularity, annual rankings, critic-source totals, and highest-rated bottles scoped to one distillery wait for the server-owned discovery contract tracked in GitHub issue #781.

The entity detail route family uses one nested route frame for the entity header and tabs. Overview, bottles, tastings, and the optional SMWS codes reference page replace only the selected section. The entity-details response supplies identity, kind, location, ownership, core facts, and bottle totals. Kind is its only entity classification. Small route-local client components handle live queries, URL state, and actions that require browser hooks. Contextual bottle creation maps brand, bottler, and distillery kinds to their matching explicit Bottle field; blender and company records do not infer one. Brand, bottler, distillery, and blender records keep their Bottles or Bottlings section visible when it is empty and offer a button to record a bottle or bottling. The bottle-list response supplies origin, age, ABV, median review score, tasting-band counts, sorting, and cursor pagination. The overview shows those rows directly under its Bottles or Bottlings section without a second list title or a generic catalog summary. The tasting-list response supplies tasting entries and cursor pagination. The SMWS reference page renders the fixed code registry and enriches matching distillers with the existing SMWS endpoint. Company portfolio sections wait for the current-owner list filter tracked in GitHub issue #772 instead of treating bottle relationships as ownership. Storybook documents the reusable entity header, bottle rows, tasting entries, bottle comparison table, and sparse states instead of copying complete routes. The live route omits operating status, still count, capacity, entity-level community measures, and history until an owned API contract supplies those values.

The member profile route family uses one nested frame for the reusable header, summary, privacy boundary, and Tastings, Library, and Activity tabs. The route owns the current session, friendship and moderation actions, API queries, URL cursors, and mutations. User details supply identity and the real tasting, unique-bottle, library, and contribution totals. User tasting stats supply the five tasting-band counts, the tasting list supplies visible records, and the region list supplies the regional rail. The Library list and Library statistics supply bottle rows, producer and status filters, owner mutations, and cursor links. Profile Activity supplies only tasting sessions and collection additions. The profile does not substitute badge levels for passport coverage or invent bio, location, follower, distinct-distillery, or contribution-list data. Those missing contracts are tracked in GitHub issue #774. Storybook documents the reusable profile components instead of copying route-specific sections or complete routes.

Summary strips accept three to five real page facts and reflow without horizontal scrolling. Passports use a discriminated closed-set or open-ended contract so a denominator can appear only when real membership is supplied. Passport components expose tracker nouns and distinct objects, never XP or badge levels.

History timelines accept explicit dated events and an operating or silent state. They do not infer history from the existing entity description or establishment year. Storybook shows the component with realistic supplied events instead of duplicating the complete distillery route. The live entity route waits for an owned API data contract.

The tasting rating input uses the five canonical bands. A tasting does not own a point score. Member review workflows own their separate whole-number 0–100 input. Colour input uses the existing 21-step scale. Picture input delegates native files to its caller. The tasting-form pattern composes these controls without adding fields that the tasting schema does not own.

Actionable empty states own their explanation, next-action slot, and optional supplementary results. Section errors own a recoverable retry action and state what remains available. Loading lists reserve the final row geometry instead of adding a page-level spinner.

The tasting-form pattern keeps one component tree across desktop and mobile viewports. Storybook shows the five-band rating state directly. CSS reflows the rating input and the existing date, serving style, colour, notes, and picture controls without replacing them with a separate compact workflow.

Form support components preserve the owning product contracts. Unit inputs keep their suffix separate from the numeric value. Form steps describe fixed progress without becoming navigation. Duplicate matches offer existing bottle records before creation continues. The member picker selects only supplied friends. The inline note field searches the existing vocabulary and opens the full note browser without creating a second notes contract.

Critic reviews keep their publication attribution and original article link. They show `nativeScore.value` only when `nativeScore.scale` is 100 and omit the number for every other scale. Product copy does not expose a conversion. A selected-bottle summary keeps the current bottle identity visible while a related form is completed. It offers a change action only when the owning workflow allows bottle selection; the tasting form omits it because its bottle is preselected. Neither component invents a new aggregate or identity model.

Bottle identity rows accept Peated's already resolved brand, name, metadata, related-release count, catalog image, and member statuses. They do not reproduce the existing bottle-identity resolver or infer catalog facts. A supplied catalog image takes precedence; the existing Peated bottle glyph is the missing-image fallback. The `isLibrary` and `hasTasted` inputs and their “In Library” and “Tasted” labels retain the current product contract. True states render as 12px muted book and circled-check marks directly after the name. They are facts, not accent-colored controls. False states are absent. Callers omit the marks when the surrounding view already implies the state, including the bottle page, the member's library or tastings, and another member's profile. Selected-bottle summaries and page patterns reuse the same visual instead of drawing decorative placeholder bottles.

The bottle page header keeps one component tree across the responsive ladder. At the 900px folded width, its spec strip moves before its measures and the measures form a two-column row. At the 480px phone width, the identity panel loses its fill and padding, a four-cell spec strip becomes a 2×2 grid, the measures stack, and the action group becomes a fixed bottom bar. Page-action menus keep the row-menu behavior but use a page-sized trigger and open upward from that bottom bar.

The bottle overview keeps collaborative recommendations separate from catalog similarity. Its route client requests the bottle-recommendations endpoint and passes the returned bottles and server-owned reason into the reusable rail. Sparse recommendation data hides the rail instead of falling back to catalog-identity matches. The typed read-only mock implements the same contract with representative bottles so the complete product page remains reviewable without a local database.

Navigation tabs accept destinations and one current URL. Bottle comparison tables compare bottles across exactly two compact measures and replace the desktop header with repeated measure labels on compact screens. Rail lists own their shared surface, dividers, and fixed end slot. The application header keeps one component tree across four layout ranges. Personal links fold into the account menu below 960px, the scope control leaves the constrained field and database navigation scrolls below 760px, and the header becomes one row with drawer and search modes below 560px. Phone search keeps the query field and results and presents the available scopes as a horizontally scrollable chip row below the field. Its one global action is Log a tasting; Record a bottle remains contextual. Account destinations are links, while Sign out is a menu action that calls the existing logout server action instead of issuing a GET request. The application header and reference footer own only their responsive page frame; Peated search, account, routing, and mutation behavior remain with their callers until those product components migrate.

### Keep tasting ratings and review scores separate

Pass/Sip/Savor and the account-level Simple/Advanced choice are superseded. A tasting records one of five trade-aligned bands. A member review records one exact 0-100 score and optional notes for an exact Bottle. Eligible native 100-point external scores can join member review scores in the whole-number median while remaining attributed records. Tasting bands remain ranges and have their own five-bin distribution.

### Resolve baseline conflicts in favor of the living specimen

Controls and buttons use a 3px radius. Chips and small data devices use a 2px radius. A spec strip has no background of its own: up to four equal surface cells sit directly on the page with 6px transparent gaps. Flavor meters and rank numerals are retired because the product does not own the data they imply. Shadows are limited to overlays. These choices match the dominant Peated specimen and the system's non-negotiable rules.

Small row controls use the updated 34px size. A styled select suppresses browser and legacy background indicators when it renders its own caret. A facet row reserves its dismiss slot so selection does not shift data. A row menu opens over its vertical-dots trigger. Numbered pagination appears only where a caller owns a real page count and range.

## Risks / Trade-offs

- [Two styling systems coexist during migration] -> Keep ownership per element explicit, omit Tailwind Forms, and remove legacy utility CSS after the final route consumer migrates.
- [StyleX adds transforms to Next and Vitest] -> Prove development, production build, typecheck, and focused tests in the foundation slice.
- [The Next SWC integration is community-maintained] -> Pin its version, keep the StyleX file boundary explicit, and retain production-build coverage as an upgrade gate.
- [System-only theming cannot honor an in-app override] -> Treat that as an explicit later capability if product requirements change.
- [A long-lived branch can drift from main] -> Start from `origin/main`, keep visual commits small, and integrate main regularly.
- [Storybook can become a second implementation] -> Render exported tokens and components directly and avoid story-only component copies.

## Migration Plan

1. Add the visual contract, StyleX transforms, semantic tokens, typography, base styles, and Storybook foundation story.
2. Review the foundation in system light and dark modes at desktop and mobile widths.
3. Add core controls and their preview states, then review them.
4. Add Peated data and identity components and review them.
5. Migrate navigation and one reference product screen.
6. Review the shared components used by the homepage, then compose them in the
   live homepage and cut over its complete application shell as the first
   public route.
7. Continue screen-by-screen migration with a review checkpoint after each slice.
8. Remove unused Tailwind and legacy design-package code only after all intended consumers migrate.

Rollback is a normal branch revert for each slice. The migration does not change persisted data.

## Open Questions

- Does the admin application migrate to the new visual system, or retain a scoped legacy theme?
- Which product screen follows the bottle page after the core components are approved?
