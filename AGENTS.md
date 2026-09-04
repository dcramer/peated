Peated is a public record of whisky, freely accessible to everyone.

## Core Principles

- Make whisky data accurate, complete, and publicly available.
- Protect database IDs, links, ownership, history, and user data. Limit changes
  and verify results.
- Record evidence. Never present guesses as facts; leave weak or conflicting
  facts unknown.
- Write for everyday people in code, docs, and explanations. Use familiar names,
  common words, short sentences, and active voice. Keep terms consistent and
  explain necessary whisky terms.
- Respect privacy, permissions, licenses, and source sites. Make clear who can
  change what.
- Solve the current problem with small functions and modules, plain objects,
  and simple types. Do not add options, extra steps, or new concepts without a
  current need.

## Commands

- Use `pnpm`; versions for pnpm and Node.js are in `package.json`.
- Common commands: `pnpm install`, `pnpm dev`, `pnpm dev:server`, `pnpm dev:web`,
  `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format`.

| Task             | Command                                                         |
| ---------------- | --------------------------------------------------------------- |
| Lint             | `pnpm exec oxlint path/to/file.ts --fix`                        |
| Format           | `pnpm exec prettier --write path/to/file.ts`                    |
| Backend test     | `pnpm --filter @peated/server test -- src/path/to/file.test.ts` |
| Server typecheck | `pnpm --filter @peated/server typecheck`                        |
| Web typecheck    | `pnpm --filter @peated/web typecheck`                           |

## Workflow

- Inspect, make the smallest complete change, verify, summarize.
- Use stored IDs, kinds, and relationships; do not guess from names or placement.
- Find and change all affected uses, including tests, sample data, stories,
  and docs. Remove code made unnecessary by the change. Preserve compatibility
  only when required.
- Pass unexpected errors to their handler. Retry only expected temporary failures.
- Comment beside code that enforces an important rule; name the rule and owner.
- Keep lasting explanations with their code or feature. Delete completed plans.
- Run focused tests, typechecks, lint, and formatting. Use manual QA for behavior
  they cannot prove; report skipped checks. Full `pnpm test` must pass in PR CI.

## Catalog Operations

- Treat `catalog <scope>` as a request to complete that production catalog
  scope, not to add a sample or return a research report. Follow Catalog
  Maintenance through inventory, evidence-backed writes, and verification.
- Before backfills, duplicate cleanup, or production Bottle edits, follow
  Catalog Maintenance and Whisky Identity Model: inventory, evidence, approval,
  and verification.
- Use the producer's stable product name for Bottle `name`; do not build it from
  age, year, strength, or other fields. Verify each Bottle after writing.

## Testing

- Write tests from the required behavior, not from the code being tested.
- Backend tests are integration-first.
- Test frontend logic and actions, not appearance. Check visuals in a browser.
- Keep deterministic tests (`pnpm test`) separate from live model checks
  (`pnpm evals`).
- Extend the test or model check that owns a behavior; avoid duplicate coverage.

## Architecture

- Routes: `apps/server/src/orpc/routes/<domain>/`, one file per operation.
- Serializers: `apps/server/src/serializers/*`; call `attrs()` and `item()` through
  `serialize(...)`.
- Generate migrations with `pnpm db:generate`. Never hand-write migration SQL or
  manually edit `apps/server/migrations/meta/*`.
- `pnpm dev*` loads `.env.local`; backend tests load `.env.test`.
- Direct database-backed CLI command groups are legacy. Do not add or recommend
  them for operations. Add a protected API route and use the authenticated API
  client instead.

## Production Access

- API: `https://api.peated.com`, not `https://peated.com`.
- Use `pnpm cli auth ...` for OAuth and `pnpm cli api ...` for production API
  reads and writes. These are the only supported production CLI surfaces.
