---
version: alpha
name: Peated
description: A dense, reference-first whisky database with quiet chrome and one warm accent.
colors:
  primary: "#9a5b12"
  primary-dark: "#d9922f"
  primary-deep: "#6e400c"
  primary-deep-dark: "#f0d9b0"
  primary-tint: "rgb(154 91 18 / 0.15)"
  primary-tint-dark: "rgb(217 146 47 / 0.15)"
  neutral: "#f7f8f5"
  neutral-dark: "#101210"
  surface: "#ebeee7"
  surface-dark: "#1b1e1a"
  inset: "#dce0d6"
  inset-dark: "#2b2f29"
  ink: "#161914"
  ink-dark: "#e8eae3"
  ink-muted: "rgb(22 25 20 / 0.75)"
  ink-muted-dark: "rgb(232 234 227 / 0.75)"
  data-accent: "rgb(154 91 18 / 0.42)"
  data-accent-dark: "rgb(217 146 47 / 0.42)"
  rating-fill: "rgb(154 91 18 / 0.75)"
  rating-fill-dark: "rgb(217 146 47 / 0.75)"
  rating-track: "#cbd0c2"
  rating-track-dark: "#3a3f37"
  passport-empty: "rgb(22 25 20 / 0.16)"
  passport-empty-dark: "rgb(232 234 227 / 0.16)"
  hairline: "rgb(22 25 20 / 0.11)"
  hairline-dark: "rgb(232 234 227 / 0.11)"
  section-rule: "rgb(22 25 20 / 0.16)"
  section-rule-dark: "rgb(232 234 227 / 0.16)"
typography:
  page-title:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: -0.035em
  section-heading:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  row-title:
    fontFamily: Space Grotesk
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  body:
    fontFamily: Karla
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  interactive:
    fontFamily: Karla
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
  metadata:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  field-label:
    fontFamily: IBM Plex Mono
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0.08em
  micro-label:
    fontFamily: IBM Plex Mono
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0.08em
rounded:
  small: 2px
  control: 3px
spacing:
  x1: 4px
  x2: 8px
  x3: 12px
  x4: 16px
  x6: 24px
  x8: 32px
  x12: 48px
components:
  page-light:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  page-dark:
    backgroundColor: "{colors.neutral-dark}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.body}"
  surface-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  surface-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.control}"
  field-light:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.ink}"
    height: 40px
    rounded: "{rounded.control}"
  field-dark:
    backgroundColor: "{colors.inset-dark}"
    textColor: "{colors.ink-dark}"
    height: 40px
    rounded: "{rounded.control}"
  primary-button-light:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.interactive}"
    height: 40px
    rounded: "{rounded.control}"
  primary-button-dark:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.neutral-dark}"
    typography: "{typography.interactive}"
    height: 40px
    rounded: "{rounded.control}"
  pending-button-light:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.neutral}"
  pending-button-dark:
    backgroundColor: "{colors.primary-deep-dark}"
    textColor: "{colors.neutral-dark}"
  secondary-text-light:
    textColor: "{colors.ink-muted}"
  secondary-text-dark:
    textColor: "{colors.ink-muted-dark}"
  selected-light:
    backgroundColor: "{colors.primary-tint}"
  selected-dark:
    backgroundColor: "{colors.primary-tint-dark}"
  data-fill-light:
    backgroundColor: "{colors.data-accent}"
  data-fill-dark:
    backgroundColor: "{colors.data-accent-dark}"
  rating-fill-light:
    backgroundColor: "{colors.rating-fill}"
  rating-fill-dark:
    backgroundColor: "{colors.rating-fill-dark}"
  rating-track-light:
    backgroundColor: "{colors.rating-track}"
  rating-track-dark:
    backgroundColor: "{colors.rating-track-dark}"
  passport-empty-light:
    backgroundColor: "{colors.passport-empty}"
  passport-empty-dark:
    backgroundColor: "{colors.passport-empty-dark}"
  list-divider-light:
    backgroundColor: "{colors.hairline}"
    height: 1px
  list-divider-dark:
    backgroundColor: "{colors.hairline-dark}"
    height: 1px
  section-divider-light:
    backgroundColor: "{colors.section-rule}"
    height: 1px
  section-divider-dark:
    backgroundColor: "{colors.section-rule-dark}"
    height: 1px
