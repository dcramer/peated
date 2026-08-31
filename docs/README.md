# Documentation

Put each durable document beside the code or product area that owns it. Use one
document as the source of truth and link to it from other places.

## Directories

- `architecture/` defines durable domain models and system contracts.
- `features/` defines shipped product behavior and feature-owned lifecycles.
- `development/` explains implementation, testing, and local development.
- `operations/` contains production diagnosis and data-maintenance workflows.
- `policies/` contains repository-wide engineering rules and defaults.
- `research/` contains dated evidence and inventories. Research is not an
  active product or runtime contract.

A document can describe a workflow without belonging in `operations/`. Put it
under `features/` when it defines user-visible product behavior. Put it under
`operations/` when an operator follows it to inspect or change production.

## Source Of Truth

Code, runtime schemas, exported types, and tests own exact behavior. Architecture
and feature documents explain durable intent and boundaries. Policies define
repo-wide defaults. Research and OpenSpec change artifacts cannot override
those owners.

Keep compatibility files only when an active or historical reference still
needs the old path. `development/schema-conventions.md` and
`features/simple-rating-system.md` are current compatibility files; they do not
own independent rules.

Useful starting points:

- [Whisky Identity Model](./architecture/whisky-identity-model.md)
- [Bottle Classifier](./architecture/bottle-classifier.md)
- [Catalog Enrichment](./operations/catalog-enrichment.md)
- [Catalog Image Maintenance](./operations/entity-images.md)
- [Production Debugging](./operations/production-debugging.md)
- [Policy Index](./policies/README.md)
