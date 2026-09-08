## 1. Vocabulary Data

- [x] 1.1 Curate the documented, researched, and normalized tasting-note vocabulary
- [x] 1.2 Validate canonical-name, synonym, category, and length invariants before migration generation

## 2. Database Synchronization

- [x] 2.1 Generate a custom Drizzle data migration that upserts the normalized vocabulary
- [x] 2.2 Normalize declared replacements across tasting tags and bottle suggested tags
- [x] 2.3 Rebuild affected bottle counts from normalized tastings and remove replaced tag rows
- [x] 2.4 Remove explicit and legacy vocabulary-loading CLI commands

## 3. Tasting Picker

- [x] 3.1 Match tasting-note searches against canonical names, synonyms, and categories
- [x] 3.2 Replace randomized unused-tag ordering with deterministic common fallbacks

## 4. Verification

- [x] 4.1 Run the complete migration against a fresh database and verify normalization invariants
- [x] 4.2 Run targeted server/web checks, formatting, lint, and typechecks
