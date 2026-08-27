## ADDED Requirements

### Requirement: Authoritative visual contract

The repository SHALL contain one maintained visual contract that defines Peated's color, typography, shape, emphasis, density, scoring, and interface rules.

#### Scenario: Contributor needs a design rule

- **WHEN** a contributor implements or reviews a web interface
- **THEN** the contributor can find the current rule in the repository-level design document

### Requirement: System color scheme

The web interface SHALL use semantic tokens with light and dark values selected by the operating system color-scheme preference.

#### Scenario: System uses light appearance

- **WHEN** the browser reports a light color-scheme preference
- **THEN** the interface renders the approved light token values

#### Scenario: System uses dark appearance

- **WHEN** the browser reports a dark color-scheme preference
- **THEN** the interface renders the approved dark token values without client-side theme state

### Requirement: Shared typography

The web interface SHALL provide display, reading, and data type roles that use the approved font families, weights, sizes, line heights, and tracking.

#### Scenario: Component uses a type role

- **WHEN** a component renders a name, readable sentence, or aligned datum
- **THEN** it uses the corresponding shared display, reading, or data role

### Requirement: StyleX component ownership

New design-system components SHALL own their visual styles through StyleX and SHALL expose narrow semantic variants.

#### Scenario: Product screen uses a shared component

- **WHEN** a product screen renders a design-system component
- **THEN** the component applies its owned visual contract without page-local Tailwind styles on the same elements

#### Scenario: Product screen renders a styled select

- **WHEN** a design-system select renders its disclosure caret
- **THEN** it suppresses browser and legacy background indicators and shows exactly one caret in Storybook and product layouts

#### Scenario: StyleX and Tailwind coexist during migration

- **WHEN** a migrated control renders beside legacy Tailwind support
- **THEN** Tailwind utilities remain class-driven and the web build does not load Tailwind Forms or inject its native-control styles into the migrated control

### Requirement: Living design catalog

The web workspace SHALL provide Storybook as a design-system catalog that renders approved foundations and supported component states without adding a product route.

#### Scenario: Reviewer opens the catalog

- **WHEN** a reviewer starts Storybook
- **THEN** the sidebar lists only implemented foundation and component categories

#### Scenario: Reviewer opens a component

- **WHEN** a reviewer opens an implemented component
- **THEN** its named stories render the same exported component states used by product screens

#### Scenario: Reviewer opens a behavior state

- **WHEN** a reviewer opens a named story for an open, focused, loading, empty, error, or other supported behavior
- **THEN** the story renders that scenario directly without requiring setup interactions from the reviewer

#### Scenario: Product route composes catalog components

- **WHEN** a product route assembles reviewed components into a complete page
- **THEN** Storybook documents the reusable components and bounded sections without duplicating the complete route

#### Scenario: Reviewer compares color schemes

- **WHEN** a reviewer selects light or dark in the Storybook toolbar
- **THEN** the direct Light and Dark actions switch the full story canvas and every real specimen to that scheme without changing product theme state

#### Scenario: Category is not implemented

- **WHEN** a category has no real components yet
- **THEN** Storybook does not list it until a real story exists

#### Scenario: Reviewer uses a mobile viewport

- **WHEN** a story renders at a supported mobile width
- **THEN** every specimen remains readable without horizontal page overflow

#### Scenario: Reviewer changes responsive checkpoints

- **WHEN** a reviewer selects Wide, Folded, or Phone from the Storybook toolbar
- **THEN** Wide releases the fixed device frame while Folded and Phone select their named Peated review widths without creating viewport-specific stories

#### Scenario: Reviewer checks accessibility

- **WHEN** a reviewer opens the Storybook accessibility panel
- **THEN** the current story is analyzed without creating a presentation-test gate

#### Scenario: Agent queries the catalog

- **WHEN** a local agent connects to the running Storybook MCP endpoint
- **THEN** it can discover documented components, props, and real story states from the catalog manifest

#### Scenario: Catalog changes reach CI

- **WHEN** a web change runs the CI web-build job
- **THEN** the static Storybook build must compile successfully

### Requirement: Reviewable migration slices

