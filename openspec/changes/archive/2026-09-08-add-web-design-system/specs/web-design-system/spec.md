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

#### Scenario: Styling migration completes

- **WHEN** the final route consumer migrates
- **THEN** the web app removes Tailwind packages, configuration, utility-class helpers, and obsolete Tailwind-owned components

### Requirement: Living design catalog

The web workspace SHALL provide Storybook as a design-system catalog that renders approved foundations and supported component states without adding a product route.

#### Scenario: Reviewer opens the catalog

- **WHEN** a reviewer starts Storybook
- **THEN** the sidebar lists only implemented foundation and component categories

#### Scenario: Reviewer opens a component

- **WHEN** a reviewer opens an implemented component
- **THEN** its overview renders useful static variants together from the same exported component used by product screens

#### Scenario: Component has simple prop permutations

- **WHEN** sizes, labels, item counts, selected values, or other static props do not create distinct behavior
- **THEN** the catalog presents them in the component overview or controls instead of adding sidebar stories

#### Scenario: Reviewer opens a behavior state

- **WHEN** a behavior, asynchronous state, permission boundary, error, or responsive composition needs isolated review
- **THEN** the story renders that scenario directly without requiring setup interactions from the reviewer

#### Scenario: Reviewer inspects a shared interaction treatment

- **WHEN** a shared component owns hover, pressed, and keyboard-focus styles
- **THEN** one behavior story pins those real pseudo states on the product component for direct visual review

#### Scenario: Product route composes catalog components

- **WHEN** a product route assembles reviewed components into a complete page
- **THEN** Storybook documents the reusable component contracts while route-specific sections and the complete composition remain in the application

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

### Requirement: Visible link interaction

Links and linked surfaces SHALL communicate hover, pressed, and keyboard-focus states without relying on the pointer cursor or changing layout geometry.

#### Scenario: Member points to a text link

- **WHEN** a neutral text link is hovered or pressed
- **THEN** it uses the deeper accent and a 1px underline on hover, then the accent on press, without changing its dimensions

#### Scenario: Member points to a linked card or row

- **WHEN** a linked surface is hovered, pressed, or receives keyboard focus
- **THEN** it steps from surface to inset on hover, uses accent tint while pressed, and puts the shared inset focus ring around the complete actionable surface

#### Scenario: Member points to a plain linked row

- **WHEN** a linked row sits directly on the page ground
- **THEN** its interaction surface extends 12px past the text grid on both sides while equal inner padding keeps its content aligned and its layout dimensions stable

#### Scenario: A linked row contains another action

- **WHEN** a record row has a primary destination plus a secondary link, menu, or button
- **THEN** the primary destination remains the default for the row surface while the nested action keeps its own destination or behavior
- **AND** every linked record row uses the same tonal hover, pressed, and keyboard-focus treatment

#### Scenario: A table row has a primary destination

- **WHEN** a bottle row or semantic table row represents a record with a destination
- **THEN** the complete row uses that destination and the shared hover, pressed, and keyboard-focus treatment
- **AND** links, buttons, and menus inside the row remain independent actions
- **AND** rows without a destination do not present a linked-row hover treatment

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
- **THEN** Storybook renders the reusable component contracts, the route composition is reviewed in the application, and the public route keeps its current layout

#### Scenario: A route is ready to migrate

- **WHEN** the new composition, live data, authentication, navigation, and mutations are ready
- **THEN** the route moves to the new application layout without changing its public URL or mixing legacy and new page content

#### Scenario: An anonymous visitor opens the homepage

- **WHEN** the visitor has no session
- **THEN** public homepage data is fetched through the anonymous server client and hydrated into the matching client queries, the route remains request-time rendered, and the header shows database navigation without duplicating the hero search

#### Scenario: Homepage production data is sparse

- **WHEN** the signed-out homepage introduces the database
- **THEN** the introduction describes browsable records without claiming complete coverage or requiring a large total to make the product sound useful
- **AND** factual search, directory, and statistics modules may show the real totals they own

#### Scenario: A member opens the homepage

- **WHEN** the visitor has a session
- **THEN** member activity and personalized homepage data remain client-owned and the application header keeps its global search

#### Scenario: An anonymous visitor browses homepage origins

- **WHEN** the countries and Scottish regions endpoints return public records
- **THEN** the homepage shows the three largest countries as map tiles, combines the remaining returned country records into one real total, and lists the four largest supplied Scottish regions below them
- **AND** the interface does not infer regional membership or counts

#### Scenario: A bottle row shows ratings

