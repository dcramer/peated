## 1. Catalog Contract

- [x] 1.1 Update the whisky identity, classifier, catalog-maintenance, and glossary documentation to define Bottler and state that official releases have no bottler.
- [x] 1.2 Update the Bottle form help text so moderators see the same distinction.

## 2. Classifier Behavior

- [x] 2.1 Align shared classifier and image-extraction instructions with the corrected bottler boundary.
- [x] 2.2 Add or strengthen deterministic instruction tests for official-producer negative cases and same-Entity independent-bottler positive cases.
- [x] 2.3 Run the focused classifier tests, lint, formatting, and relevant typechecks.

## 3. Production Inventory

- [x] 3.1 Build a read-only manifest of every active Bottle and BottleGroup using Suntory E1383 as bottler, with current identity and proposed status.
- [x] 3.2 Identify other bounded candidate sets where an owner, official producer, distributor, or house mark may be incorrectly assigned as bottler; leave evidence-ambiguous rows unresolved.
- [ ] 3.3 Record the exact approved production changes after the corrected classifier rule is deployed.

## 4. Production Correction

- [ ] 4.1 Immediately re-read each approved BottleGroup and stop on identity, membership, or bottler drift.
- [ ] 4.2 Clear confirmed unsupported bottler assignments in small explicit-ID batches.
- [ ] 4.3 Re-fetch every changed Bottle and group, verify unrelated identity fields, and reconcile Bottle and Entity counts.
