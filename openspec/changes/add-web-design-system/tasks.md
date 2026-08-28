## 1. Foundation preview

- [x] 1.1 Add the authoritative repository `DESIGN.md` and resolve baseline conflicts
- [x] 1.2 Configure StyleX compilation for Next.js and Vitest while Tailwind remains available
- [x] 1.3 Add system-driven light and dark tokens, approved fonts, and base document styles
- [x] 1.4 Add the Storybook foundation preview
- [x] 1.5 Run focused build checks and visual QA at desktop and mobile widths in both system schemes
- [x] 1.6 Organize the Storybook sidebar and foundation stories
- [x] 1.7 Review and approve the Storybook foundation with the product owner
- [x] 1.8 Remove Tailwind Forms while legacy utility consumers remain

## 2. Core controls

- [x] 2.1 Add button and icon-button components with complete interaction states
- [x] 2.2 Add field, text-input, textarea, and validation-message components
- [x] 2.3 Add chip, count-chip, and section-heading components
- [x] 2.4 Add overlay-surface and loading-placeholder components
- [x] 2.5 Add core-control stories to Storybook
- [x] 2.6 Review and approve core controls at desktop and mobile widths in both system schemes
- [x] 2.7 Add the scoped-search component and its Storybook states
- [x] 2.8 Review and approve scoped search at desktop and mobile widths in both system schemes
- [x] 2.9 Add actionable empty, module-error, and row-geometry loading components
- [x] 2.10 QA the feedback states at desktop and mobile widths in both system schemes
- [x] 2.11 Add the grouped search-results panel and complete scoped-search keyboard and disclosure behavior
- [x] 2.12 QA grouped, loading, empty, error, scope-menu, keyboard, and compact search states in both schemes
- [x] 2.13 Add and QA the settled pending-button treatment in the core control and tasting-form stories
- [x] 2.14 Keep the scoped-search trigger stationary and remove the redundant scope-menu heading
- [x] 2.15 Inset the search active ring from the 40px control edge and expose focused and open states in Storybook
- [x] 2.16 Add a deterministic scope-menu story, align its frame and labels to the control, match its divided header to the 40px control, and suppress the query active ring while that menu is open
- [x] 2.17 Close the open scope menu when the member presses the query input without replacing the input or caller-owned pointer behavior
- [x] 2.18 Make the compact sort select own one disclosure caret in Storybook and product layouts

## 3. Peated data components

- [x] 3.1 Add the record ID and max-four spec strip; retire flavor meters and rank numerals
- [x] 3.2 Add community-score and verdict-distribution components using the existing rating populations
- [x] 3.3 Add data-component stories to Storybook
- [x] 3.4 Review and approve the reconciled record ID and spec strip at desktop and mobile widths in both system schemes
- [x] 3.5 Add the positional verdict-mark component and its Storybook states
- [x] 3.6 Review and approve Score, BandStack, and BandMark at desktop and mobile widths in both system schemes
- [x] 3.7 Add facet-row, row-menu, and numbered-pager components from the updated reference package
- [x] 3.8 Review and approve facet row, row menu, and pager at desktop and mobile widths in both system schemes
- [x] 3.9 Add summary-strip and passport components from the updated reference package
- [x] 3.10 Review and approve summary strip and passport at desktop and mobile widths in both system schemes
- [x] 3.11 Add navigation tabs, bottle comparison tables, list controls, rail lists, the application-header frame, and the reference footer
- [x] 3.12 QA the complete reusable baseline at desktop and 320px widths in both system schemes
- [x] 3.13 Add the entity history timeline and realistic supplied-history stories
- [x] 3.14 Review history states at desktop and mobile widths in both system schemes
- [x] 3.15 Add attributed 100-point critic reviews and the selected-bottle summary
- [x] 3.16 Add the settled responsive application-header component and compact scoped-search mode
- [x] 3.17 Review the application header at all four responsive ranges in both system schemes
- [x] 3.18 Reconcile bottle identity rows and selected-bottle visuals with Peated's catalog image and member-status contracts
- [x] 3.19 QA bottle identity image, fallback, long-name, status, and selected-bottle states at desktop and compact widths in both schemes
- [x] 3.20 Review and approve the bottle identity component in Storybook
- [x] 3.21 Align library and tasted list marks with the settled 12px muted inline treatment
- [x] 3.22 Focus the mobile header search when it opens and QA its active Storybook state
- [x] 3.23 Replace community-score and verdict devices with Score, BandStack, and BandMark using the separate review-score and tasting-rating model
- [x] 3.24 Define and apply shared hover, pressed, and keyboard-focus treatments to linked text, cards, and rows

