# Bottle Presentation

This document defines how Peated presents an already-modeled Bottle across user
interfaces and generated text. It complements the
[Whisky Identity Model](../architecture/whisky-identity-model.md), which remains the source of
truth for what the fields mean and which release a Bottle represents.

Presentation is not canonicalization. A field may be correct and important to
matching, filtering, or verification without belonging in every visible bottle
identity.

## Goals

- Make the marketed identity of a bottle recognizable.
- Give series and release designations appropriate prominence.
- Avoid turning headers and compact labels into inventories of stored fields.
- Use one shared bottle row across lists, pickers, tastings, and moderation.
  Surrounding controls and page headings own their layout.
- Apply rules from field semantics rather than recognizing particular brands,
  series, or product families in code.

Human-facing bottle names use `formatBottleDisplayName` from
`apps/server/src/lib/bottleDisplayName.ts`. The formatter accepts a structured
Bottle and returns its concise marketed identity. A caller can suppress brand
context only when the surrounding layout already supplies it.

React components still own truncation, links, line breaks, and supporting
metadata. Stored `fullName` remains available for search, sorting,
verification, and the complete marketed identity. Exact matching uses
structured Bottle fields or an accepted Bottle Reference. An alias never
authorizes an exact match.

## Identity Layers

Bottle identity can contain the following layers:

1. **Producer context**: brand and, when useful, a separately stated bottler.
2. **Series**: a stable named range containing multiple expressions.
3. **Expression**: the marketed product or expression name shared by a
   BottleGroup, when the Bottle is grouped.
4. **Release marker**: an exact human-facing designation such as a chapter,
   batch, act, scene, volume, edition, society code, or marketed barrel number.
5. **Supporting facts**: stated age and ABV.
6. **Years**: distillation, bottling, and release years.
7. **Verification facts**: category, single-cask and cask-strength flags, cask
   attributes, and other exact stored evidence.

The first four layers answer “which whisky is this?” Supporting facts and years
help only when they make the Bottle easier to recognize or distinguish a
release.
Verification facts answer “what do we know about it?” and normally belong in a
details or moderation view.

## General Rules

### Prefer marketed identity over derived descriptions

Preserve wording that is part of the marketed expression or release marker.
For example, `Cask Strength` remains visible when it is literally part of a
product name. Do not separately generate `Cask strength` from the boolean flag
as header metadata.

The same distinction applies to `Single Barrel` or `Single Cask`: preserve
marketed wording, but do not add a generic badge merely because `singleCask` is
true.

### Display series when it contributes identity

Series is identity context, not merely an Additional Details fact. Surfaces
that present bottle identity should display it when present unless:

- the same wording is already present in the visible expression or release
  marker;
- the surrounding page or group heading already establishes the series; or
- the surface is intentionally compact and omits secondary context.

Series must remain searchable even on surfaces that do not render it.

### Separate release names from supporting release facts

A meaningful named edition is normally more recognizable than a year. Keep a
chapter, volume, scene, or other marketed release name in the title. Put a
numbered or coded batch beside the title as supporting metadata. Do not also
append years by default.

Stable wording such as `Small Batch` or `Batch Proof` remains part of the title.
Only an exact batch marker such as `Batch 24` or `Batch C923` moves to metadata.

An exact cask or barrel code is useful when it identifies the marketed release.
The generic fact that the bottle is single-cask is not a substitute for that
code.

### Show years only when they help identify the Bottle

Distillation, bottling, and release years do not need to appear together. Show a
year on a compact surface when:

- the year is part of the marketed release identity;
- the release is conventionally identified by that year; or
- no stronger release marker exists and the year is needed to distinguish
  related Bottles.

When several years are stored, a compact view should normally show at most one.
Show all known years in details and review views. Do not rename or combine a
bare or conflicting year only to fill the display.

### Display age once

Show stated age when it is useful and is not already expressed by the visible
name. Within a release family, an exact age override can be a meaningful
distinction when it differs from the shared expression age.

When `noAgeStatement` is true, use `NAS` in metadata, forms, filters, and detail
views. The surrounding age label or context should make its meaning clear; a
learning-oriented surface can explain that NAS means no age statement. A
missing `statedAge` with no confirmed NAS fact is unknown and must not be
labeled NAS.

### Let ABV stand on its own

ABV is the useful technical strength fact for a bottle header or metadata row.
When ABV is visible, do not add a derived cask-strength label. Ordinary headers
should not add that label even when ABV is unavailable.

### Treat category as taxonomy

Category supports filtering, editing, and verification. It is not part of a
bottle's marketed name. A result or row may still show it as supporting
information when that helps the task.

### Avoid duplicate or conflicting tokens

