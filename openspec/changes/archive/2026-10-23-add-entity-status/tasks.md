## 1. Data model and API

- [x] 1.1 Add the Entity status enum and nullable column, document Entity location as origin beside the schema fields, and generate the migration.
- [x] 1.2 Add status to Entity schemas, serializers, create and update behavior, with final kind-and-status validation.
- [x] 1.3 Add status filtering to Entity list contracts and routes.

## 2. Web interface

- [x] 2.1 Add kind-appropriate status choices to the Entity form and label Entity location as Origin.
- [x] 2.2 Show known status and Origin in Entity details without placeholders for missing values.

## 3. Verification and documentation

- [x] 3.1 Add or update backend and web tests for status reads, writes, validation, filtering, and display.
- [x] 3.2 Update lasting Entity documentation and generated API artifacts, then run focused formatting, lint, tests, and typechecks.