---

# Peated design system

This document is the visual contract for Peated. Product code and tests remain authoritative for behavior and data. Update this document when a reviewed visual decision changes.

## Overview

Peated is a whisky database first. It is a reference work with community data, not a social feed with reference data attached.

- Prefer useful density over decorative space.
- Let data provide character through measures, distributions, counts, and identifiers.
- Make product chrome quiet so bottle images and long text remain clear.
- State precise values. Write “2,841 tastings,” not “popular.”
- Treat missing data as a normal state and offer a contribution path when the member can fill the gap.

### System rules

1. Use `ground`, `surface`, and `inset` tones for structure. Do not outline cards, fields, image slots, or bars.
2. Use one accent for community measures, active state, links, and one main action per view.
3. Do not use shadows except for overlays.
4. Use a 3px radius for controls and panels. Use a 2px radius for chips and small data devices. Do not use pills.
5. Keep small muted text at 75% ink or stronger.
6. Use uppercase text only for short data labels in the mono type role.
7. End an actionable empty state with the contribution path.

The web app uses StyleX for component styles and does not load or compile Tailwind. Components own their complete visual and control treatment. Keep global CSS for document defaults and third-party markup that a component cannot own.

## Colors

The operating system selects the light or dark scheme. The product does not keep separate theme state. Storybook is the only exception: its review-only toolbar lets reviewers switch every story between the light and dark schemes. It does not add theme state to the product.

| Token           | Light      | Dark       | Use                              |
| --------------- | ---------- | ---------- | -------------------------------- |
| `ground`        | `#F7F8F5`  | `#101210`  | Page background                  |
| `surface`       | `#EBEEE7`  | `#1B1E1A`  | Rows, cards, bars                |
| `inset`         | `#DCE0D6`  | `#2B2F29`  | Fields, image slots, tracks      |
| `ink`           | `#161914`  | `#E8EAE3`  | Main text and committed actions  |
| `inkMuted`      | 75% ink    | 75% ink    | Secondary text and metadata      |
| `accent`        | `#9A5B12`  | `#D9922F`  | Sentiment, active state, links   |
| `accentDeep`    | `#6E400C`  | `#F0D9B0`  | Small accent text on a tint      |
| `accentTint`    | 15% accent | 15% accent | Selected and related data        |
| `dataAccent`    | 42% accent | 42% accent | Secondary data and facet fills   |
| `ratingFill`    | 75% accent | 75% accent | Compact rating distribution bars |
| `ratingTrack`   | `#CBD0C2`  | `#3A3F37`  | Rating tracks on hover surfaces  |
| `passportEmpty` | 16% ink    | 16% ink    | Unstamped passport cells         |
| `hairline`      | 11% ink    | 11% ink    | Dividers inside a list           |
| `sectionRule`   | 16% ink    | 16% ink    | Major page and footer boundaries |

Use `inset` for neutral tracks and empty data regions. Do not introduce a second accent or use red and green as sentiment poles.

## Typography

- **Space Grotesk** is the display face for names, headings, and meaningful figures.
- **Karla** is the reading face for prose, labels, and member input.
- **IBM Plex Mono** is the data face for values that align or scan.

| Role            | Family  | Weight | Size and line height | Tracking          |
| --------------- | ------- | ------ | -------------------- | ----------------- |
| Page title      | Display | 700    | 44px / 1.04          | -0.035em          |
| Section heading | Display | 700    | 18px / 1.2           | -0.02em           |
| Row title       | Display | 700    | 17px / 1.2           | -0.02em           |
| Body            | Reading | 400    | 14px / 1.55          | normal            |
| Interactive     | Reading | 600    | 13–14px              | normal            |
| Metadata        | Data    | 400    | 11–12px              | normal            |
| Field label     | Data    | 400    | 11px                 | 0.08em, uppercase |
| Micro label     | Data    | 400    | 10px                 | 0.08em, uppercase |

Use tabular numerals for aligned measures. Do not use the display face as body copy.

## Layout

The spacing scale uses 4px steps: 4, 8, 12, 16, 24, 32, and 48px. Prefer these values before adding a local exception.

