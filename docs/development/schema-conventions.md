# Schema Conventions

This document captures the whisky schema terminology and normalization rules used across extraction, matching, and bottle modeling work.

## Field Definitions

- **brand**: The brand or bottler of the whiskey.
- **distillery**: An array of distilleries where the whiskey was produced. For example, `[ "Macallan", "Highland Park" ]` for a blend, or `[ "Lagavulin" ]` for a single distillery release. If the distilleries are unknown, use `[]`.
- **expression**: The specific name or expression of the whiskey.
- **series**: The series or collection name, or `null`.
- **category**: One of `blend`, `bourbon`, `rye`, `single_grain`, `single_malt`, or `single_pot_still`.
- **stated_age**: The age in years as an integer, or `null` if there is no age statement.
- **abv**: Alcohol by volume as a percentage, for example `43.0`.
- **release_year**: The bottled or release year.
- **vintage_year**: The distillation or vintage year, or `null`.
- **cask_type**: The primary cask type or finish, or `null`.
- **edition**: A batch, edition, or release identifier, or `null`.

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

- Extract a named series into `series`.
- Extract a release label like `"Batch 3"` or `"2021 Release"` into `edition`.

### Cask Type

- Extract any maturation or finishing cask into `cask_type`.

### Multiple Distilleries

- List all known distilleries for blends.
- If the distilleries are unspecified, use `[]` rather than guessing.
- For a single malt, `distillery` should contain one value.

### Edge Cases

- Correct obvious typos or near matches such as `"Ardbeg Supanova"` to `"Ardbeg Supernova"`.
- If a year is present but ambiguous, use judgment but do not invent details.
- For multiple dates like `"Distilled in 1998, Bottled in 2018"`, set `vintage_year: 1998` and `release_year: 2018`.
