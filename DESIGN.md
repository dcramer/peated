---
version: alpha
name: Peated
description: A dense, reference-first whisky database with quiet chrome and one warm accent.
colors:
  primary: "#9a5b12"
  primary-dark: "#d9922f"
  primary-deep: "#6e400c"
  primary-deep-dark: "#e8a752"
  primary-tint: "rgb(154 91 18 / 0.15)"
  primary-tint-dark: "rgb(217 146 47 / 0.15)"
  neutral: "#f7f8f5"
  neutral-dark: "#101210"
  surface: "#ebeee7"
  surface-dark: "#1b1e1a"
  inset: "#dce0d6"
  inset-dark: "#2b2f29"
  image-background: "#ffffff"
  image-background-dark: "#ffffff"
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
    fontSize: 72px
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: -0.05em
  section-heading:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.025em
  row-title:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.025em
  body:
    fontFamily: Karla
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  interactive:
    fontFamily: Karla
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.2
  metadata:
    fontFamily: Karla
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
  field-label:
    fontFamily: Karla
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  micro-label:
    fontFamily: Karla
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
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
  image-frame-light:
    backgroundColor: "{colors.image-background}"
    rounded: "{rounded.control}"
  image-frame-dark:
    backgroundColor: "{colors.image-background-dark}"
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
  list-divider-light:
    backgroundColor: "{colors.hairline}"
    height: 1px
  list-divider-dark:
    backgroundColor: "{colors.hairline-dark}"
    height: 1px
---

# Peated design

This document defines Peated's durable visual system. It does not inventory
React components or define product data and route behavior. Storybook owns
component usage and visible states. Feature and architecture documents own
product behavior and data rules.

## Overview

Peated is a whisky database first. It is a reference work with community data,
not a social feed with reference data attached.

- Prefer useful density over decorative space.
- Let real data provide character through ratings, distributions, counts, and
  identifiers.
- Keep product chrome quiet so bottle images and long text remain clear.
- Treat missing data as a normal state.
- Offer a contribution path when a member can supply missing data.

## Colors

The operating system selects the light or dark color scheme. The product does
not keep separate theme state. Storybook can switch schemes for review.

| Token             | Light      | Dark       | Use                              |
| ----------------- | ---------- | ---------- | -------------------------------- |
| `ground`          | `#F7F8F5`  | `#101210`  | Page background                  |
| `surface`         | `#EBEEE7`  | `#1B1E1A`  | Deliberate groups and overlays   |
| `inset`           | `#DCE0D6`  | `#2B2F29`  | Fields and neutral tracks        |
| `imageBackground` | `#FFFFFF`  | `#FFFFFF`  | Catalog image canvas             |
| `ink`             | `#161914`  | `#E8EAE3`  | Main text and committed actions  |
| `inkMuted`        | 75% ink    | 75% ink    | Secondary text and metadata      |
| `accent`          | `#9A5B12`  | `#D9922F`  | Active state, links, and ratings |
| `accentDeep`      | `#6E400C`  | `#E8A752`  | Accent text on a tint            |
| `accentTint`      | 15% accent | 15% accent | Selected and related data        |
| `dataAccent`      | 42% accent | 42% accent | Secondary data fills             |
| `ratingFill`      | 75% accent | 75% accent | Compact rating distributions     |
| `ratingTrack`     | `#CBD0C2`  | `#3A3F37`  | Rating tracks on tonal surfaces  |
| `passportEmpty`   | 16% ink    | 16% ink    | Unstamped passport cells         |
| `hairline`        | 11% ink    | 11% ink    | Dividers in repeated content     |
| `sectionRule`     | 16% ink    | 16% ink    | Page and footer boundaries       |

Use one warm accent. Do not add a second accent or use red and green as
sentiment poles.

## Typography

- **Space Grotesk** is the display face for names, headings, and meaningful
  figures.
- **Karla** is the reading face for prose, labels, and member input.
- **IBM Plex Mono** is available for rare values that must align as code-like
  data. Normal metadata and field labels use Karla.

