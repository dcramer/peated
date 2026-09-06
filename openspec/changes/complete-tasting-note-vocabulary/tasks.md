## 1. Vocabulary Inventory

- [x] 1.1 Create the comprehensive source-backed descriptor inventory with canonical names, synonyms, evidence groups, and one existing tasting-wheel category per entry
- [x] 1.2 Record exclusions and ambiguous mapping decisions beside the inventory
- [x] 1.3 Add validation for names, synonyms, collisions, lengths, and category coverage

## 2. Database Migration

- [x] 2.1 Generate a custom Drizzle migration for the vocabulary completion
- [x] 2.2 Insert missing canonical descriptors with their reviewed synonyms and categories
- [x] 2.3 Merge reviewed synonym additions into existing tags and add post-migration assertions

## 3. Behavior Verification

- [x] 3.1 Extend review-tag extraction tests for representative new canonical descriptors and aliases
- [x] 3.2 Verify the migration against a fresh test database and check expected vocabulary counts and mappings

## 4. Quality Checks

- [x] 4.1 Format and lint changed files
- [x] 4.2 Run focused server tests and the server typecheck
