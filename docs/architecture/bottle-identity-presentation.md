# Bottle Identity Presentation

This document defines how Peated presents an already-modeled Bottle across user
interfaces and generated text. It complements the
[Whisky Identity Model](./whisky-identity-model.md), which remains the source of
truth for what the fields mean and which release a Bottle represents.

Presentation is not canonicalization. A field may be correct and important to
matching, filtering, or verification without belonging in every visible bottle
identity.

## Goals

- Make the marketed identity of a bottle recognizable.
- Give series and release designations appropriate prominence.
- Avoid turning headers and compact labels into inventories of stored fields.
- Keep different rendering surfaces free to use layouts suited to their space
  and surrounding context.
- Apply rules from field semantics rather than recognizing particular brands,
  series, or product families in code.

This contract does not require a single shared renderer or a universal
presentation object. React components, metadata generators, notifications, and
other consumers may compose bottle fields differently while following the same
semantic rules.

## Identity Layers

Bottle identity can contain the following layers:

1. **Producer context**: brand and, when useful, a separately stated bottler.
2. **Series**: a stable named range containing multiple expressions.
3. **Expression**: the marketed product or expression name shared by a
   BottleGroup, when the Bottle is grouped.
4. **Release marker**: an exact human-facing designation such as a chapter,
   batch, act, scene, volume, edition, society code, or marketed barrel number.
5. **Supporting facts**: stated age and ABV.
6. **Chronology**: vintage year and release year.
7. **Verification facts**: category, single-cask and cask-strength flags, cask
   attributes, and other exact stored evidence.

The first four layers answer “which whisky is this?” Supporting and chronology
fields help only when they add recognition or distinguish a release.
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

### Prefer a release marker over generic chronology

A meaningful `edition` is normally more recognizable than a vintage or release
year. When a chapter, batch, volume, scene, edition, or exact marketed code is
present, concise surfaces should not also append vintage and release years by
default.

An exact cask or barrel code is useful when it identifies the marketed release.
The generic fact that the bottle is single-cask is not a substitute for that
code.

### Treat years as conditional discriminators

Vintage and release years are not mandatory companions. Display a year on a
concise surface when:

- the year is part of the marketed release identity;
- the release is conventionally identified by that year; or
- no stronger release marker exists and the year is needed to distinguish
  related Bottles.

If both years are stored, concise identity should normally show at most one.
Both remain available in details and verification views. A bare or conflicting
year must not be relabeled or concatenated merely to fill the identity.

### Display age once

Show stated age when it is useful and is not already expressed by the visible
name. Within a release family, an exact age override can be a meaningful
discriminator when it differs from the shared expression age.

When a bottle has no stated age, use `No age statement` in ordinary metadata.
A dedicated Age column can use `NAS` when it also provides the full term as an
accessible label. Do not show both forms in the same layout.

### Let ABV stand on its own

ABV is the useful technical strength fact for a bottle header or metadata row.
When ABV is visible, do not add a derived cask-strength label. Ordinary headers
should not add that label even when ABV is unavailable.

### Treat category as taxonomy

Category supports filtering, analytics, editing, and verification. It is not
normally part of a bottle's marketed identity, so ordinary headers, results,
tables, tasting panels, and flight rows should omit it. Purpose-built category
views may still display it when comparison or classification is the point.

### Avoid duplicate or conflicting tokens

A structured field should not be repeated when equivalent wording is already
visible in the producer, series, expression, or release marker. Deduplication is
semantic and case-insensitive; it is not permission to strip marketed wording
from a product name.

When stored fields conflict, concise presentation should prefer the explicit
human-facing marketed designation and avoid displaying a contradictory second
token. The conflict belongs in verification or moderation workflows.

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
- Show stated age once and show ABV when known.
- Show vintage or release year only when it is part of, or necessary to
  understand, the release identity.
- Do not add single-cask or cask-strength badges.
- Keep complete chronology and cask facts in the details section.

This branch may use multiple lines and links. It does not need to collapse all
identity into `fullName`.

### Standard result, row, or card

Use for search results, bottle tables, activity cards, selection results, and
similar repeated items that support a title plus secondary metadata.

- Show enough producer, series, and expression context to recognize the Bottle
  outside its detail page.
- Include the release marker before optional chronology.
- Include age or ABV when the component's density makes them useful.
- Do not let vintage and release year crowd out a more meaningful release
  marker or ABV.
- Do not add single-cask or cask-strength labels.

The component owns truncation, linking, line breaks, and which optional
supporting facts fit its layout.

### Compact inline identity

Use inside prose, notifications, narrow activity items, controls, or other
places that cannot support a metadata row.

- Produce a recognizable marketed label, not a field inventory.
- Prefer expression plus release marker.
- Include series when it is essential to recognizing the product and is not
  already represented; secondary context may otherwise be omitted.
- Omit ABV, generic technical flags, and nonessential chronology.

### Family-relative identity