- Buttons use `sm` at 34px, `md` at 40px, and `lg` at 48px. `md` is the default.
- Controls that share one action row use the same size. Form controls use the 40px `md` height.
- List dividers can use a 1px hairline inside the list.

## Elevation & Depth

- Floating overlays use `0 18px 40px` with 16% light ink or 55% black in dark mode.
- Other elements do not use elevation.

## Shapes

- Controls, panels, cards, and buttons use a 3px radius.
- Chips, tags, image slots, and bar segments use a 2px radius.
- Do not use pills.

## Components

### Interaction

- Every interactive control has a visible hover, pressed, disabled, and keyboard-focus state.
- Keyboard focus uses a 2px inset accent ring. Do not remove focus indication.
- A neutral text link shifts to `accentDeep` and gains a 1px underline on hover. It uses `accent` while pressed. A linked `surface` card or row steps to `inset` on hover and `accentTint` while pressed. A plain linked row uses 12px horizontal padding and an equal negative margin so its interaction surface extends past the text grid without moving the content. When a record has a destination, make the complete row its primary link. Keep links and controls inside that row independent. Do not give a static row a linked-row hover treatment. Keep its geometry fixed and put the focus ring on the complete actionable surface. Keep data tracks visible against every tonal state.
- Do not use a pointer cursor as the only interaction state.
- Disabled controls use 45% opacity and state the reason nearby when the reason is not obvious.
- A pending commit stays in the button that started it. Change its label to the present participle, use the deeper accent fill, and move one 2px rule across its bottom edge. Keep the button opaque and disable the rest of the form.
- Use the same 33%-wide rule and 1.15-second sweep for indeterminate work. Respect reduced-motion preferences. Do not use spinners, shimmer gradients, or fake progress.
- Keep one visually filled commitment per view. Use tonal controls for secondary actions.
- Keep controls in one action row at the same height. Do not let button labels wrap.
- Use overlays for menus and typeahead results. Keep their shadow local to the overlay.
- Put a row's secondary actions in one 34px vertical-dots menu. Open the menu over its trigger and keep the trigger as the top-right cell of the overlay.

### Form controls

- Use a native select for a compact list of familiar options. A styled select owns one disclosure caret; suppress browser and legacy background indicators when the component renders its caret.
- Keep a numeric field and its fixed unit in one inset control. The unit is not editable and uses the data type role.
- Show progress through a fixed multi-step form without turning completed or upcoming steps into navigation.
- Keep the selected bottle visible above a related form. Show its Peated ID and compact metadata. Provide one named change action only when the current workflow owns bottle selection. A tasting form for a preselected bottle does not show that action.
- When a possible duplicate exists, show the matching records before the remaining fields. Explain which label detail distinguishes a separate bottling.
- Use scoped search when one query can target several record types. Combine a scope menu and search input in one 40px tonal control. Open the menu over its stationary scope trigger, align its top and left outer edges with the control, align its option labels with the active scope label, and keep its divided header within the same 40px outer height. List the scopes without a redundant purpose label. Close the scope menu and focus the existing query input when the member presses that input. The open scope menu provides the active treatment, so suppress the query control's active ring until that menu closes. Show set sizes only when the caller supplies them. Keep the active scope visible and prevent horizontal overflow at narrow widths.
- Use a segmented control for one choice among two to four short options. Keep every segment the same height and width. Use accent only for the current choice.
- Use a switch for an independent setting that takes effect immediately. Put its label and consequence beside the control.
- Use the five-band rating input for a tasting. Do not offer an exact point in the tasting workflow.
- Use a whole-number 0–100 input only when a member writes or edits a review.
- Use the colour input for Peated's fixed 0–20 whisky colour scale. Draw all 21 reference steps as one continuous strip, support keyboard changes through a native range input, and let the member state that they are unsure.
- Use the picture input to open the native file picker. Start with one tonal action. When a picture exists, make the preview the change action and show explicit change and remove controls.
- Use a fieldset and legend for grouped controls. Use a label only for a single field.
- Keep selects, segmented controls, text fields, and buttons on the 40px `md` control rhythm when they share a form.

### Rating language

Peated keeps tasting bands and review scores separate. A tasting records one
coarse band. A review records one exact 0–100 score.

### Bands

