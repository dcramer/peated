Peated is a public record of whisky. Our goal is to document as much whisky as
possible and make that data freely accessible to everyone.

## Core Principles

- Build a useful public record. Prefer work that makes whisky information more
  accurate, complete, and freely available.
- Protect the database. Preserve correct IDs, links, ownership, history, and
  user data. Limit data changes and verify them after they run.
- Use evidence. Record where facts came from. Do not turn a guess into a fact.
  Leave a value empty when evidence is weak or conflicting.
- Write for everyday people. Do not assume whisky expertise. Use common words in
  product text, docs, plans, comments, errors, and explanations. Explain a
  necessary whisky term. Use short sentences, active voice, and one term for
  each concept.
- Protect trust. Respect privacy, permissions, licenses, and the sites from
  which Peated reads data. Make clear who can act and what they can change.
- Keep the code easy to maintain. Choose the smallest design that solves the
  known problem. Prefer functions, plain objects, simple types, and small
  modules. Do not add options or abstractions without a current need.

## Package Manager

- Use `pnpm`. Read the required pnpm and Node.js versions from `package.json`.
- Core commands: `pnpm install`, `pnpm dev`, `pnpm dev:server`, `pnpm dev:web`,
  `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format`.

## File-Scoped Commands

| Task                     | Command                                                         |
| ------------------------ | --------------------------------------------------------------- |
| Lint file                | `pnpm exec oxlint path/to/file.ts --fix`                        |
| Format file              | `pnpm exec prettier --write path/to/file.ts`                    |
| Test one backend file    | `pnpm --filter @peated/server test -- src/path/to/file.test.ts` |
| Typecheck server package | `pnpm --filter @peated/server typecheck`                        |
| Typecheck web package    | `pnpm --filter @peated/web typecheck`                           |

## Workflow

- For a substantial change, first learn how the current code works. Make the
  smallest complete change, verify it, and summarize the result.
- Search every use before changing a shared function, type, error, data format,
  or product term. Change all uses together unless compatibility is required.
- Let unexpected failures reach the code responsible for handling them. Retry
  only failures that are expected to be temporary.
- When one module enforces an important rule, keep a short comment about the
  rule and its owner beside that code.
- Keep lasting explanations beside the code or feature that owns them. Delete
  completed plans instead of keeping stale history.
- After code changes, run the smallest relevant tests, typechecks, lint, and
  format checks. Use manual QA when automated checks do not prove the changed
  behavior. Report checks that you did not run. Pull request CI is the required
  full-repo `pnpm test` gate.

## Catalog Operations

- Before a catalog backfill, duplicate cleanup, or production Bottle edit, read
  Catalog Maintenance and the Whisky Identity Model. Complete their inventory,
  evidence, approval, and verification steps before production writes.
- Keep Bottle `name` to the stable product name used by the producer. Do not
  build it from age, year, strength, or other fields. Verify every changed
  Bottle after the write.

## Testing And Validation

- Backend tests are integration-first.
- Frontend tests prove logic and user actions. Do not add a test whose only
  purpose is appearance. Check visual changes in a browser.
- Tests and live model checks are separate gates. `pnpm test` runs repeatable
  Vitest tests; model checks run through `pnpm evals`.
- Before adding coverage, find the existing test or model check that owns the
  behavior. Do not prove the same rule in several layers.

## Architecture Conventions

- Backend routes live in `apps/server/src/orpc/routes/<domain>/`; keep one file
  per operation.
- Serializers live in `apps/server/src/serializers/*` with `attrs()` and
  `item()`, invoked through `serialize(...)`.
- Create migrations with `pnpm db:generate`; never hand-write migration SQL or
  edit `apps/server/migrations/meta/*` manually.
- `pnpm dev*` and `pnpm cli <cmd>` load `.env.local`; backend tests load
  `.env.test`.

## API Access

- For production API work, use `https://api.peated.com`, not
  `https://peated.com`.

## Sentry Operations

- Peated uses the `peated` Sentry organization and `peated` project at
  `https://peated.sentry.io`.