## 4. Pickers and forms

- [x] 4.1 Add the entity-picker component and keyboard behavior
- [x] 4.2 Add the note-picker component and selection behavior
- [x] 4.3 Rebuild shared form surfaces with the approved controls
- [x] 4.4 Review and approve form components at desktop and mobile widths in both system schemes
- [x] 4.5 Add tasting rating, 0–20 colour, and picture inputs using the existing tasting contracts
- [x] 4.6 Replace speculative tasting-form fields with a composition of fields owned by the tasting schema
- [x] 4.7 QA the new tasting inputs and composed form at desktop and mobile widths in both system schemes
- [x] 4.8 Keep one responsive tasting-form composition across desktop and mobile viewports
- [x] 4.9 Add unit inputs, fixed form progress, duplicate matches, friend selection, and the inline note vocabulary field
- [x] 4.10 QA the completed form-support component baseline at desktop and mobile widths in both system schemes
- [x] 4.11 Align the tasting rating input with the settled responsive tasting-input artifact
- [x] 4.12 Review and approve both configured tasting-form stories
- [x] 4.13 Replace the old verdict and point controls with the five-band RatingBandInput
- [x] 4.14 QA the rating input at desktop and phone widths in both schemes

## 5. Navigation and reference screen

- [x] 5.1 Rebuild the application header and responsive navigation
- [x] 5.2 Rebuild the bottle page with approved design-system components and existing data fetching
- [x] 5.3 Add thin-data, loading, empty, and module-error states
- [x] 5.4 Run bottle-page route and manual smoke checks
- [x] 5.5 Review and approve navigation and the bottle page at desktop and mobile widths in both system schemes
- [x] 5.6 Connect the bottle overview rail and typed page mock to the collaborative recommendation endpoint

## 6. Remaining migration

