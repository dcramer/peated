# Agent Instructions

## Core Principles

- Optimize for the next maintainer. Choose the smallest design that closes the
  proven failure, keep complexity local, and avoid speculative abstractions,
  configuration, extension points, and recovery paths; follow
  `docs/policies/correctness-complexity.md`.
- Prefer functions, plain objects, simple types, and small modules. Expose
  narrow capabilities and use the same domain noun for the same concept; follow
  `docs/policies/interface-design.md`.
- Keep ownership, permissions, identity, and irreversible actions explicit at
  their runtime boundaries; follow `docs/policies/runtime-boundaries.md`.
- Write code, names, documentation, plans, and explanations for normal humans.
  If they need an architecture lecture to make sense, simplify them.

## Package Manager

- Use `pnpm@11.20.0` with Node `24.18.0`.
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

## Commit Attribution

AI commits MUST include:

```text
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Workflow

- For non-trivial changes: discover, implement the smallest useful vertical
  slice, verify it, and summarize the result.
- Search every consumer before changing a shared signature, error contract,
  schema, or domain name. Use a hard cutover unless compatibility is explicitly
  required.
- Let unexpected failures reach the owning boundary. Retry only expected
  transient failures; follow `docs/policies/error-handling.md`.
- When a policy is enforced by a specific module or exported boundary, keep a
  brief ownership/invariant comment beside that code; follow
  `docs/policies/code-comments.md`.
- Move durable explanations beside the code or feature that owns them. Delete
  completed plans instead of preserving stale implementation history.
- Run targeted tests, typechecks, lint, and manual QA for the touched surface.
  Pull request CI is the required full-repo `pnpm test` gate.

## Testing and Validation

- Backend tests are integration-first; follow
  `docs/development/backend-testing.md`.
- Frontend tests prove deterministic component contracts and browser behavior;
  visual presentation uses manual or agent-based QA. Follow
  `docs/development/frontend-testing.md`.
- Tests and live evals are separate gates. `pnpm test` runs deterministic Vitest
  tests; classifier model evals run through `pnpm evals`. Follow
  `docs/policies/evals.md` and the classifier package instructions.
- Before adding coverage, search existing test and eval layers for the behavior's
  primary owning scenario. Do not duplicate the same contract at several layers.

## Architecture Conventions

- Monorepo packages live under `apps/server`, `apps/web`, `apps/cli`, and
  `packages/*`.
- Backend routes live in `apps/server/src/orpc/routes/<domain>/`; keep one file
  per operation.
- Serializers live in `apps/server/src/serializers/*` with `attrs()` and
  `item()`, invoked through `serialize(...)`.
- Database schema lives in `apps/server/src/db/schema/`.
- Create migrations with `pnpm db:generate`; never hand-write migration SQL or
  edit `apps/server/migrations/meta/*` manually.
- The web app uses Next.js App Router in `apps/web/src/app/`.
- `pnpm dev*` and `pnpm cli <cmd>` load `.env.local`; backend tests load
  `.env.test`.

## API Access

- Production API host: `https://api.peated.com`.
- OpenAPI spec: `https://api.peated.com/spec.json`.
- OpenAPI endpoints are mounted under `https://api.peated.com/v1/*`.
- Most read/list endpoints are anonymous. Protected write and moderator routes
  require `Authorization: Bearer <token>`.
- `https://peated.com` is the frontend host, not the API host.

## Where Rules Live

Read the relevant policy and owning feature documentation before changing code
in that area.

| Need                                      | Source                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repo-wide policy index                    | `docs/policies/README.md`                                                                                                                                                |
| Design, interfaces, and failures          | `docs/policies/correctness-complexity.md`, `docs/policies/interface-design.md`, `docs/policies/error-handling.md`                                                        |
| API, queue, storage, and async boundaries | `docs/policies/runtime-boundaries.md`, `docs/policies/background-work.md`                                                                                                |
| Comments, logging, and sensitive data     | `docs/policies/code-comments.md`, `docs/policies/observability.md`, `docs/policies/data-redaction.md`                                                                    |
| Agent architecture and evals              | `docs/policies/agent-design.md`, `docs/policies/evals.md`                                                                                                                |
| Catalog classifier behavior               | `docs/architecture/whisky-identity-model.md`, `docs/architecture/bottle-classifier.md`, `docs/architecture/entity-classifier.md`, `packages/bottle-classifier/AGENTS.md` |
| oRPC routes and clients                   | `docs/development/orpc-routes.md`, `docs/development/orpc-client.md`                                                                                                     |
| Bottle entry and photo resolution         | `docs/features/bottle-entry-workflow.md`, `docs/features/photo-tasting-entry.md`                                                                                         |
| Ratings and aggregates                    | `docs/architecture/rating-systems.md`                                                                                                                                    |
| Web components, layouts, and caching      | `docs/policies/frontend-components.md`, `docs/policies/web-route-layouts.md`, `docs/development/web-caching.md`                                                          |
| Local UI verification                     | `docs/development/local-ui-verification.md`                                                                                                                              |
| Production debugging                      | `docs/development/production-debugging.md`                                                                                                                               |

Policy documents contain repo-wide defaults. Feature architecture and
non-obvious invariants belong in the owning package, module, or feature
documentation. Code, schemas, exported types, and tests are authoritative;
temporary plans cannot override policy.
