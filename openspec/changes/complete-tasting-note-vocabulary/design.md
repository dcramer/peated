## Context

Peated stores tasting-note names directly in tasting arrays and validates them against the `tag` table. Each tag has synonyms and exactly one of nine broad tasting-wheel categories. Production currently has 374 tags installed by historical data migrations. The picker and external-review matcher already read the database vocabulary, so missing canonical names and synonyms are the coverage problem.

The previous expansion synthesized several sources but did not retain a current coverage matrix. A read-only audit of all 711 currently visible, bottle-linked published review clips found recurring uncovered wording, including `fruits`, `sweet`, `bitter`, `peppery`, `herbs`, `coastal`, `ashes`, `sour`, `saline`, `seawater`, `camphor`, `fir`, `mustard`, `vegetal`, and `varnish`.

## Goals / Non-Goals

**Goals:**

- Cover the aroma and flavor descriptors in the Scotch Whisky Research Institute wheel, the Whisky Magazine Scotch wheel, the Council of Whiskey Masters bourbon wheel, and the WSET Level 3 Spirits Lexicon where the terms can describe whisky.
- Include additional concrete descriptors observed in Peated's published review clips.
- Give every canonical descriptor exactly one existing Peated tasting-wheel category.
- Represent plurals, adjective forms, spelling variants, and interchangeable phrases as synonyms.
- Preserve a checked-in coverage inventory with evidence and explicit exclusions.
- Install additions and synonym updates without changing historical tasting selections.

**Non-Goals:**

- Texture, body, alcoholic heat, finish length, appearance, quality judgments, or general praise and criticism.
- A hierarchical ontology, intensity scale, or user-created tags.
- New tasting-wheel categories or changes to the separate bottle flavor-profile classification.
- Every imaginable compound phrase. Compositional notes remain separate tags unless the phrase is an established sensory reference with a distinct meaning.

## Decisions

### Define comprehensive coverage against named sources

The coverage inventory will synthesize the complete relevant descriptor sets from the selected Scotch, bourbon, and spirits references. It will record each accepted canonical name, synonyms, Peated category, and source family. It will also record exclusions by rule so "comprehensive" is reviewable rather than an unbounded claim.

Alternative considered: add only terms observed in recent Peated reviews. Rejected because the current review corpus is weighted toward a few publications and cannot represent the full range of whisky styles or recognized faults.

### Keep the existing nine-category wheel

Every addition maps to `cereal`, `fruit`, `floral`, `smoke`, `earthy`, `sulfur`, `sweet`, `spice`, or `wood`. Mapping follows the existing rule: classify the concrete thing the note resembles, not its chemical cause or production origin. Established source families guide ambiguous cases, while Peated's current category meanings keep neighboring terms together.

Examples:

- `varnish` maps to `wood`, with `wood varnish` and `varnished wood` as synonyms.
- `camphor`, `TCP`, and `antiseptic` map to `smoke` with other medicinal notes.
- `cardboard`, `dust`, `paraffin`, and `soapy` map to `earthy` with other aged, waxy, oily, and stale notes.
- `sweet` maps to `sweet`, `sour` maps to `fruit`, and `bitter` maps to `wood`; texture-only terms remain excluded.

Alternative considered: add primary-taste, texture, industrial, and stale categories from larger professional wheels. Rejected for this change because the product wheel is a flavor-family distribution with fixed positions. New dimensions would change aggregation and presentation semantics rather than merely completing the vocabulary.

### Prefer useful canonical concepts over phrase explosion

Canonical names use lowercase, normalized whitespace, and singular nouns where natural. A term becomes canonical when it is a recognizable sensory reference that users may select independently. Number variants, adjective forms, alternate spellings, and phrases that mean the same thing become synonyms. Established compounds such as `wet concrete`, `pipe tobacco`, and `white chocolate` remain canonical because they evoke a different reference from their component words.

Alternative considered: create a canonical tag for every source phrase. Rejected because combinations such as `stewed apple` can already be expressed by `stewed fruit` plus `apple`, and unlimited adjective-noun combinations would make search noisy without adding meaning.

### Use a generated custom migration for deployment

The implementation will generate a custom Drizzle migration, then populate it from the reviewed inventory. It will insert missing canonical rows and merge declared synonyms into existing rows. The migration will fail if a target canonical row has a different category, if an alias collides with another canonical name, or if any expected row is absent after installation.

The migration will not rename or delete existing tags. This avoids rewriting stored tasting arrays or bottle aggregates for a vocabulary-completion change.

### Validate the inventory independently of the migration

A focused test will check lowercase and whitespace normalization, the 64-character database limit, valid categories, unique canonical names, unique normalized synonyms, and category coverage. Representative extraction tests will prove that newly added canonical names and repaired aliases are recognized.

## Risks / Trade-offs

- [A very broad picker can become harder to scan] → Keep category grouping and search; use aliases instead of duplicate canonicals and do not add arbitrary compounds.
- [Professional wheels disagree about categories] → Apply Peated's resemblance-based category rule consistently and document ambiguous mappings in the inventory.
- [Some professional terms are obscure or unpleasant] → Include concrete recognized aromas and faults because a public tasting record must describe negative experiences as accurately as positive ones.
- [A source term may be copyrighted as part of a wheel presentation] → Synthesize individual factual descriptors, cite sources, and do not reproduce source artwork, prose, or arrangement.
- [The database can drift from the checked-in inventory through admin edits] → Treat the inventory as the reviewed baseline and verify migration results; future additions must update the inventory and use a follow-up migration.

## Migration Plan

1. Add and validate the checked-in coverage inventory.
2. Generate a custom Drizzle migration.
3. Insert missing canonical tags and merge reviewed aliases into existing tags.
4. Run the migration against the test database and verify expected names, aliases, and categories.
5. Deploy through the normal migration path. Rollback, if required before dependent data is written, removes only newly inserted rows and restores changed synonym arrays from the migration's reviewed before-state.

## Open Questions

None.
