## Why

Peated currently allows an official producer's corporate or house name to be stored as a Bottle's bottler merely because it appears on the product. This makes ordinary releases such as Hakushu and Hibiki display as “Bottled by Suntory,” conflicts with existing classifier regressions, and weakens the useful distinction between official releases and independent bottlings.

## What Changes

- Define `bottler` as a business that independently selects and releases whisky made by another producer.
- Leave `bottler` empty for an official Brand or distillery release.
- Continue allowing one Entity to fill both Brand and bottler when evidence establishes that it acts as an independent bottler, such as Compass Box, SMWS, or Proof and Wood.
- Use that definition in existing docs, classifier instructions, extraction guidance, and Bottle-form help.
- Add deterministic and model regression coverage for official releases and same-Entity independent bottlers.
- Inventory production assignments that confuse owners or official producers with bottlers, then correct only the evidence-backed Bottle groups after explicit approval.

## Capabilities

### New Capabilities

- `bottler-identity`: Defines when a Bottle has a bottler and how to fix wrong assignments.

### Modified Capabilities

None.

## Impact

- Affected documentation: whisky identity, Bottle classifier, catalog maintenance, and classifier glossary where applicable.
- Affected classifier code: shared Bottle identity policy and label-extraction guidance.
- Affected web copy: the Bottle form's Bottler help text.
- Affected tests and evals: official-producer negative cases and independent-bottler positive cases.
- Affected production data: Bottle groups with unsupported bottler assignments, beginning with the bounded Suntory inventory. No API or database schema change is required.