The redesign SHALL migrate through bounded slices that receive desktop, mobile, light, and dark visual review before the next slice begins.

#### Scenario: A slice is ready for review

- **WHEN** its build checks and Storybook states pass
- **THEN** implementation pauses for visual approval before the next component or product surface starts

### Requirement: Complete route cutovers

The redesign SHALL keep each product route on its current layout until the new
page composition and its live product adapter are ready to replace it together.

#### Scenario: A page composition is under review

- **WHEN** a route's new StyleX components are not yet approved or connected to live behavior
- **THEN** Storybook renders those real components and the public route keeps its current layout

#### Scenario: A route is ready to migrate

- **WHEN** the new composition, live data, authentication, navigation, and mutations are ready
- **THEN** the route moves to the new application layout without changing its public URL or mixing legacy and new page content

### Requirement: Responsive application header

The design system SHALL provide one application-header component tree that keeps database navigation, personal navigation, search, the account menu, and the global tasting action reachable at every supported width.

#### Scenario: Header width becomes constrained

- **WHEN** the header crosses its documented 960px, 760px, and 560px layout thresholds
- **THEN** personal links move into the account menu, database navigation scrolls inside its row, and the mobile drawer and search modes appear without separate mobile content

#### Scenario: Member opens mobile navigation

- **WHEN** a member opens the navigation drawer below 560px
- **THEN** the drawer groups database and personal destinations and provides Log a tasting as its only record action

#### Scenario: Member opens mobile search

- **WHEN** a member opens search below 560px
- **THEN** the same search control replaces the header row, focuses the query field, and shows a cancel action and the available scopes in a horizontally scrollable chip row

#### Scenario: Member signs out from the account menu

- **WHEN** a signed-in member chooses Sign out
- **THEN** the account menu invokes the existing logout server action instead of navigating to a GET route

### Requirement: Scoped search experience

The design system SHALL provide a scoped search experience that presents caller-supplied result groups and owns consistent disclosure and keyboard behavior.

#### Scenario: Member opens the scope menu

- **WHEN** the member opens the scope menu
- **THEN** the menu opens over the scope trigger without moving it, aligns its top and left outer edges with the control, aligns its option labels with the active scope label, keeps its divided header within the control's 40px outer height, suppresses the query control's active ring, and lists the available scopes without a redundant purpose heading

#### Scenario: Search is active

- **WHEN** the search control has focus or displays its results surface
- **THEN** its 2px active ring is inset from the edge of the 40px scope-and-query control with visible field fill around it instead of stretching around the results

#### Scenario: Member returns to query entry

- **WHEN** the scope menu is open and the member presses the query input
- **THEN** the scope menu closes and the existing query input receives focus without losing its value or caller-owned behavior

#### Scenario: Member navigates grouped results

- **WHEN** the search overlay is open and the member presses Up or Down
- **THEN** the active result moves across supplied groups without selecting group headings or the contribution action

#### Scenario: Member confirms or dismisses search

- **WHEN** the member presses Enter or Escape
- **THEN** Enter selects the active result or submits the query, while Escape clears a non-empty query before it closes an empty search

#### Scenario: A replacement query is loading

- **WHEN** the caller marks search as loading while previous results exist
- **THEN** the previous groups remain visible with a live searching status instead of being replaced by a spinner

#### Scenario: Search data is incomplete

- **WHEN** the caller does not supply totals, nearest matches, recent queries, or contribution permission
- **THEN** the component does not infer those values or render actions that require them

### Requirement: Domain-owned tasting inputs

The design system SHALL provide verdict, score, colour, and picture inputs that preserve the existing tasting schema and rating-population boundaries.

#### Scenario: Member records a verdict

- **WHEN** a member selects Pass, Sip, or Savor
- **THEN** the verdict input emits that domain value or null and does not invent a numeric score

#### Scenario: Member records a score

- **WHEN** a member changes the community score
- **THEN** the score input emits a whole number from 0 through 100 or null and shows the canonical score band

#### Scenario: Member records colour or a picture

- **WHEN** a member uses the colour or picture input
- **THEN** the component emits the existing 0–20 colour value or native selected files without defining a new product field

### Requirement: Sourced entity history

