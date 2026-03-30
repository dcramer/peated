# Schema Conventions

The authoritative model lives in [docs/architecture/whisky-identity-model.md](/home/dcramer/src/peated/docs/architecture/whisky-identity-model.md). This document focuses on extraction and normalization terms.

## Identity Layers

Bottle identity:

- `brand`
- `bottler`
- `distillery`
- `expression`
- `series`
- `category`
- `stated_age` only when stable across releases

Release identity:

- `edition`
- `release_year`
- `vintage_year`
- `stated_age` when release-specific
- `abv`
- `single_cask`
- `cask_strength`
- `cask_fill`
- `cask_type`
- `cask_size`

Single-known-release rule:

- When only one marketed form is known, release-like traits may temporarily live on the parent bottle.
- Once canonical child releases exist, those release-like traits should not also remain on the parent bottle unless they are truly part of bottle identity.

Tasting exact details:

- `edition`
- `release_year`
- `vintage_year`
- `abv`
- `single_cask`
- `cask_strength`
- `cask_number`
- `bottle_number`
- `outturn`
- `exclusive_text`
- `label_notes`

Observation-only by default:

- cask number
- barrel number
- bottle number
- outturn
- exclusive wording
- uncommon raw maturation text

## Field Definitions

- **brand**: The consumer-facing label brand.
- **bottler**: A separately stated bottling house when different from `brand`.
- **distillery**: An array of actual producing distilleries. Use `[]` when unknown.
- **expression**: The core release name after removing producer, age, ABV, and generic style words.
- **series**: A stable range or family, or `null`.
- **edition**: A simple human-facing release descriptor such as `Batch 3`, `2024 Release`, or `S2B13`.
- **category**: One of `blend`, `bourbon`, `rye`, `single_grain`, `single_malt`, or `single_pot_still`.
- **stated_age**: The age in years as an integer, or `null` if there is no age statement.
- **abv**: Alcohol by volume as a percentage, for example `43.0`.
- **release_year**: The bottling or release year.
- **vintage_year**: The distillation or vintage year, or `null`.
- **cask_type**: The primary cask type or finish, or `null`.
- **cask_strength**: `true` only when the label explicitly says cask strength, barrel proof, full proof, natural strength, or an equivalent phrase. Otherwise `null`.
- **single_cask**: `true` only when the label explicitly says single cask, single barrel, or an equivalent phrase. Otherwise `null`.

## Label Components

Treat a label or retailer title as a bundle of bottle-identity components:

- **producer / bottler**: The top-level producer name that usually maps to `brand`.
- **distillery**: The actual producing distillery or distilleries, which may differ from `brand` for independent bottlings.
- **expression**: The core release name after removing producer, age, ABV, and generic style words.
- **series**: The stable collection or range, such as `Private Selection` or `Distillers Edition`.
- **edition**: A batch number, store-pick code, release code, or numbered edition such as `Batch 3`, `2021 Release`, or `S2B13`.
- **category**: The normalized house category. If the whisky type is unclear, leave it `null` instead of forcing a broader fallback.
- **age statement**: Numeric age, including abbreviations such as `12 Yr.` or `16yr`.
- **cask descriptor**: Primary cask or finish wording such as `First Fill Bourbon` or `PX Cask Finish`.
- **technical details**: ABV, vintage year, release year, plus explicit cask-strength and single-cask flags.

These are identity components:

- producer or bottler
- distillery
- expression
- series
- edition or store-pick code
- age statement
- cask finish
- cask-strength and single-cask indicators
- ABV, vintage year, and release year

These are usually noise and should not drive matching on their own:

- volume and pack size such as `50ml`, `750ml`, `1L`, or `1.75L`
- gift sets, tins, glassware, mugs, and sampler bundles
- retailer SEO words such as `Scotch Whisky`, `Kentucky Bourbon Whisky`, or `American Whiskey` when they only restate the category
- ratings blurbs, tasting notes, medals, and shelf-talker copy
- pricing, shipping, and legal text

These should usually be preserved as observations instead of forcing a canonical split:

- exact cask or barrel numbers
- bottle counts or outturn
- `store pick`, `exclusive`, `private barrel`, or similar merchandising text when it is not part of the marketed canonical release name
- retailer-specific title suffixes

## Release Year Rules