- Use five bands everywhere: Mediocre under 80, Good 80–84, Very good 85–89, Outstanding 90–94, and Unicorn 95–100.
- A tasting stores one band. Never convert it into a point or fabricate a numeric score from band centers.
- Show aggregate band picks as five fixed bins. Do not collapse them into a second low, mid, and high vocabulary.
- Show one tasting rating as five visible cells with one cell lit.

### Score

- A member review stores one whole-number score from 0 through 100.
- The headline score is the whole-number median of eligible member and external review scores, never a mean.
- An external score enters the pool only when its permitted native value is a whole number on a 100-point scale.
- With fewer than 20 scores, withhold the median and let the score slot become a contribution path. Tasting bands still show their own distribution.
- Show the real member and external score counts and, when supplied, the low and high scores on the same 0–100 domain.
- Use neutral ink for the score. Do not use accent to imply that Peated owns the datum.

### Critic reviews

- A critic review belongs to its named publication. Keep the publication and original article link visible.
- When `externalReview.nativeScore.scale` is 100, show its numeric value as the critic rating.
- For every other scale, omit the number. Do not convert it or explain the conversion in product copy.
- Eligible whole-number critic ratings can contribute to the Bottle score while remaining attributed to their publication.
- Use “critic review” for the record and “critic score” only for a score attributed to that record.

Use “tasting rating” for a band and “review score” for an exact point.

### Data devices