- **WHEN** a bottle supplies five tasting-band counts and an optional published median and score range
- **THEN** one compact measure keeps all five bands visible, reserves the withheld median slot, and exposes the full counts and range to assistive technology
- **AND** the interface does not merge tasting bands into review scores

#### Scenario: An anonymous visitor sees the highest-rated bottles

- **WHEN** the bottle list supplies published median scores in descending score order
- **THEN** the homepage renders those bottles as Highest rated and hydrates the matching client query
- **AND** the interface does not derive the ranking

#### Scenario: The homepage shell renders

- **WHEN** a signed-in or signed-out visitor opens the homepage
- **THEN** the application header uses the page ground so it reads as one surface with the homepage while inner routes retain the separate header surface

#### Scenario: A crawler opens a public catalog or detail page

- **WHEN** an anonymous request opens a bottle catalog, entity catalog, bottle detail, entity detail, public entity tab, or public member-profile tab
- **THEN** the route fetches its indexable records through the anonymous server client and includes their names, links, facts, and available public activity in the first HTML response
- **AND** the interactive client component receives that same result as its initial query state instead of making a loading shell the route's only initial content

#### Scenario: A visitor opens sign-in

- **WHEN** the public statistics response supplies tasting, member-review, and external-review totals
- **THEN** the sign-in introduction shows the tasting total and a review total composed from the two owned review sources

### Requirement: Responsive application header

The design system SHALL provide one application-header component tree that keeps database navigation, personal navigation, search, the account menu, and the global tasting action reachable at every supported width.

#### Scenario: Member opens an inner page

- **WHEN** a signed-in or signed-out member opens a page outside the public homepage
- **THEN** the header renders database navigation in its second row and marks the current destination with ink-colored display type at weight 700 without the page-tab accent rule

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

#### Scenario: Member opens the dedicated search route

- **WHEN** a member opens the general search page or a bottle-selection intent
- **THEN** the route centers a compact contextual heading and the shared page search without a catalog-style surface banner
- **AND** the route does not force query focus before the member interacts, so phone browsers keep the heading visible and do not open the keyboard on load

### Requirement: Domain-owned tasting inputs

The design system SHALL provide a five-band tasting rating input, plus colour and picture inputs that preserve their owning product contracts.

#### Scenario: Member records a band

- **WHEN** a member selects Mediocre, Good, Very good, Outstanding, or Unicorn
- **THEN** the rating input emits that band value and does not invent a numeric point

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
- **THEN** the state uses a minimal recovery shell with its bounded content column centered in the viewport, and the global document does not depend on session loading, application providers, analytics, the application header, or the footer

#### Scenario: A route is not found or forbidden

- **WHEN** a route returns 404 or a signed-in member receives 403
- **THEN** the page explains the navigation or permission state, offers a valid next destination, and does not present the response as a captured application failure

#### Scenario: A signed-out member needs access

- **WHEN** a route requires authentication and no member session exists
- **THEN** the page offers sign-in with a return to the requested address instead of presenting a forbidden state

#### Scenario: A page failure is captured

- **WHEN** the route cannot render because of an application failure
- **THEN** the page offers retry and shows the event ID returned by Sentry capture plus a caller-supplied production stack trace after the owning error boundary removes request bodies, account data, and other sensitive context

#### Scenario: The application is offline

- **WHEN** Peated cannot reach the database
- **THEN** the page states which current actions require a connection and does not claim that work is queued or saved unless a real persistence contract supplies that state

### Requirement: Responsive tasting structure

The design system SHALL use one tasting-form component tree across desktop and mobile viewports.

#### Scenario: Reviewer changes the viewport

- **WHEN** the tasting-form story changes between desktop and mobile widths
- **THEN** the same form controls reflow without switching to a separate mobile component

#### Scenario: Member opens the tasting form

- **WHEN** the caller supplies an existing tasting rating
- **THEN** the form selects that canonical band without creating a point score

#### Scenario: Member moves through the tasting form

- **WHEN** the member continues from Rating through Notes and Details
- **THEN** the progress control names all three steps, the active step renders each of its fields directly, and values remain intact when the member moves backward or forward

#### Scenario: Required tasting input is missing

- **WHEN** no rating band is selected
- **THEN** the save action is disabled and nearby status text states what is required

#### Scenario: Member completes an optional field

- **WHEN** the member changes notes, colour, comment, picture, friends, or edit-only serving style
- **THEN** the same visible field contract is used at every supported viewport without a per-field disclosure or a new product field

### Requirement: Form support components

