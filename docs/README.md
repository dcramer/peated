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

## Research Files

- Keep one bounded research task or scope in each dated file. Do not append
  unrelated work to a shared or monthly report.
- Group repeated work by topic, such as `research/catalog/`, and name files
  `YYYY-MM-DD-short-name.md`.
- Use a directory with a `README.md` only when the report has supporting CSV,
  JSON, or other durable evidence.
- Put reusable rules and methods in the architecture, feature, policy, or
  operations guide that owns them.
- Do not commit raw API replies, downloads, request files, or other temporary
  working data.

## Source Of Truth

Code, runtime schemas, exported types, and tests own exact behavior. Architecture
and feature documents explain durable intent and boundaries. Policies define
repo-wide defaults. Research and OpenSpec change artifacts cannot override
those owners.