- Use [Sentry CLI](https://cli.sentry.dev) (`sentry`) for production issues,
  events, traces, spans, and logs. Let it detect the target first. Use
  `peated/peated` only when detection is wrong.
- For agent-readable output, use `--json`, select only needed fields, and set a
  small `--limit`. Full events and requests can contain sensitive data.

## Documentation

Read the docs that apply to the work. All durable repository guides are listed
below. Skills are available through `.agents/skills`; temporary OpenSpec changes
and generic tool instructions are not listed.

Code, database schemas, exported types, and tests define exact behavior. These
docs explain intent, rules, and safe procedures. Research notes do not override
them.

### Understand Peated

- `DESIGN.md` — Durable visual design rules.
- `docs/architecture/account-access.md` — Terms and email verification rules.
- `docs/architecture/bottle-classifier-glossary.md` — Classifier terms.
- `docs/architecture/bottle-classifier.md` — Bottle classifier behavior.
- `docs/architecture/bottle-reference-normalization.md` — Safe reference-name cleanup.
- `docs/architecture/bottle-reference-resolution.md` — Bottle lookup and assignment.
- `docs/architecture/entity-classifier.md` — Entity classifier behavior.
- `docs/architecture/oauth-clients.md` — OAuth client and token flow.
- `docs/architecture/peated-ids.md` — Public Peated IDs.
- `docs/architecture/ratings.md` — Tastings, reviews, scores, and totals.
- `docs/architecture/store-price-matching.md` — Store-price matching and review.
- `docs/architecture/web-caching.md` — Safe caching for signed-in and public pages.
- `docs/architecture/whisky-identity-model.md` — Bottle and Entity identity rules.
- `docs/features/bottle-entry-workflow.md` — Manual Bottle creation and editing.
- `docs/features/bottle-presentation.md` — How Bottle identity appears to users.
- `docs/features/external-reviews.md` — External review storage and publication.
- `docs/features/moderation-workspace.md` — Moderation inbox, history, and automation.
- `docs/features/photo-assisted-bottle-resolution.md` — Bottle lookup from a photo.
- `openspec/specs/entity-identity/spec.md` — Entity kinds, ownership, and API behavior.
- `packages/bottle-classifier/README.md` — Classifier package API and commands.

### Build And Test Peated

- `apps/web/AGENTS.md` — Web component, route, and product-language rules.
- `apps/web/visual/README.md` — Browser screenshot reviews.
- `docs/development/backend-testing.md` — Backend test rules and commands.
- `docs/development/frontend-testing.md` — Frontend and browser test rules.
- `docs/development/model-checks.md` — Rules for live model checks.
- `docs/development/orpc-client.md` — Web client use of server routes.
- `docs/development/orpc-routes.md` — Server route rules.
- `docs/policies/README.md` — What belongs in a repo-wide policy.
- `docs/policies/agent-design.md` — Rules for model-driven code.
- `docs/policies/background-work.md` — Rules for work that runs later.
- `docs/policies/code-comments.md` — Rules for code comments and TODOs.
- `docs/policies/data-and-permissions.md` — Data and permission checks for APIs, queues, and storage.
- `docs/policies/database-correctness.md` — Rules that keep stored data correct.
- `docs/policies/error-handling.md` — Rules for failures, retries, and fallbacks.
- `docs/policies/interfaces.md` — Rules for public functions and types.
- `docs/policies/logs-and-traces.md` — Rules for logs, traces, and metrics.
- `docs/policies/naming.md` — Rules for code and domain names.
- `docs/policies/sensitive-data.md` — Private data in logs, tools, and models.
- `packages/bottle-classifier/.vitest-evals/AGENTS.md` — Classifier replay recording rules.
- `packages/bottle-classifier/AGENTS.md` — Rules for classifier changes.

### Documentation And Research

- `docs/README.md` — Where each kind of document belongs.
- `docs/research/entity-image-source-audit-2026-08.md` — Dated image source and license checks.
- `docs/research/external-review-source-audit-2026-08.md` — Dated source and terms research.

### Operate Peated

- `README.md` — Local setup and authenticated API use.
- `apps/server/src/scraper/README.md` — Add and run scraper sources.
- `apps/server/src/worker/README.md` — Add and run worker jobs.
- `docs/development/local-web-checks.md` — Run local browser checks.
- `docs/operations/bottle-reference-migrations-0253-0255.md` — Run or undo the Bottle Reference migration.
- `docs/operations/catalog-maintenance.md` — Research, merge, and edit production Bottles.
- `docs/operations/deployments.md` — Vercel, Render, and PlanetScale deploy checks.
- `docs/operations/entity-images.md` — Add or replace production Entity images.
- `docs/operations/external-review-sources.md` — Add, publish, stop, or remove a review source.
- `docs/operations/production-debugging.md` — Diagnose production failures.