- Extract `release_year` if it is explicitly labeled as bottling or release year.
- If there is no explicit label, extract a standalone four-digit year near ABV, batch, or edition information.
- Ignore unrelated dates such as distillery founding years or government warnings.
- If multiple years are present, use `vintage_year` for the distillation year and `release_year` for the bottling year.
- If no valid release year is present, set `release_year` to `null`.

## Normalization Guidelines

### Brand vs. Distillery

- If the whiskey is an official distillery bottling, `brand` is the distillery name and `distillery` contains that same name.
- If the whiskey is a blend from multiple distilleries, `distillery` should list all known contributors.
- If the distilleries are unknown, use `distillery: []`.
- If the whiskey is an independent bottling, set `brand` to the bottler and `distillery` to the actual producer or producers.

### Age Statements

- Extract stated age as an integer.
- If there is no age statement, use `null`.
- When the age is part of the expression, format it as `"12-year-old"`.

### ABV

- Extract ABV as a decimal percentage, for example `"abv": 46.3`.

### Series and Edition

- Extract a named stable family into `series`.
- Extract a release label like `"Batch 3"` or `"2021 Release"` into `edition`.
- Do not use `series` for one-off batch codes, annual years, or exact cask numbers.

### Cask Type

- Extract any maturation or finishing cask into `cask_type`.

### Uncertainty

- If a component is ambiguous, prefer `null` or `[]` over guessing.
- In extraction and matching, a missed component is safer than a false identity signal.

### Multiple Distilleries

- List all known distilleries for blends.
- If the distilleries are unspecified, use `[]` rather than guessing.
- For a single malt, `distillery` should contain one value.

### Edge Cases

- Correct obvious typos or near matches such as `"Ardbeg Supanova"` to `"Ardbeg Supernova"`.
- If a year is present but ambiguous, use judgment but do not invent details.
- For multiple dates like `"Distilled in 1998, Bottled in 2018"`, set `vintage_year: 1998` and `release_year: 2018`.

## Matching Heuristics

- Compare candidate bottles in this order: producer, distillery, expression, series, age, edition, category, cask details, single-cask and cask-strength flags, then ABV and year fields.
- Prefer bottle-level matches when bottle identity is clear but release identity is weak.
- Missing generic style words like `single malt` are weak evidence.
- Conflicting age statements, edition codes, store-pick codes, barrel descriptors, or single-cask indicators are strong evidence that two listings are different bottles.
- For independent bottlings, evaluate `brand` and `distillery` separately.
- Bias toward `no_match` or manual review when the decisive identity components are weak or conflicting. A false match is worse than an unresolved listing.
- Preserve exact details as observations even when they are not strong enough to define a canonical release.

## Retailer Title Examples

Reviewed on March 11, 2026:

- [Total Wine: Grangestone Sherry Finish Scotch Whisky](https://www.totalwine.com/spirits/deals/scotch/single-malt/grangestone-sherry-finish-scotch-whisky/p/159826750?s=1203&igrules=true)
  The title drops `single malt`, so the generic category words are less reliable than the producer and finish.
- [Total Wine: Paul John Mithuna Indian Single Malt Whisky](https://www.totalwine.com/spirits/whiskey/indian-whisky/paul-john-mithuna-indian-single-malt-whisky/p/240707750?s=1203&igrules=true)
  This is a single malt outside Scotch, so retailer navigation should not override the actual style.
- [Astor Wines: Aberfeldy 12 Yr. Single Malt Scotch Whisky](https://www.astorwines.com/item/30667)
  Age appears as `Yr.`, which should still normalize to `stated_age: 12`.
- [Astor Wines: Ardbeg Uigeadail Single Malt Scotch Whisky](https://www.astorwines.com/item/15732)
  The expression sits between the producer and generic style wording.
- [ReserveBar: Maker's Mark Private Selection Kentucky Bourbon Whisky S2B13](https://www.reservebar.com/products/makers-mark-private-selection-kentucky-bourbon-whisky-s2b13/GROUPING-1258625.html)
  The trailing code behaves like an edition or store-pick identifier and should not be discarded.
- [ReserveBar: Michter's US\*1 American Whiskey](https://www.reservebar.com/products/michters-us1-american-whiskey/GROUPING-77812.html)
  Punctuation-heavy range names such as `US*1` are part of the bottle identity and should be preserved.