The design system SHALL render supplied entity history in chronological order and SHALL distinguish operating and silent periods without relying on colour alone.

#### Scenario: Reviewer opens a distillery history

- **WHEN** dated history events include operating-state values
- **THEN** the timeline shows the date, event content, state spine, accessible state text, and supplied summary

#### Scenario: Live entity data has no history events

- **WHEN** the entity API does not supply an owned history collection
- **THEN** the product route does not derive or invent timeline events from other entity fields

### Requirement: Module-owned feedback states

The design system SHALL provide actionable empty states, final-geometry loading rows, and recoverable errors that remain inside their owning module.

#### Scenario: Search has no matching records

- **WHEN** a search returns no results
- **THEN** the empty state explains the result, offers an allowed next action, and can keep nearby matches visible

#### Scenario: A record list is loading

- **WHEN** record rows have not loaded yet
- **THEN** the loading state reserves the final thumbnail, copy, metadata, and score geometry without a page spinner

#### Scenario: One module fails

- **WHEN** a recoverable request fails inside one module
- **THEN** the error states what still works and offers a tonal retry action without replacing the page

### Requirement: Global loading feedback

The design system SHALL provide a minimal full-viewport Peated frame for the root route loading boundary.

#### Scenario: The root route boundary is in flight

- **WHEN** no useful route frame can render yet
- **THEN** the viewport centers the Peated wordmark and its 2px accent rule, draws them from left to right, holds the completed mark, and repeats the 2.6-second cycle without application chrome or a spinner

#### Scenario: Motion is reduced

- **WHEN** the browser requests reduced motion
- **THEN** the completed wordmark and rule remain visible without animation

### Requirement: Page-level recovery states

The design system SHALL provide page-level not-found, forbidden, captured-failure, and offline patterns without inventing product recovery capabilities.

#### Scenario: The application shell cannot render

- **WHEN** a route needs a page-level recovery state, including a global 404 or root-layout failure
- **THEN** the state uses a minimal recovery shell, and the global document does not depend on session loading, application providers, analytics, the application header, or the footer

#### Scenario: A route is not found or forbidden

- **WHEN** a route returns 404 or a signed-in member receives 403
- **THEN** the page explains the navigation or permission state, offers a valid next destination, and does not present the response as a captured application failure

#### Scenario: A signed-out member needs access

- **WHEN** a route requires authentication and no member session exists
- **THEN** the page offers sign-in with a return to the requested address instead of presenting a forbidden state

#### Scenario: A page failure is captured

- **WHEN** the route cannot render because of an application failure
- **THEN** the page offers retry and may show a safe incident reference and caller-supplied production stack trace after the owning error boundary removes request bodies, account data, and other sensitive context

#### Scenario: The application is offline

- **WHEN** Peated cannot reach the database
- **THEN** the page states which current actions require a connection and does not claim that work is queued or saved unless a real persistence contract supplies that state

### Requirement: Responsive tasting structure

The design system SHALL use one tasting-form component tree across desktop and mobile viewports.

#### Scenario: Reviewer changes the viewport

- **WHEN** the tasting-form story changes between desktop and mobile widths
- **THEN** the same form controls reflow without switching to a separate mobile component

#### Scenario: Member opens the tasting form

- **WHEN** the member's account is configured for community verdicts or community scores
- **THEN** the form renders only that rating input and does not offer an in-form rating-system picker

#### Scenario: Required tasting input is missing

- **WHEN** no verdict is selected
- **THEN** the save action is disabled and nearby status text states what is required

#### Scenario: Member completes an optional field

- **WHEN** the member changes date, serving style, colour, notes, or picture input
- **THEN** the same field contract is used at every supported viewport without creating a new product field

### Requirement: Form support components

The design system SHALL provide reusable unit, progress, duplicate-match, note-vocabulary, friend-selection, and selected-bottle controls that preserve their owning product contracts.

#### Scenario: Contributor enters a measured bottle fact

- **WHEN** a numeric bottle field has a fixed unit
- **THEN** the control keeps the numeric value editable and the unit visible but not editable

#### Scenario: Contributor may be creating a duplicate

