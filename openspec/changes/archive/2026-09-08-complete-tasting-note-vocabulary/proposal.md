## Why

Peated's 374 tasting-note tags still omit many established whisky descriptors and common wording found in Peated reviews. Adding isolated tags leaves the picker and review-tag extractor with recurring blind spots, so the vocabulary needs a comprehensive, reviewable inventory mapped to the existing tasting wheel.

## What Changes

- Add the missing aroma and flavor descriptors from established Scotch, bourbon, and general spirits tasting vocabularies, supplemented by recurring language in Peated's published review clips.
- Map every canonical descriptor to exactly one existing tasting-wheel category according to what the note resembles: cereal, fruit, floral, smoke, earthy, sulfur, sweet, spice, or wood.
- Add missing plural, adjective, spelling, and alternate-phrase synonyms to existing tags instead of creating duplicate concepts.
- Keep evaluative language, appearance, serving context, finish length, and texture-only terms out of the flavor-tag vocabulary.
- Record the complete audited inventory and evidence so future additions can be checked against a maintained baseline rather than historical migrations alone.
- Install additions and synonym updates through a generated custom data migration, without rewriting historical migrations or changing stored tasting selections.

## Capabilities

### New Capabilities

- `tasting-note-vocabulary`: Defines the comprehensive, evidence-backed descriptor inventory, tasting-wheel mapping rules, synonym rules, exclusions, and migration verification.

### Modified Capabilities

None.

## Impact

- Tasting-note tag data and synonyms installed through the server's normal database migration path.
- Review-tag extraction and tasting-picker search gain coverage automatically because they already consume tag names and synonyms.
- A checked-in vocabulary inventory and validation test become the maintained audit surface.
- The nine-category tasting wheel, tag API shape, stored tasting arrays, and bottle flavor-profile taxonomy remain unchanged.
