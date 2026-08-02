## Why

Peated's tasting-note picker offers only a small controlled vocabulary, omits many common whisky descriptors, and does not search the synonyms already supported by the tag model. Users therefore struggle to record the flavors they perceive, which limits both the tasting experience and the value of aggregated note data.

## What Changes

- Add a substantially broader, researched vocabulary of canonical tasting-note descriptors covering Scotch, bourbon, rye, Irish, and other whiskies.
- Document the vocabulary conventions beside its source data: lowercase canonical names, singular terms where natural, aliases for alternate wording, and one existing whisky-wheel category per descriptor.
- Normalize existing plural/style variants while preserving historical tasting selections, bottle suggestions, and aggregate counts.
- Search tasting notes by canonical name and synonyms in the existing picker.
- Replace randomized unused-tag fallbacks with a small deterministic set of common descriptors.
- Leave the separate bottle `flavorProfiles` classification out of scope; new tasting-note vocabulary does not maintain that mapping.

## Capabilities

### New Capabilities

- `tasting-note-vocabulary`: Defines the curated vocabulary, normalization rules, whisky-wheel mapping, synonym lookup, and picker suggestion behavior.

### Modified Capabilities

None.

## Impact

- Tasting-note tag data populated through the normal database migration path.
- Tag schemas, serialization, validation, and search behavior.
- Bottle suggested-tag ordering and the web tasting form's existing flavor selector.
- Existing tasting, bottle-suggestion, and bottle-tag data only where declared variants are normalized.