The design system SHALL provide reusable unit, note-vocabulary, friend-selection, and selected-bottle controls that preserve their owning product contracts.

#### Scenario: Contributor enters a measured bottle fact

- **WHEN** a numeric bottle field has a fixed unit
- **THEN** the control keeps the numeric value editable and the unit visible but not editable

#### Scenario: Member records notes and friends

- **WHEN** a member searches tasting notes or drinking companions
- **THEN** the controls select from the supplied note vocabulary and friend results without inventing a second data contract

#### Scenario: Contributor may be creating a duplicate

- **WHEN** the live bottle-entry flow finds possible matching records
- **THEN** that route presents the matches before creation without adding a Storybook-only duplicate component

### Requirement: Plain shared component boundaries

The web application SHALL use plain UI nouns for shared components and SHALL keep reusable layout and behavior independent from route-specific page copies.

#### Scenario: A route renders aligned linked rows

- **WHEN** several routes need the same row geometry and interaction treatment
- **THEN** they use `ItemList` and `ItemRow` instead of route-local rows or a vague record abstraction

#### Scenario: A route renders a member picture

- **WHEN** a header or row needs a circular member picture or initials fallback
- **THEN** it uses the shared `Avatar` sizes while profile-specific portrait geometry stays with the profile header

#### Scenario: A picker handles listbox keys

- **WHEN** search, entity, and note pickers handle Up, Down, Enter, and Escape
- **THEN** they share one private navigation behavior while retaining their distinct product data and visual contracts

#### Scenario: A page uses shared layout

- **WHEN** a server route composes the page frame, columns, heading, or sections
- **THEN** those helpers do not require a client boundary or include fabricated navigation, search, footer, or page data

#### Scenario: Member opens a tasting for a preselected bottle

- **WHEN** the tasting workflow supplies its bottle before the form renders
- **THEN** the selected-bottle summary keeps that identity visible without offering a change action

### Requirement: Attributed critic reviews

The design system SHALL preserve each published critic review's publication and SHALL show a numeric critic rating only when its permitted native score already uses the 100-point scale.

#### Scenario: Critic review uses the 100-point scale

- **WHEN** a critic review supplies a permitted `nativeScore` with a scale of 100
- **THEN** the component displays its numeric value with the publication attribution and original article link
- **AND** an eligible whole-number value may contribute to the Bottle score

#### Scenario: Critic review uses another scale

- **WHEN** a critic review has no permitted score or its native scale is not 100
- **THEN** the component keeps the publication attribution and original article link, omits the number, and does not convert or explain the source scale

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

The design system SHALL keep bottle identity, specs, the real-point median, the band-pick distribution, member status, and record actions in one responsive header component tree.

#### Scenario: Bottle header reaches the folded width

- **WHEN** the header viewport is 900px or narrower
- **THEN** the spec strip follows the identity and the available rating measures follow it in two columns

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

The web application SHALL compose the bottle catalog from reusable StyleX list and filter patterns while the product route owns API and URL state.

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

### Requirement: Entity catalog routes

The web application SHALL compose distiller, brand, bottler, and blender catalogs from one reusable StyleX list and filter contract while each route supplies its entity kind.

#### Scenario: Member browses an entity catalog

- **WHEN** the entity-list API supplies records and previous or next cursors
- **THEN** the catalog shows the visible records, Peated identity, location, bottle and tasting measures, real current-page count, and only the supplied cursor actions

#### Scenario: Member filters an entity catalog

- **WHEN** the member searches by name or selects a country
- **THEN** the route writes the filter to the URL, clears the cursor, and renders count-free country rows without deriving entity totals from country bottle counts

#### Scenario: Member opens an existing region-filtered link

- **WHEN** the route URL already supplies a region
- **THEN** the filter rail keeps that region visible and removable without inventing region options that the page did not request

### Requirement: Entity detail route

The web application SHALL compose an entity overview from reusable StyleX components while the product route owns live entity and bottle data.

#### Scenario: Member opens an entity record

- **WHEN** the entity-details endpoint supplies a record
- **THEN** the page uses its singular kind as its only entity classification and shows its Peated identity, location, ownership, core facts, and tabs without duplicating the complete route in Storybook

#### Scenario: Entity kind supports a bottle role

- **WHEN** a brand, bottler, or distillery record offers contextual bottle creation
- **THEN** the route prefills only the matching explicit Bottle field and does not read the legacy entity type collection

#### Scenario: Associated bottle details are available