| Role            | Family  | Weight | Size and line height | Tracking |
| --------------- | ------- | ------ | -------------------- | -------- |
| Page title      | Display | 700    | 40–72px / 0.95       | -0.05em  |
| Section heading | Display | 700    | 20px / 1.2           | -0.025em |
| Row title       | Display | 700    | 18px / 1.25          | -0.025em |
| Body            | Reading | 400    | 15px / 1.6           | normal   |
| Interactive     | Reading | 600    | 15px / 1.2           | normal   |
| Metadata        | Reading | 400    | 13px / 1.45          | normal   |
| Field label     | Reading | 400    | 13px / 1.4           | normal   |
| Micro label     | Reading | 400    | 13px / 1.4           | normal   |

Use tabular numerals for aligned numbers. Use uppercase text only for short
data labels. Do not use the display face for body copy.

## Layout

The spacing scale uses 4px steps: 4, 8, 12, 16, 24, 32, and 48px. Prefer these
values before adding a local exception.

- Start each page on `ground`. Use spacing and type for hierarchy.
- Add `surface` only when a bounded group or overlay needs a clear container.
- Use 34px, 40px, and 44px control heights. Use 40px by default and at least
  44px on narrow screens or coarse pointers.
- Give controls in the same action row the same height.
- Start with content that works at 320px without horizontal page overflow.
- Preserve information order when columns collapse.

## Elevation & Depth

Floating overlays use `0 18px 40px` with 16% light ink or 55% black in dark
mode. Other elements do not use shadows.

Keep stacking local to the component. Search overlays cover ordinary page
controls. Dialogs cover non-dialog overlays. A trigger can cover its own menu,
but it must not cover unrelated overlays.

## Shapes

- Controls and deliberately framed regions use a 3px radius.
- Chips, tags, image slots, and bar segments use a 2px radius.
- Do not use pills.
- A framed region has a complete four-sided border.
- Use one-edge rules only as real separators inside repeated content, tabs,
  menus, tables, or fixed page chrome.

## Components

This section defines rules shared by component atoms. Individual component
anatomy, props, usage, and visible states belong in Storybook and component
JSDoc.

### Interaction

- Give every interactive control a visible hover, pressed, disabled, and
  keyboard-focus state.
- Each control owns a clear keyboard-focus treatment. Do not add a global ring
  without updating the shared control tokens.
- Do not use a pointer cursor as the only interaction state.
- Use accent for one main action per view. Use tonal controls for secondary
  actions.
- Do not let button labels wrap.
- Keep a complete linked row actionable while keeping its nested links and
  controls independently clickable.
- Keep menus and typeahead results in overlays with local shadows and stacking.
- Respect reduced-motion preferences.

### Composition

- Prefer flat sections on the page ground.
- Do not use filled cards as the default section treatment.
- Use a complete frame only when it materially groups related content.
- Keep dividers between repeated rows. Do not add a divider after the last row.
- Use the same visual foundations in the public product and admin.
- Keep errors inside the section that failed when the rest of the page still
  works.

### Images and data

- Put catalog images on a white canvas with a complete frame. Do not assume
  source images have useful transparency.
- State precise values. Do not replace known numbers with vague labels.
- Do not invent data, rankings, totals, ranges, or derived values in a visual
  component.
- Keep data tracks visible against every hover and selected state.
- Do not add decorative axis labels to compact distributions.

### Storybook

Storybook is the living reference for implemented components. Start a component
with one Overview story with useful variants and controls. Add another named
story only for a meaningful behavior, state, permission boundary, error, or
responsive composition. Use concise JSDoc and Storybook descriptions to explain
when to use the component and what it owns.

Complete routes stay in the application. Stories render the same components
used by product screens. They do not contain visual copies or route-specific
mock pages.

## Do's and Don'ts

- Do use spacing and typography before adding a container.
- Do give links and buttons keyboard focus treatment in addition to hover.
- Do frame catalog images on white.
- Do use four-sided borders for framed regions.
- Don't use a one-sided border as decoration.
- Don't use shadows outside overlays.
- Don't add a new component when an existing component owns the same task.
- Don't put product data contracts or implementation plans in this document.