A structured field should not be repeated when equivalent wording is already
visible in the producer, series, expression, or release marker. Deduplication is
semantic and case-insensitive; it is not permission to strip marketed wording
from a product name.

When stored fields conflict, concise presentation should prefer the explicit
human-facing marketed designation and avoid displaying a contradictory second
token. The conflict belongs in verification or moderation workflows.

## Tasting-note flavor profile

Bottle overview pages show a flavor-category wheel below the bottle image. Each
category measures its occurrence in that exact Bottle's public tastings with
recognized notes. Each tasting counts once per category; repeat tastings remain
separate observations. Private tastings and suggested tags are excluded, even
for signed-in authors. Do not combine sibling releases or use summed tag counts
as category counts.

Distillery and region wheels instead count each active Bottle once per category.
Both show commonality, not intensity. Keep category positions fixed. Hovering or
focusing a category previews its share and leading notes in the center, keeping
the last preview when the pointer or focus leaves. Clicking a category opens the
shared tasting-wheel panel with note descriptions and matching bottles. Omit
instructional text, raw bottle counts, and contribution CTAs. Any recognized
public notes produce a chart; none produces a short empty message. The
whole-bottle style classification is separate from this distribution.

## Presentation Branches

Choose the branch from the needs and context of the surface, not from the
brand or product family.

```text
Is this verifying stored facts?
├─ yes → verification/details
└─ no
   Is the shared expression already established by the surrounding view?
   ├─ yes → family-relative identity
   └─ no
      Must the result be one plain-text string?
      ├─ yes → plain-text identity
      └─ no
         Is this the bottle's primary page heading?
         ├─ yes → detailed header
         └─ no
            Is secondary metadata supported?
            ├─ yes → standard result/card
            └─ no → compact inline identity
```

Any branch may also suppress producer or series context already supplied by a
section heading, grouping label, or adjacent UI.

### Detailed bottle header

Use for a bottle page or another surface where the Bottle is the primary
subject.

- Show producer context and nonduplicative series.
- Make the expression the primary title.
- Show a meaningful release marker prominently.
- Show an exact batch marker in the supporting release facts.
- Show stated age once and show ABV when known.
- Show a year only when it is part of, or necessary to understand, the release
  identity.
- Do not add single-cask or cask-strength badges.
- Keep all known years and cask facts in the details section.

This branch may use multiple lines and links. It does not need to collapse all
identity into `fullName`.

### Standard result, row, or card

Use for search results, bottle tables, activity cards, selection results, and
similar repeated items that support a title plus secondary metadata.

`BottleIdentityRow` owns the shared three-line layout used by the homepage's
New for you list, Library, catalog lists, search results, activity, sidebar
lists, and selected bottle summaries. `getBottleIdentityProps` supplies its
identity fields; `toBottleListItem` adds links, images, and optional list actions
and ratings.
Do not rebuild these lines in a page-specific mapper:

1. The marketed bottle name, including brand context.
2. Distillers not already identified by the brand, followed by the category.
3. Known release facts, stated age, and ABV.

Missing facts do not create placeholder lines. Activity context, Library status,
personal images, and actions belong to their owning view, not a competing bottle
identity layout. Sidebar bottle lists use the shared sidebar variant with
compact titles, smaller thumbnails, and trailing content below the identity.
Recent tastings show the tasting date and rating instead of catalog facts.
Primary page headings remain a separate display context.

Picker options and selected bottles also use `BottleIdentityRow`. Build them
with `toBottlePickerOption`; it retains the numeric database ID and removes
links inside the selection control. Generic text rows and chips are for other
record types. Tasting and search results require structured bottle identity;
they must not fall back to a separate name-and-metadata format.

- Show enough producer, series, and expression context to recognize the Bottle
  outside its detail page.
- Include a named release marker in the title.
- Put an exact batch marker or optional year in secondary metadata.
- Include age or ABV when the component's density makes them useful.
- Do not let a year crowd out a more meaningful release marker or ABV.
- Do not add single-cask or cask-strength labels.

The component owns truncation, linking, line breaks, and which optional
supporting facts fit its layout.

### Compact inline identity

Use inside prose, notifications, narrow activity items, controls, or other
places that cannot support a metadata row.

- Produce a recognizable marketed label, not a field inventory.
- Prefer the expression plus a named release marker.
- Omit exact batch markers when the surface has no supporting metadata.
- Include series when it is essential to recognizing the product and is not
  already represented; secondary context may otherwise be omitted.
- Omit ABV, general production details, and years that are not needed.

### Family-relative identity

Use when a BottleGroup heading or surrounding view already establishes the
producer and shared expression.

- Show the smallest exact release fact that identifies the member within the
  family.
- Prefer an explicit chapter, volume, scene, or other named edition in the
  title. Put an exact batch marker in supporting metadata.
