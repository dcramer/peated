## 1. Durable Barcode Model

- [x] 1.1 Add GTIN normalization and validation with focused unit tests
- [x] 1.2 Add the Bottle barcode schema, relations, constraints, and actor provenance
- [x] 1.3 Generate and inspect the Drizzle migration

## 2. Barcode API

- [x] 2.1 Add shared barcode runtime schemas
- [x] 2.2 Add public list and exact lookup routes
- [x] 2.3 Add moderator upsert and delete routes with conflict handling
- [x] 2.4 Register the barcode router and preserve mappings during Bottle merges

## 3. Verification

- [x] 3.1 Add route tests for read, validation, authorization, idempotency, conflict, and deletion behavior
- [x] 3.2 Extend Bottle merge and deletion tests for barcode lifecycle behavior
- [x] 3.3 Run targeted tests, server typecheck, lint, formatting, and OpenSpec validation