Use when a BottleGroup heading or surrounding view already establishes the
producer and shared expression.

- Show the smallest exact release marker that identifies the member within the
  family.
- Prefer an explicit edition, batch, chapter, volume, scene, or marketed code.
- If no explicit release marker exists, use a marketed vintage or release year
  that distinguishes the member.
- Use an exact age override when it differs from the group and is the useful
  distinction.
- ABV may be supporting metadata or a last-resort discriminator when it is the
  only reliable visible difference.
- Do not use `Single cask` or `Cask strength` as generic relative labels.
- Fall back to the canonical Bottle name when exact structured fields cannot
  produce an honest label.

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
- Include a year only when it is a necessary part of that marketed identity.
- Omit generic single-cask and cask-strength flags and normally omit ABV.
- Do not assume the stored `fullName` is the ideal text for every consumer.

Family-level SEO uses the shared expression identity. Exact Bottle SEO uses the
exact release identity.

### Verification and details

Use for Additional Details, edit and audit screens, resolver candidates,
moderation, and other tasks where completeness is more important than concise
recognition.

- Label and show all known exact fields, including both years.
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
| Edition/release marker    | Prominent                | Yes               | Yes                | Primary          | Yes               | Yes          |
| Stated age                | Once                     | Optional          | Only when integral | Exact override   | If integral       | Yes          |
| ABV                       | Yes when known           | Optional          | No                 | Optional support | Normally no       | Yes          |
| Vintage year              | Conditional              | Conditional       | Rarely             | Discriminator    | Conditional       | Yes          |
| Release year              | Conditional              | Conditional       | Rarely             | Discriminator    | Conditional       | Yes          |
| Single-cask flag          | No                       | No                | No                 | No               | No                | Yes          |
| Cask-strength flag        | No                       | No                | No                 | No               | No                | Yes          |
| Marketed cask/barrel code | As release marker        | As release marker | If needed          | Primary          | If needed         | Yes          |
| Cask type/size/fill       | No                       | Normally no       | No                 | No               | No                | Yes          |
| Category                  | No                       | No                | No                 | No               | No                | Yes          |

“No” for a derived flag does not remove identical wording that belongs to the
marketed expression or edition.

## Examples That Exercise the Rules

Examples validate these branches; they must not become named special cases in
the implementation.

| Bottle                                                | Important identity                                                              | Concise consequence                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Whiskyland Glenburgie 38-year-old, Chapter Thirty Two | `Whiskyland` is the Brand; `Chapter Thirty Two` is the release marker           | Show both; omit 1988 vintage and 2026 release from the ordinary header |
| High West A Midwinter Night's Dram, Act 12 Scene 9    | Act and scene identify the release                                              | Prefer the edition; do not also require its release year               |
| Elijah Craig Barrel Proof, Batch C923                 | `Barrel Proof` is marketed expression wording; the batch identifies the release | Preserve the expression and batch; do not add a cask-strength flag     |
| Four Roses Limited Edition Small Batch 2017           | The year is the annual release identity when no stronger marker exists          | Show the release year                                                  |
| Macallan Sherry Oak 18-year-old, 1994 Vintage         | Vintage is the marketed discriminator                                           | Show the vintage and do not manufacture another year label             |
| Willett Family Estate, Barrel 4769                    | The exact barrel code identifies the marketed release                           | Show the code; do not add `Single cask` merely from the boolean        |
| SMWS 95.71 Prepare for Winter                         | The society code and subtitle are marketed identity                             | Preserve them; age and ABV may support the detailed header             |
| Highland Park Cask Strength No. 5                     | `Cask Strength` belongs to the expression                                       | Keep the words in the title; do not repeat them as metadata            |
| Pōkeno Exploration Series No. 1 Totara Cask           | Series wording is already present in the marketed expression                    | Do not repeat the series in a second visible token                     |

## Implementation Map

The contract is applied at the presentation site that owns each branch:

- Bottle headers, result rows, previews, and tasting identities compose their
  own structured layouts from the shared Bottle fields.
- Relative release-family labels select the useful exact discriminator without
  promoting generic cask flags.
- SEO, sharing, notifications, and other unstructured consumers use concise
  plain-text identity helpers.
- Search-vector construction indexes series independently of whether a result
  surface has room to display it.
- Additional Details remains the exhaustive home for chronology, cask flags,
  and cask attributes omitted from ordinary identity.

These are intentionally separate implementation sites. They must follow the
same semantic contract, but should not be replaced by one rendering function.

## Implementation Boundary

Changes following this contract should begin at the component or text consumer
that owns the presentation. Existing specialized helpers may remain specialized
for absolute labels, relative family labels, metadata rows, and plain-text
names.

Only extract a shared semantic utility after multiple consumers demonstrably
need the same operation, such as detecting that a series or age is already
expressed by visible text. Do not introduce product-family branches or a
surface-mode API merely to centralize the rules in this document.