- **Bottle identity row:** Use the catalog image when the caller supplies one. Otherwise, use Peated's existing bottle glyph. Keep brand, bottle name, exact supplied metadata, related-release count, and member status distinct. “In Library” and “Tasted” keep their current Peated meanings. Show true member states as 12px muted book and circled-check marks directly after the name. Do not use accent color or make the marks controls. Omit a false state. Callers also omit the marks when the page already implies the state, such as the bottle page, the member's library or tastings, and another member's profile. Do not replace missing data with a decorative bottle silhouette or infer identity details in the component.
- **Band mark:** Use five 12×8px cells with 2px gaps. Keep every empty cell visible and light the selected tasting band.
- **Band stack:** Show the five bands from Mediocre to Unicorn with 2px gaps. Use low, mid, and high fills. Carry proportion by shape and sample size by count; do not print a band percentage.
- **Rating measure:** In bottle rows, show five fixed vertical tasting-band bars and the published median as one compact measure. Scale each bar by its share of that bottle's tasting ratings and scale the overall height by sample size. Reserve the score slot when the median is withheld. Use the supplied low and high scores for the bracket; do not describe it as a critic-only range. Keep the full distribution and counts in one accessible label.
- **Record ID:** Show the canonical Peated ID above an entity title with the ID in accent. Print the supplied ID without changing it.
- **Spec strip:** Show at most four equal-width mono fact cells. The strip has no background. Each cell uses `surface`, and a 6px transparent gap exposes the page behind it. Truncate labels and values and print an en dash for null or missing values. Place the strip as a sibling below its related header panel instead of nesting it inside that panel.
- **Bottle page header:** Keep the catalog image, identity, member actions, score, and band stack in one responsive component tree. Keep the spec strip as the header surface's sibling. At 900px, place the strip before the measures and show supplied measures in two columns. At 480px, remove the identity-panel fill and padding, reflow a four-cell strip to 2×2, stack the measures, reduce the title to 26px, and pin the action row to the bottom. Omit a measure when the caller cannot supply it.
- **Fact list:** Use compact mono labels and values for supplied record facts. Print “Not stated” for an absent value. Do not infer a fact from nearby copy.
- **Range bar:** Keep the band, tick, and caption on one numeric domain when the underlying data owns a real range.
- **Count chip:** Use mono type, accent tint, and a 2px radius. Use the neutral variant for status.
- **Facet row:** Combine one real filter with an optional count and share of the current record set. When the caller omits counts, keep the filter interactive and omit both the share bar and count slot. Reserve the dismiss slot in every interactive row. Use accent tint and a dismiss mark for the selected row. Use `null` only for an unavailable, disabled field; print an en dash and omit its bar.
- **Pager:** Use numbered links only when the caller knows the page count. State the shown range and active filter. Use an ellipsis for skipped ranges and tonal previous or next links. Do not derive page numbers from cursor pagination.
- **Bottle catalog:** Treat the API response as one visible cursor page. Show its real records, current-page count, and API-owned full-result total. Keep filters in the URL and reachable through one disclosure at narrow widths. Render category and age statement as counted facets from the API response. Use the API-owned NAS, under-12, 12–17, 18–24, and 25-plus age bands. Keep the old exact-age query readable for existing links, but replace it when a member selects an age band. Do not offer community-score, community-verdict, or flavor-profile filters, and do not derive facet counts from the cursor page. Keep cursor navigation; do not invent numbered pages from the total.
- **Entity catalogs:** Use one list contract for distillers, brands, bottlers, and blenders. Show the visible cursor page, Peated ID, kind, location, bottle count, and tasting count. Keep query, country, region, sort, and cursor state in the URL. Country rows are count-free until the API owns entity facet counts. Keep the active region removable when an existing link supplies one. Use Previous and Next cursor actions without inventing a total or numbered pages. At phone widths, keep bottle count visible and retain both measures in the row's accessible name.
- **Homepage:** Fetch the signed-out homepage's public stats and lists on the server through the anonymous API client, then hydrate the same React Query keys used by its client components. Use the bottle list's published median-score sort for the database-wide Highest rated module. Show the three largest API-owned country records as map tiles, aggregate the remaining returned countries into one truthful remainder tile, and list the four largest supplied Scottish regions below them. Keep the route request-time rendered because the shell varies by session. Keep signed-in activity and member data client-owned. The signed-out homepage header shows database navigation but omits global search because the hero owns the page's search control. Do not render popularity, annual rankings, critic-source totals, or highest-rated bottles scoped to one distillery until issue #781 supplies those server-owned facts.
- **Entity detail:** Use one nested route frame for the entity header and the Overview, Bottles, Tastings, and optional Distillery codes tabs. The selected route owns its API and URL state while the header and tabs stay stable. Use the entity-details response for identity, kind, location, ownership, core facts, and bottle totals. Kind is the only entity classification used by the interface. A contextual bottle action maps only brand, bottler, and distillery kinds to their matching bottle field; blender and company records do not invent one. Keep the Bottles or Bottlings section visible for brand, bottler, distillery, and blender records. When the list is empty, show a short message and an “Add a bottle” button. Use the bottle-list response for bottle metadata, median review score, tasting-band counts, sorting, and cursor pagination. Show these rows directly under the Bottles or Bottlings section; do not add a second list title or a generic catalog summary. Use tasting-list records for the Tastings tab. The SMWS codes tab is a reference list enriched with links from the existing SMWS distiller endpoint. A company portfolio waits for an API-owned current-owner filter; do not infer it from bottle relationships. Keep complete routes out of Storybook; document the reusable entity header, bottle rows, tasting entries, bottle comparison table, and their sparse states there. Do not infer operating status, still count, capacity, community measures, or history from the entity description or establishment year.
- **Member profile:** Keep the profile header, summary, privacy boundary, and Tastings, Library, and Activity tabs in one nested route frame. Use user-details counts for tastings, unique bottles, library entries, and contributions. Use the tasting and region lists for Tastings. Use the Library list and Library statistics for search, status and producer filters, bottle rows, owner actions, and cursor links. Use profile Activity only for the tasting sessions and collection additions returned by its API. Keep private records behind the existing friendship rule. Omit bio, location, follower totals, passport coverage, distinct distillery totals, and a Contributions tab until issue #774 supplies owned contracts. Storybook documents the reusable header and bounded Library and Activity content instead of duplicating complete routes.
- **Summary strip:** Show three to five page-level facts in equal tonal cells. A cell can add one short mono detail, such as pass, sip, and savor counts. Reflow cells into additional rows at narrow widths; do not introduce horizontal scrolling.
- **Passport:** Present distinct tracked objects as coverage. Use the tracker noun and never expose XP or levels. A closed set names every stamped or missing member and shows a denominator. An open-ended tracker shows only its count and the distance to its next stamp. Past 24 members, replace individual cells with a share bar and percentage chip.
- **Bottle comparison table:** Use a table only when bottle comparison is the task. Keep the bottle name and metadata in the first column and use one or more supplied measure columns. On compact screens, turn each row into a bottle block and repeat the measure labels. Print an en dash for an unknown value.
- **List toolbar:** State the visible record count first. Put sort and optional export actions at the end. Stack these groups at compact widths. A period header is a plain mono micro label without a count chip.
- **Rail list:** Put related short rows on one `surface` panel. Use reading type for the row title, mono type for metadata, fixed end slots, and one hairline between rows. Do not add a divider after the final row.
- **History timeline:** List entity events from oldest to newest. Keep the date in a fixed mono column and use one 4px spine to show whether the distillery was operating or silent at each event. State that status for assistive technology instead of relying on color. End with a short mono summary when the caller can provide one.

