# Agent Instructions

## Package Manager

- Use `pnpm@10.3.0` with Node `22.14.x`
- Core commands: `pnpm install`, `pnpm dev`, `pnpm dev:server`, `pnpm dev:web`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format`

## File-Scoped Commands

| Task                     | Command                                                         |
| ------------------------ | --------------------------------------------------------------- |
| Lint file                | `pnpm exec eslint path/to/file.ts --fix`                        |
| Format file              | `pnpm exec prettier --write path/to/file.ts`                    |
| Test one backend file    | `pnpm --filter @peated/server test -- src/path/to/file.test.ts` |
| Typecheck server package | `pnpm --filter @peated/server typecheck`                        |
| Typecheck web package    | `pnpm --filter @peated/web typecheck`                           |

## Commit Attribution

AI commits MUST include:

```text
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Key Conventions

- Monorepo packages: `apps/server`, `apps/web`, `apps/cli`, `packages/*`
- `pnpm dev*` and `pnpm cli <cmd>` load `.env.local`; backend tests load `.env.test`
- Backend testing policy: `docs/development/backend-testing.md`
- Frontend testing policy: `docs/development/frontend-testing.md`
- Before opening a PR, run targeted tests/typechecks/lint for the touched surface; PR CI is the required full-repo `pnpm test` gate
- Classifier/repair changes: preserve `docs/architecture/whisky-identity-model.md`; brand/entity identity is not prefix matching
- Production-miss classifier evals must verify the real bottle online, state the exact Peated DB outcome, and encode that provenance in the fixture; do not substitute a generalized pretend case for the observed bottle.
- oRPC route conventions: `docs/development/orpc-routes.md`
- oRPC client usage: `docs/development/orpc-client.md`
- Schema conventions: `docs/development/schema-conventions.md`
- Backend routes live in `apps/server/src/orpc/routes/<domain>/`; keep one file per operation
- Serializer pattern: `apps/server/src/serializers/*` with `attrs()` and `item()`, invoked via `serialize(...)`
- DB schema lives in `apps/server/src/db/schema/`
- Database migrations must be created with `pnpm db:generate` (Drizzle Kit); never hand-write migration SQL or edit `apps/server/migrations/meta/*` manually
- Web app uses Next.js App Router in `apps/web/src/app/`

## API Access

- Production API host: `https://api.peated.com`
- OpenAPI spec: `https://api.peated.com/spec.json`
- OpenAPI endpoints are mounted under `https://api.peated.com/v1/*`
- Most read/list endpoints are anonymous and public; protected write/moderator routes require `Authorization: Bearer <token>`
- `https://peated.com` is the frontend host, not the API host

## Local UI Verification Playbook

- Use `docs/development/local-ui-verification.md` when a browser-agent or Playwright check needs local login, moderator access, or a fallback port.

## Policies

- Policy docs live under `docs/policies/`
- Read relevant policy docs before changing code in that area
- `docs/policies/code-comments.md` applies by default for code changes and inline documentation
- `docs/policies/web-route-layouts.md` applies to user-facing web route and layout changes
- `docs/policies/frontend-components.md` applies to shared UI components and form workflows
- `docs/policies/background-work.md` applies to slow post-save work, queues, uploads, and retries
- `docs/policies/runtime-boundaries.md` applies to API, queue, storage, AI, and other async/external boundaries

## Docs Index

- Any new doc added under `docs/` must also be added to this index in `AGENTS.md`
- `docs/architecture/account-policies.md`
- `docs/architecture/bottle-classifier.md`
- `docs/architecture/bottle-creation-alias-system.md`
- `docs/architecture/bottle-normalization-contract.md`
- `docs/architecture/bottle-normalization-examples.md`
- `docs/architecture/entity-classifier.md`
- `docs/architecture/rating-systems.md`
- `docs/architecture/whisky-identity-model.md`
- `docs/development/backend-testing.md`
- `docs/development/frontend-testing.md`
- `docs/development/local-ui-verification.md`
- `docs/development/orpc-client.md`
- `docs/development/orpc-routes.md`
- `docs/development/schema-conventions.md`
- `docs/features/bottle-entry-workflow.md`
- `docs/features/photo-tasting-entry.md`
- `docs/features/store-price-matching.md`
- `docs/features/simple-rating-system.md`
- `docs/policies/README.md`
- `docs/policies/policy-template.md`
- `docs/policies/agent-design.md`
- `docs/policies/background-work.md`
- `docs/policies/code-comments.md`
- `docs/policies/frontend-components.md`
- `docs/policies/runtime-boundaries.md`
- `docs/policies/web-route-layouts.md`