- If no explicit release marker exists, use a marketed distillation, bottling,
  or release year that distinguishes the member.
- Use an exact age override when it differs from the group and is the useful
  distinction.
- ABV may be a supporting detail or the final way to distinguish Bottles when
  it is the only reliable visible difference.
- Do not use `Single cask` or `Cask strength` as generic relative labels.
- Fall back to the Bottle name when its stored fields cannot produce an honest
  label.

Relative identity does not need to repeat brand, series, or expression already
established by the family view.

### Context-suppressed identity

Tables and lists may already be grouped under a brand, series, expression, or
other heading. They may omit only the context explicitly supplied by that
surrounding UI. For example, grouping by brand can suppress the brand label but
does not automatically suppress a series or release marker.

This is an overlay on the detailed, standard, or compact branch rather than a
separate bottle naming scheme.

### Plain-text identity

Use where structured React markup is unavailable, including document titles,
Open Graph metadata, share text, accessible labels, and some exports.

- Produce a readable marketed identity rather than serializing every exact
  field.
- Include producer, nonduplicative series, expression, and a meaningful release
  marker.
- Omit an exact batch marker unless the text must distinguish releases that
  otherwise have the same name.
- Include a year only when it is a necessary part of that marketed identity.
- Omit generic single-cask and cask-strength flags and normally omit ABV.
- Do not assume the stored `fullName` is the ideal text for every consumer.

Family-level SEO uses the shared expression identity. Exact Bottle SEO uses the
exact release identity.

### Verification and details

Use for Additional Details, edit and audit screens, resolver candidates,
moderation, and other tasks where completeness is more important than concise
recognition.

- Label and show all known exact fields, including all known years.
- Show `singleCask` and `caskStrength` as factual attributes when relevant.
- Preserve conflicting or uncertain evidence rather than hiding it behind a
  polished label.
- Do not use this exhaustive representation as the ordinary bottle header.

### Search matching and indexing

Search indexing is not a rendering branch, but it must cover every identity
layer users may search for. Brand, bottler, series, expression, exact release
marker, aliases, age, and relevant years should be searchable even when a
particular result component omits some of them visually.

## Field Matrix

| Field                     | Detailed header          | Standard result   | Compact inline     | Family-relative  | Plain text        | Verification |
| ------------------------- | ------------------------ | ----------------- | ------------------ | ---------------- | ----------------- | ------------ |
| Brand                     | Yes                      | Usually           | Usually            | Context supplies | Yes               | Yes          |
| Bottler                   | When distinct and useful | Optional          | Rarely             | Context supplies | When needed       | Yes          |
| Series                    | If nonduplicative        | If nonduplicative | When essential     | Context supplies | If nonduplicative | Yes          |
| Expression                | Primary                  | Primary           | Primary            | Context supplies | Primary           | Yes          |
| Named edition             | Prominent                | In title          | In title           | Primary          | Yes               | Yes          |
| Exact batch marker        | Supporting fact          | Metadata          | Rarely             | Metadata         | Conditional       | Yes          |
| Stated age                | Once                     | Optional          | Only when integral | Exact override   | If integral       | Yes          |
| ABV                       | Yes when known           | Optional          | No                 | Optional support | Normally no       | Yes          |
| Distillation year         | Conditional              | Conditional       | Rarely             | When useful      | Conditional       | Yes          |
| Bottling year             | Conditional              | Conditional       | Rarely             | When useful      | Conditional       | Yes          |
| Release year              | Conditional              | Conditional       | Rarely             | When useful      | Conditional       | Yes          |
| Single-cask flag          | No                       | No                | No                 | No               | No                | Yes          |
| Cask-strength flag        | No                       | No                | No                 | No               | No                | Yes          |
| Marketed cask/barrel code | As release marker        | As release marker | If needed          | Primary          | If needed         | Yes          |
| Cask type/size/fill       | No                       | Normally no       | No                 | No               | No                | Yes          |
| Category                  | No                       | Optional          | No                 | No               | No                | Yes          |

“No” for a derived flag does not remove identical wording that belongs to the
marketed expression or edition.

## Examples That Exercise the Rules

Examples validate these branches; they must not become named special cases in
the implementation.