Do not add flavor meters. Peated does not own a derived flavor scale. Do not add rank numerals to lists; the list order and heading must state any meaningful position.

### Navigation and page frame

- Keep the header, main content, and footer on the same maximum-width frame and responsive horizontal insets.
- On the homepage, use the page ground for the application header so the header and homepage read as one surface. Inner pages keep the separate header surface.
- Center the bounded content column inside the minimal page-level recovery shell. Keep its text left-aligned.
- Public catalog, detail, and member-profile routes fetch indexable records in their server route files. Pass the result to the interactive client component as its initial query state so names, links, facts, and public activity are present in the first HTML response. Use anonymous API identity for public data and session identity only when the response includes member state or enforces profile privacy.
- Show peer destinations as plain links. Use ink-colored display type at weight 700 and `aria-current="page"` for the current header destination. Do not use the accent rule; that device belongs to page tabs.
- Keep record-page tabs in one horizontally scrollable row. Show a count only when the caller supplies it, and keep the count separate from the destination label.
- Keep database and personal destinations in one navigation system. Label the personal group “You” in the mono micro role when both groups share a row.
- The application header uses one responsive component tree. On wide screens, the first row holds the brand, scoped search, “Log a tasting,” and the account menu. The second row holds database and personal navigation.
- Below 960px, fold personal destinations into the account menu. Below 760px, remove the scope control from the constrained search field and let database navigation scroll inside its row. Below 560px, show one header row with navigation, brand, search, and account actions. Open database and personal destinations in a labeled drawer. Open search in place with the query field, a cancel action, and the available scopes in a horizontally scrollable chip row below the field.
- Keep “Log a tasting” as the header's only record action. Offer “Add a bottle” only when a search miss or contribution context makes that action relevant.
- Label the shared bottle resolver by intent: “Find a bottle” for generic entry, “Add a bottle” for catalog contribution, “Add to your Library” for Library entry, and “Log a tasting” for tasting entry. Preserve the intent through search, manual creation, and start-over paths.
- Render account destinations as links and session changes as actions. “Sign out” calls the existing logout server action from a menu button; it is not a GET destination.
- The reference footer is not a panel. Start it with one `sectionRule`, then show the product statement and four stable link groups. Keep coverage, provenance, and responsibility text in the closing reference band. Do not add a second divider inside the footer.

### Search

- Treat an open header typeahead as one object. Open its ground surface over the field, keep the same input as the top row, and separate results with one hairline. Inset the 2px active ring from the edge of that 40px top control so the field fill remains visible around it; the results surface uses only its overlay shadow. Do not place a detached results panel below the field or move the query when results appear.
- Group supplied results by record type. Keep group order, result caps, totals, and “See all” destinations owned by the caller because the search API defines what is known.
- Highlight the matched substring with accent tint. Use a tonal step for the active result; do not use an accent row fill.
- Let Up and Down move across result groups. Enter opens the active result, or submits the current query when no result is active. Escape clears a non-empty query, then closes an empty search. `/` focuses the global search when focus is not already in an editable control.
- Keep previous results or the settled miss visible at full opacity while a replacement query runs. Keep those results selectable. Replace the field hairline with a 2px accent sweep; do not add a visible status row when results already exist.
- Do not open an empty results surface during the debounce interval. A query alone is not panel content; wait for loading, results, a settled miss, or an error.
- On the first query, show the sweep and one mono line that names the searched set. Do not add placeholder rows. Debounce input by 140ms and keep a displayed sweep visible for at least 250ms so the panel does not flash.
- End with “Add a bottle” only when the caller permits contribution. This action is never part of arrow-key result traversal.
- On narrow screens, move the review score and tasting ratings under the result name. Remove scope selection from the constrained field. On phone search, expose the same scopes as a horizontally scrollable chip row and keep the same component and result order.
- The component does not rank results, create nearest matches, store recent queries, or invent total counts. Those values and behaviors belong to the search service or its owning product surface.