- Sentry: organization/project `peated/peated` at `https://peated.sentry.io`.
  Use [Sentry CLI](https://cli.sentry.dev) (`sentry`) with target detection;
  specify `peated/peated` only if detection is wrong.
- Sentry output: `--json`, needed fields, small `--limit`. Full events and requests
  can contain sensitive data.

## Documentation

Read the relevant guides below. Skills use `.agents/skills`; temporary OpenSpec
changes and tool instructions are omitted. Code, schemas, types, and tests define
behavior; research cannot override them.

### Understand Peated

- `DESIGN.md` — Visual rules.
- `docs/architecture/account-access.md` — Terms and email verification rules.
- `docs/architecture/bottle-classifier-glossary.md` — Classifier terms.
- `docs/architecture/bottle-classifier.md` — Bottle classification.
- `docs/architecture/bottle-reference-normalization.md` — Safe reference-name cleanup.
- `docs/architecture/bottle-reference-resolution.md` — Bottle lookup and assignment.
- `docs/architecture/entity-classifier.md` — Entity classification.
- `docs/architecture/oauth-clients.md` — OAuth client and token flow.
- `docs/architecture/peated-ids.md` — Public IDs.
- `docs/architecture/ratings.md` — Tastings, reviews, scores, and totals.
- `docs/architecture/store-price-matching.md` — Store-price matching and review.
- `docs/architecture/web-caching.md` — Public and signed-in caching.
- `docs/architecture/whisky-identity-model.md` — Bottle and Entity identity rules.
- `docs/features/bottle-entry-workflow.md` — Bottle creation and editing.
- `docs/features/bottle-presentation.md` — Bottle display rules.
- `docs/features/external-reviews.md` — External review storage and publication.
- `docs/features/moderation-workspace.md` — Moderation inbox, history, and automation.
- `docs/features/photo-assisted-bottle-resolution.md` — Bottle lookup from a photo.
- `openspec/specs/entity-identity/spec.md` — Entity kinds, ownership, and API behavior.
- `packages/bottle-classifier/README.md` — Classifier API and commands.

### Build And Test Peated

- `apps/web/AGENTS.md` — Web rules.
- `apps/web/visual/README.md` — Browser screenshot reviews.
- `docs/development/backend-testing.md` — Backend tests.
- `docs/development/frontend-testing.md` — Frontend tests.
- `docs/development/model-checks.md` — Live model checks.
- `docs/development/orpc-client.md` — Web client use of server routes.
- `docs/development/orpc-routes.md` — Server route rules.
- `docs/policies/README.md` — Policy scope.
- `docs/policies/agent-design.md` — Model-driven code.
- `docs/policies/background-work.md` — Background jobs.
- `docs/policies/code-comments.md` — Comments and TODOs.
- `docs/policies/data-and-permissions.md` — API, queue, and storage checks.
- `docs/policies/database-correctness.md` — Stored data correctness.
- `docs/policies/error-handling.md` — Failures, retries, fallbacks.
- `docs/policies/interfaces.md` — Public functions and types.
- `docs/policies/logs-and-traces.md` — Logs, traces, metrics.
- `docs/policies/naming.md` — Code and domain names.
- `docs/policies/sensitive-data.md` — Private data in logs, tools, and models.
- `packages/bottle-classifier/.vitest-evals/AGENTS.md` — Replay recordings.
- `packages/bottle-classifier/AGENTS.md` — Classifier rules.

### Documentation And Research

- `docs/README.md` — Document placement.
- `docs/research/entity-image-source-audit-2026-08.md` — Dated image source checks.
- `docs/research/external-review-source-audit-2026-08.md` — Dated review source checks.

### Operate Peated

- `README.md` — Local setup and authenticated API use.
- `apps/server/src/scraper/README.md` — Add and run scraper sources.
- `apps/server/src/worker/README.md` — Add and run worker jobs.
- `docs/development/local-web-checks.md` — Local browser checks.
- `docs/operations/bottle-reference-migrations-0253-0255.md` — Bottle Reference migration and rollback.
- `docs/operations/catalog-maintenance.md` — Research, merge, and edit production Bottles.
- `docs/operations/deployments.md` — Vercel, Render, and PlanetScale deploy checks.
- `docs/operations/entity-images.md` — Add or replace production Entity images.
- `docs/operations/external-review-sources.md` — Add, publish, stop, or remove a review source.
- `docs/operations/production-debugging.md` — Production diagnosis.
