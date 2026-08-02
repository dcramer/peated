## Context

Tastings store selected tag names in a `varchar[]`, tags are validated against the `tag` table, and bottle-level counts are maintained in `bottle_tag`. The tag table already supports aliases through `synonyms` and requires one of the eight whisky-wheel `tagCategory` values, so expanding the vocabulary does not require a new taxonomy or tasting schema.

The existing vocabulary is database-managed and has no checked-in source of truth. It contains 83 terms, no populated synonyms, several common omissions, and 21 names that the normalized vocabulary replaces. Most are plural or stylistic forms; `juicy pear` and `juicy pears` are the one confirmed pair that coexist in production. The tasting form already provides five quick chips and a searchable dialog; the missing behavior is better data, alias matching, and deterministic fallbacks.

## Goals / Non-Goals

**Goals:**

- Check in and document a researched, normalized whisky tasting-note vocabulary as migration data.
- Cover common descriptors across Scotch and American, Irish, and world whiskies while retaining the existing eight-category wheel mapping.
- Install vocabulary additions and normalize declared variants safely through the standard migration path.
- Make the existing picker find canonical terms through synonyms.
- Keep quick suggestions useful when a bottle or brand has little tag history.

**Non-Goals:**

- New tasting context, intensity, taxonomy versioning, subcategories, or user-created tags.
- A new picker interaction or data model.
- Maintaining or repairing the separate bottle `flavorProfiles` classification.
- Broad semantic deduplication of existing adjective or intensity variants.

## Decisions

### Keep the vocabulary in a documented data migration

The generated custom migration contains canonical names, synonyms, and one `tagCategory` for each descriptor. Its header describes normalization rules and research sources. This keeps the deployed database change reviewable and ensures each environment installs it exactly once without a separate operational command.

Alternative considered: keep editing tags only through the admin UI. Rejected because hundreds of entries and aliases would be difficult to review, reproduce, and keep normalized.

### Install through a generated custom migration

A Drizzle-generated custom migration upserts the vocabulary into the tag table. Declared replacement names are normalized transactionally across tasting tag arrays and bottle suggested-tag arrays. Affected `bottle_tag` aggregates are rebuilt from normalized tastings before replaced tag rows are removed.

Alternative considered: use an explicit CLI synchronization command. Rejected because it adds an operational deployment step, can drift between environments, and is unnecessary for this one-time data rollout. Future vocabulary additions can use focused follow-up data migrations.

### Normalize canonical names without over-normalizing concepts

Canonical values will be lowercase with normalized whitespace. Count nouns will generally use the singular form, while mass nouns and customary collective descriptors such as `smoke`, `dried fruit`, and `baking spices` retain their natural form. Plurals, spelling variants, and close alternate phrasings belong in `synonyms`. Only the 21 verified number/style variants in existing data will be migrated; broader overlap remains untouched.

### Reuse the current picker

The existing five chips, dialog, and saved tag-name payload remain unchanged. Client-side filtering will include canonical name, synonyms, and category. Suggested tags will continue to prioritize bottle and brand history, with a fixed common-note list used instead of random order for unused terms.

## Risks / Trade-offs

- [A broad vocabulary can contain debatable mappings] → Use established whisky wheels as the category backbone, cross-check broader terms against spirits and American-whiskey research, and document that categories are aggregation buckets rather than claims about flavor origin.
- [Renaming a historical tag can lose aggregate counts] → Normalize stored arrays, then rebuild affected `bottle_tag` rows from tasting data before deleting a replaced tag.
- [Migration data can accidentally diverge from its authored vocabulary] → Generate the SQL values mechanically from the validated vocabulary, then make the migration the checked-in deployment artifact.
- [Several existing tags remain semantically overlapping] → Preserve them to keep this change focused; do not add new case or singular/plural duplicates.