### Pickers

- Show the canonical Peated ID and a useful size figure in each entity result.
- Let Up and Down move through existing results only. Let Enter choose the active result and Escape close the results.
- Put the create action after all results. Never select it with arrow keys or highlight it first.
- Show the canonical ID beside a picked entity and provide a named clear action.
- Delegate inline entity creation through `onCreate`. The form that owns the picker owns the creation fields and result.
- Keep note categories in one wrapping chip row. Use neutral ink for the active category.
- Sort bottle-common notes before the remaining notes. Use solid accent for picked notes, accent tint for bottle-common notes, and inset for available notes.
- Search notes across categories. Keep picked notes visible as a mono summary and name their count in the confirmation action.
- In forms, keep selected notes inside one searchable field. Show existing vocabulary and usage counts as the member types. Use Browse to open the full category picker.
- The drinking-with field selects existing friends only. It does not create members or broaden the audience beyond the caller's friend results.

### States

Thin data is normal.

- State an absence in words. Do not render an inactive layout without a useful next action.
- Offer a contribution action only when the member can supply the missing data.
- Explain zero search results, offer “Add this bottle,” and keep nearby matches visible.
- Use inset placeholders at the final content geometry for loading. Do not use page spinners.
- Use the global loading frame only when no useful route frame can render. Center the Peated wordmark and its 2px accent rule. Draw them from left to right, hold the completed mark, and repeat on a 2.6-second cycle while the route loads.
- Reserve the repeating global loading animation for the root route boundary. Do not use it for hydration or a section-level wait.
- Keep errors inside the failed section. State what still works and offer a tonal retry action.
- Use the shared `EmptyState`, `LoadingList`, and `SectionError` components for these contracts.
- Use a page-level state only when the route cannot render its normal content. Keep a section failure inside its section.
- Treat 404 and 403 responses as navigation or permission states, not application failures. Do not assign them a Sentry reference.
- Distinguish a signed-out member from a signed-in member without permission. Sign-in returns the member to the requested address.
- Render page-level recovery states in the minimal error layout, not the application layout. A global 404 or root-layout failure owns its complete document and does not load session state, application providers, analytics, the header, or the footer.
- For a captured page failure, offer retry and show a safe incident reference. A route can also show a production stack trace or technical detail when it has one, but the owning error boundary removes request bodies, account data, and other sensitive context before rendering it.
- Offline copy states only what the current product can still do. Do not claim that work is queued or saved unless a real persistence contract supplies that state.
- Print an en dash for unknown table or spec-strip values. Do not use “n/a.”

### Responsive behavior

- Start with content that works at 320px without horizontal page overflow.
- Preserve information order when columns collapse.
- Let long names wrap in headings and truncate only aligned list or table cells.
- Use a table only when comparison is the task. Provide a row or card treatment for narrow screens.
- Verify each reviewed slice at desktop and mobile widths in both system color schemes.

### Component ownership

Design-system components use StyleX and own their visual states. Name files that contain StyleX calls `*.stylex.ts` or `*.stylex.tsx`; this keeps the compile boundary narrow and explicit. Product screens compose these components instead of adding page-local visual classes.

Use the shared composition baseline before adding another visual container:

- Use `Card`, `CardLink`, and `CardGrid` for neutral content cards. Add a named card component only when it owns a Peated concept, data contract, or behavior.
- Use `ItemList` and `ItemRow` for aligned linked rows. The item noun stays neutral; the caller supplies the Peated record, label, and destination.
- Use `DataTable` for ordinary comparison rows. The route owns fetching, URL state, sorting, filtering, and paging. Keep a specialized table only when its compact layout or columns are part of a product contract.
- Use `FormStack`, `FormSection`, `FormGrid`, `FormDetails`, `FormActions`, and `FormNotice` to compose workflows. Field components own labels and controls; routes own state and mutations.
- Use `SearchSelect` for one remote record and `SearchPicker` for several. The caller owns the query and available results.
- Use `Avatar` for circular member pictures and initials at the supported header and row sizes. Keep profile portraits separate when their shape and scale are part of the profile header.
- Use `WorkflowScreen` for standalone add, edit, merge, and capture tasks. Do not put complete workflow routes in Storybook. Show reusable controls and meaningful component states there.