- **WHEN** matching bottle records are supplied
- **THEN** the duplicate-match component identifies each record and lets the contributor select it before continuing

#### Scenario: Member records notes and friends

- **WHEN** a member searches tasting notes or drinking companions
- **THEN** the controls select from the supplied note vocabulary and friend results without inventing a second data contract

#### Scenario: Member opens a tasting for a preselected bottle

- **WHEN** the tasting workflow supplies its bottle before the form renders
- **THEN** the selected-bottle summary keeps that identity visible without offering a change action

### Requirement: Attributed critic reviews

The design system SHALL preserve each published critic review's publication and native score scale.

#### Scenario: Publication uses a non-100-point scale

- **WHEN** a critic review supplies a native score such as 4.5/5
- **THEN** the component displays that native score and does not relabel it as a published 100-point score or merge it into an aggregate

### Requirement: Bottle identity presentation

The design system SHALL present bottle identity using Peated's resolved catalog data and existing member-status meanings.

#### Scenario: Catalog image is available

- **WHEN** a caller supplies a bottle image, resolved identity, metadata, and member statuses
- **THEN** the bottle identity row displays those values without recomputing identity or changing the existing `isLibrary`, `hasTasted`, “In Library,” or “Tasted” contracts

#### Scenario: Catalog image is unavailable

- **WHEN** a bottle record has no image
- **THEN** the row uses Peated's existing bottle glyph instead of a decorative placeholder or invented bottle art

#### Scenario: Member state applies to a general list

- **WHEN** a general bottle list supplies a true `isLibrary` or `hasTasted` state
- **THEN** the row shows its 12px muted book or circled-check mark directly after the bottle name
- **AND** a false state renders no mark
- **AND** the marks are not controls

#### Scenario: The view already implies member state

- **WHEN** a bottle appears on its own page, in the member's library or tastings, or on another member's profile
- **THEN** the caller omits the personal-state marks

### Requirement: Responsive bottle header

The design system SHALL keep bottle identity, specs, community measures, member status, and record actions in one responsive header component tree.

#### Scenario: Bottle header reaches the folded width

- **WHEN** the header viewport is 900px or narrower
- **THEN** the spec strip follows the identity and the available community measures follow it in two columns

#### Scenario: Bottle header reaches the phone width

- **WHEN** the header viewport is 480px or narrower
- **THEN** the identity loses its panel fill and padding, four specs reflow to two rows, measures stack without horizontal overflow, and the record actions remain reachable in a bottom action bar

### Requirement: Bottle recommendation rail

The bottle page SHALL use the server-owned collaborative recommendation result without substituting catalog similarity for sparse community data.

#### Scenario: Collaborative recommendations are available

- **WHEN** the bottle-recommendations endpoint returns bottles and its explanation
- **THEN** the bottle overview shows those bottles under “If you liked this” and displays the supplied explanation

#### Scenario: Collaborative recommendations are sparse

- **WHEN** the bottle-recommendations endpoint returns no bottles
- **THEN** the recommendation rail is absent and the page does not fall back to catalog-identity matches

### Requirement: Bottle catalog route

The web application SHALL compose the bottle catalog from reusable StyleX list and filter patterns while the product controller owns API and URL state.

#### Scenario: Member browses a cursor page

- **WHEN** the bottle-list API supplies records and previous or next cursors
- **THEN** the catalog shows the visible records, their real current-page count, and only the available cursor actions without inventing a total or numbered pages

#### Scenario: Member filters bottles on a narrow screen

- **WHEN** the viewport cannot hold the filter rail beside the catalog
- **THEN** the same filters remain reachable in a disclosure and continue to write their values to the route URL

#### Scenario: Bottle facet data is available

- **WHEN** the API supplies a full-result total and stable category and age-statement buckets
- **THEN** the filter rail renders category and age statement as real facets, uses NAS, under-12, 12–17, 18–24, and 25-plus age rows, and does not offer community-score, community-verdict, or flavor-profile filters

#### Scenario: Bottle facet data is unavailable

- **WHEN** the API does not supply full-result facet counts
- **THEN** the product route renders a count-free category facet instead of deriving statistics from the visible cursor page and does not offer community-score or community-verdict filters