- [x] 6.1 Migrate search and comparison-table surfaces
- [x] 6.2 Migrate entity pages and their composition variants
- [x] 6.3 Migrate tasting and bottle-entry workflows
- [x] 6.4 Migrate remaining public pages in bounded visual-review slices
- [x] 6.5 Keep Tailwind scoped to admin and load StyleX alone on public layouts
- [x] 6.6 Remove styling dependencies and compatibility code with no remaining consumers
- [x] 6.7 Run full web validation and final desktop and mobile visual QA
- [x] 6.8 Review the shared components used by the homepage in Storybook, then connect the homepage through thin product adapters
- [x] 6.9 Compose and cut over `/` and its complete application layout together without duplicating the full page in Storybook or changing its public URL
- [x] 6.10 Migrate login and registration with one shared authentication layout, existing authentication behavior, and focused component stories
- [x] 6.11 Migrate recovery, verification, terms, browser-support, and OAuth consent states onto the shared authentication layout
- [x] 6.12 Reconcile the signed-in homepage widgets with the approved Home concepts and live product contracts
- [x] 6.13 Join the header search field and results into one typeahead surface and align its real product scopes
- [x] 6.14 Align the shared footer frame with the header and main page content
- [x] 6.15 Add shared 404, forbidden, page-failure, and offline patterns from the approved error concepts
- [x] 6.16 Migrate route error boundaries and not-found responses without weakening Sentry reporting or section-error ownership
- [x] 6.17 Add the centered global loading frame and connect it at the root route boundary without application chrome or a spinner
- [x] 6.18 Review global loading at desktop and mobile widths in both system schemes
- [x] 6.19 Migrate the bottle catalog with real list data, URL-owned filters, cursor navigation, and bounded Storybook patterns
- [x] 6.20 Review and approve the bottle catalog at desktop and mobile widths in both system schemes
- [x] 6.21 Remove the bottle catalog's flavor-profile filter and render count-optional facets in the app and Storybook
- [x] 6.22 Connect real bottle totals, facet counts, and age-statement facet filtering after API issue #762 lands
- [x] 6.23 Remove community-score and community-verdict filtering from the bottle catalog and its Storybook pattern
- [x] 6.24 Migrate distiller, brand, and bottler catalogs with one shared route client, URL-owned filters, cursor pagination, and bounded Storybook states
- [x] 6.25 Migrate the entity overview route with route-owned behavior, kind-specific presentation, live details, bottle-list-backed rows and empty states, a reusable entity header, and bounded Storybook states
- [x] 6.26 Replace the migrated entity catalogs' legacy type filter with the API-owned kind filter after issue #773 lands
- [x] 6.27 Migrate the entity route frame, bottle list, tasting list, and SMWS codes sections with live API state, responsive StyleX composition, and reusable Storybook-owned components
- [x] 6.28 Migrate the public member profile with API-owned summary, rating, tasting, region, privacy, and action state plus reusable profile-header stories
- [x] 6.29 Complete the member profile route family with one nested frame, API-owned Library filters and owner actions, Activity records, cursor navigation, and bounded Storybook patterns
- [x] 6.30 Cut over `/search` with grouped API results, preserved bottle-selection intents, and the redesign application layout
- [x] 6.31 Seed public bottle, entity, and member-profile catalogs, details, and tabs from request-time server reads so their indexable content is present before hydration
- [x] 6.32 Merge the signed-in and signed-out homepage header with the page ground while preserving the separate header surface on inner routes
- [x] 6.33 Migrate the blender catalog through the shared entity-list route and stable database navigation
- [x] 6.34 Revise the homepage with API-owned country and Scottish-region discovery while leaving unsupported ranking modules behind issue #781
- [x] 6.35 Center the bounded content column across the shared page-level recovery states and render that real shell in their existing Storybook states
- [x] 6.36 Show only the Sentry event ID returned by route-error capture, use concise reference copy, and expose copying as an icon button instead of a reporting state or Next-digest fallback
- [x] 6.37 Simplify critic reviews to permitted native 100-point values and omit other scales without conversion copy
- [x] 6.38 Connect the landed tasting-band and review-score contract across live routes, shared components, structured data, and Storybook
- [x] 6.39 Add the SSR-hydrated Highest rated homepage module from the published median-score list, omit source-scale explainer copy, and keep critic-review dates on one line

## 7. Storybook tooling

- [x] 7.1 Add the accessibility and MCP addons with typed component manifests
- [x] 7.2 Add Storybook rules to Oxlint and scoped web-agent guidance
- [x] 7.3 Add the Storybook production build to the web CI gate
- [x] 7.4 Verify lint, typecheck, the production build, MCP manifests, and the accessibility panel
- [x] 7.5 Add Peated responsive and theme review presets with direct Wide, Folded, Phone, Light, and Dark toolbar actions
- [x] 7.6 Make named behavior stories render their review state without manual setup interactions
- [x] 7.7 Consolidate static component permutations into overview stories while preserving direct behavior states
- [x] 7.8 Replace vague implementation names with Peated concepts and plain UI nouns across components and Storybook

## 8. Admin migration

- [x] 8.1 Add the shared responsive StyleX admin workspace and focused Storybook story
- [x] 8.2 Move the existing admin landing behavior into the shared workspace without inventing a dashboard
- [x] 8.3 Migrate admin list routes onto shared tables, filters, empty states, and cursor controls
- [x] 8.4 Migrate admin detail routes and nested tabs onto shared headers, facts, sections, and actions
- [x] 8.5 Migrate admin add and edit routes onto the shared workflow and form components
- [x] 8.6 Migrate moderation routes while preserving their operational behavior and dense review states
- [x] 8.7 Remove the admin legacy stylesheet and unused Tailwind dependencies
- [x] 8.8 Run web validation and review admin at desktop and phone widths in both system schemes