Name an exported component after the Peated concept or user task that it owns. Use a normal UI noun for a generic control. Do not name a component after its implementation shape with words such as `Product`, `Experience`, `Surface`, `Shell`, `Widget`, `Module`, `Structure`, or `Record` unless that word is the real product concept. Storybook titles use the same nouns as the product and group them by their owning domain. State names describe what the reviewer sees or does.

Storybook is the living view of the implemented shared system. Its sidebar lists foundation topics and reusable components grouped by domain. Keep each component's story file beside its implementation. A simple component starts with one Overview story that renders its useful static variants together and exposes narrow props through Storybook controls. Do not add separate stories for sizes, labels, selected values, item counts, or other prop permutations that can be understood in the overview or controls. Add a separate named story only when a behavior, asynchronous state, permission boundary, error, or responsive composition needs a stable direct review URL. A named behavior story renders its scenario directly and deterministically; reviewers do not click through setup steps to reach the state under review. Pin shared hover, pressed, and keyboard-focus rules in one interaction-state story so reviewers can inspect those real pseudo states without holding the pointer in place. Add a group only after it contains real exported tokens or components. Stories render the same components used by product screens. Do not add visual copies, placeholder controls, empty groups, route-specific sections, or complete page compositions.

Storybook exposes an accessibility review panel and a local MCP endpoint for agents. Accessibility findings support manual review and do not create a presentation-test gate. Agent manifests use component types, concise JSDoc for non-obvious semantics, and real stories. Do not enable global Autodocs pages only to feed the manifest. CI builds the static Storybook as a compile gate.

Storybook names the responsive review checkpoints after Peated's layouts instead of device brands: Wide at 1320px, Rail at 1040px, Folded at 900px, Stacked at 680px, Phone at 390px, and the 320px edge. Keep the exact ladder in the viewport menu. Keep Wide, Folded, and Phone as direct toolbar actions: Wide releases the fixed device frame so a component uses the available canvas, while Folded and Phone select their exact checkpoints. Keep Light and Dark as direct toolbar actions that update the same review-only theme global as the theme menu. A viewport or theme change updates the same story and component tree.

Entity history remains a caller-owned data contract. Storybook can render the history component with realistic supplied events, but it does not duplicate the complete distillery route. A product route must not invent history from an establishment year or description. Add the live section only when the entity API supplies sourced events and operating state.

Page compositions use the same ownership rule. A page component receives
render-ready values and component slots. It owns page hierarchy and responsive
layout, but it does not fetch data, inspect authentication, or run mutations.
The product route owns those behaviors. When browser hooks are required, keep a
small `*Client` component beside the route. Do not put route-only code in the
design-system folders.

Keep the visual system app-local while the web app is its only runtime consumer.
`components/designSystem/components` owns reusable visual components, and
`components/designSystem/patterns` owns reusable render-only compositions.
Route-only behavior lives beside its route. Behavior shared by several routes
lives in a narrowly named feature folder outside the design-system tree. Do not
add a catch-all product, experience, or feature layer inside the visual system.

Use one plain canvas treatment for spacing and width. Render each component directly instead of wrapping it in a decorative preview card. If a component needs a surface, radius, minimum height, or shadow, the component owns it. Keep a shared composite component in its owning component category. Do not use a separate pattern category for route-specific sections or page layouts; review those in the application. The Storybook theme toolbar changes the complete story canvas.

Stories use plain headings and unnumbered sections. They do not use editorial slogans, status labels, completion counts, planned categories, or placeholder specimens. Keep each story focused on real component states or a real composition.

### Review process

Implement one bounded slice at a time:

1. Add the shared contract and real component states to the owning Storybook category.
2. Run type and Storybook production-build checks. Do not add component or snapshot tests for design-system presentation.
3. Use the Storybook toolbar to inspect the story in light and dark modes at desktop and mobile widths.
4. Pause for visual approval.
5. Apply the approved component to a product surface.

Record durable decisions here. Keep temporary implementation sequencing in the active OpenSpec change.