- **WHEN** the bottle-list endpoint supplies notable bottles for the entity
- **THEN** each row shows the supplied origin, age, ABV, median review score, and tasting-band distribution directly under the Bottles or Bottlings section without a second list title or a generic catalog summary

#### Scenario: Entity has no associated bottles

- **WHEN** a brand, bottler, distillery, or blender has no supplied bottle rows
- **THEN** the page keeps its Bottles or Bottlings module visible and offers an Add a bottle button instead of removing the section

#### Scenario: Entity header actions align with the identity

- **WHEN** an entity page supplies header actions
- **THEN** the page places them below the entity copy and aligns them with its left edge

#### Scenario: Entity detail data is not owned

- **WHEN** the API does not supply operating status, still count, capacity, entity-level community measures, or sourced history
- **THEN** the route omits those values instead of deriving them from the entity description or establishment year

#### Scenario: Member changes an entity section

- **WHEN** the member selects Overview, Bottles, Tastings, or the available Distillery codes tab
- **THEN** the nested route keeps the same entity header and tabs while only the selected section changes

#### Scenario: Member browses all entity bottles

- **WHEN** the bottle-list endpoint supplies an entity page, sort order, total, and cursor links
- **THEN** the Bottles tab renders the shared bottle rows, writes sorting and cursor state to the URL, and does not duplicate the complete route in Storybook
- **AND** entity overviews, entity bottle tabs, the bottle catalog, and homepage bottle modules use the same bottle list and row components

#### Scenario: Member browses entity tastings

- **WHEN** the tasting-list endpoint supplies tastings and cursor links for the entity
- **THEN** the Tastings tab renders the supplied authors, bottles, notes, rating bands, and only the supplied cursor actions

#### Scenario: Member opens SMWS distillery codes

- **WHEN** an entity has the SMWS short name
- **THEN** the route exposes the Distillery codes tab, renders the fixed code registry, and links only distillers resolved by the existing SMWS endpoint

### Requirement: Member profile route

The web application SHALL compose the member profile from reusable StyleX identity, measure, navigation, tasting, and feedback components while the route owns session, privacy, API, action, and cursor state.

#### Scenario: Member opens a public profile

- **WHEN** user details, tasting statistics, tasting records, and region records are available
- **THEN** the page shows the supplied identity, friend or owner actions, tasting-band distribution, tasting, unique-bottle, library, and contribution totals, tasting rows, and regional counts without duplicating the complete route in Storybook

#### Scenario: Member opens their own profile

- **WHEN** the current session owns the profile
- **THEN** the header offers profile and account settings instead of a friendship action and uses the supplied account creation date when it is available

#### Scenario: Member opens a private profile

- **WHEN** the profile is private and the current session is neither its owner nor a friend
- **THEN** the page keeps the public identity and friendship action visible while withholding summary, tasting, library, and region data

#### Scenario: Profile concept data is not owned

- **WHEN** the API does not supply a bio, location, follower totals, passport coverage, distinct distillery total, or contribution list
- **THEN** the page omits those modules instead of deriving or inventing them

#### Scenario: Member changes a profile section

- **WHEN** the member selects Tastings, Library, or Activity
- **THEN** the nested route keeps the same profile header, summary, privacy boundary, and tabs while only the selected section changes

#### Scenario: Member browses a Library

- **WHEN** the Library list and statistics endpoints supply bottles, status totals, producer totals, and cursor links
- **THEN** the Library tab renders the supplied bottle rows, search, status and producer filters, owner actions, and only the supplied cursor actions

#### Scenario: Member browses profile activity

- **WHEN** the profile Activity endpoint supplies tasting sessions and collection additions
- **THEN** the Activity tab renders those supplied records without substituting them for unsupported contribution records

### Requirement: Admin workspace

The web application SHALL compose admin routes from a shared StyleX workspace,
navigation, page header, section, data table, feedback, and form controls while
each route continues to own its data and mutations.

#### Scenario: Administrator opens an admin route

- **WHEN** an authorized administrator opens the dashboard, a catalog, a detail, a form, or a moderation route
- **THEN** the route renders inside the same responsive admin workspace and keeps its current URL and behavior

#### Scenario: Administrator uses a common admin surface

- **WHEN** an admin route needs navigation, a page heading, actions, a section, a table, an empty state, pagination, or a form control
- **THEN** it uses the existing design-system component or one narrow shared admin component instead of defining a page-specific visual primitive

#### Scenario: Admin styling migration completes

- **WHEN** the final admin route no longer renders a Tailwind-owned element
- **THEN** the web application removes the admin legacy stylesheet and its unused Tailwind dependencies