| Bottle                                                | Important identity                                                              | Concise consequence                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Whiskyland Glenburgie 38-year-old, Chapter Thirty Two | `Whiskyland` is the Brand; `Chapter Thirty Two` is the release marker           | Show both; omit 1988 vintage and 2026 release from the ordinary header |
| High West A Midwinter Night's Dram, Act 12 Scene 9    | Act and scene identify the release                                              | Prefer the edition; do not also require its release year               |
| Elijah Craig Barrel Proof, Batch C923                 | `Barrel Proof` is marketed expression wording; the batch identifies the release | Keep the expression as the title and show the batch beside it          |
| Four Roses Limited Edition Small Batch 2017           | The year is the annual release identity when no stronger marker exists          | Show the release year                                                  |
| Macallan Sherry Oak 18-year-old, 1994 Vintage         | Vintage is how the producer distinguishes the release                           | Show the vintage and do not add another year label                     |
| Willett Family Estate, Barrel 4769                    | The exact barrel code identifies the marketed release                           | Show the code; do not add `Single cask` merely from the boolean        |
| SMWS 95.71 Prepare for Winter                         | The society code and subtitle are marketed identity                             | Preserve them; age and ABV may support the detailed header             |
| Highland Park Cask Strength No. 5                     | `Cask Strength` belongs to the expression                                       | Keep the words in the title; do not repeat them as metadata            |
| Pōkeno Exploration Series No. 1 Totara Cask           | Series wording is already present in the marketed expression                    | Do not repeat the series in a second visible token                     |

## Implementation Map

### Choosing a web component

The components live in `apps/web/src/components/`, with stories beside them.
Storybook's **Components / Bottles / Bottle Identity Row / Row Layouts** is the
shared visual reference for desktop and phone layouts.

| Need                        | Component                             | Responsibility                                                                                                                                                                                |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One standard bottle row     | `BottleIdentityRow`                   | Full marketed name, provenance, release facts, thumbnail, and linked hit area.                                                                                                                |
| One-line library addition   | `BottleIdentityRow variant="compact"` | Same name, smaller thumbnail, and a 44px hit area; long names truncate visually.                                                                                                              |
| Catalog list                | `BottleList`                          | List semantics and optional ratings or row actions.                                                                                                                                           |
| Mixed activity              | `CommunityFeed`                       | Author, action, date, grouped bottles, scores, and review links; uses larger bottle photos in wide columns, the usual size in sidebars and on mobile, and compact rows for library additions. |
| Selected bottle in a form   | `SelectedBottleSummary`               | Standard identity and optional change action.                                                                                                                                                 |
| Sidebar bottle suggestions  | `pages/BottleRailSection`             | Shared sidebar rows with compact two-line names, small thumbnails, trailing details below the identity, and an optional section action.                                                       |
| Image within another layout | `BottleVisual`                        | Image sizing, white frame, missing-image glyph, and optional expansion.                                                                                                                       |

Use `toBottleListItem` from `apps/web/src/lib/bottleListItem.ts` for full API
Bottles. For partial reads, `getBottleIdentityProps` supplies the name,
provenance, and release facts; the caller supplies the image and destination.
API reads must include the BottleGroup summary needed by the name formatter.

```tsx
const item = toBottleListItem(bottle);

<BottleIdentityRow {...item} />
<BottleIdentityRow {...item} variant="compact" />
```

All variants accept the full marketed name, including brand context. Sidebar
rows use compact two-line titles and smaller thumbnails, omit membership icons,
and place trailing dates, ratings, or actions below the identity. Recent tasting
rows show tasting dates and ratings instead of catalog provenance and facts. Compact
rows omit provenance, metadata, subtitles, membership status, and related-release
links. The optional `end` slot remains available. `layout="cell"` fits the identity
inside an existing table or selection control; it does not change content density.
The row owns thumbnail size, so callers do not build a second image/name layout.

Routes own queries, authentication, and mutations. Keep API-to-feed mapping in
`getCommunityFeedItems`; pass its output to `CommunityFeed`. Component JSDoc and
Storybook controls document supported props and states.

### Other presentation branches

The contract is applied at the presentation site that owns each branch:

- Primary bottle headers use the shared Bottle fields. Result rows, previews,
  and tasting identities use `BottleIdentityRow`; their surrounding views supply
  controls, ratings, and context.
- Relative release-family labels show the most useful difference without adding
  general cask labels.
- SEO, sharing, notifications, and other unstructured consumers use concise
  plain-text identity helpers.
- Search-vector construction indexes series independently of whether a result
  surface has room to display it.
- Additional Details remains the complete home for years, cask flags, and cask
  details omitted from the usual Bottle display.

Headers, plain-text labels, and verification facts follow the same naming
contract. They do not introduce another renderer for bottle rows.

## Implementation Boundary

Changes following this contract should begin at the component or text consumer
that owns the presentation. Existing specialized helpers may remain specialized
for absolute labels, relative family labels, metadata rows, and plain-text
names.

Only extract a shared semantic utility after multiple consumers demonstrably
need the same operation, such as detecting that a series or age is already
expressed by visible text. Do not introduce product-family branches or a
surface-mode API merely to centralize the rules in this document.
