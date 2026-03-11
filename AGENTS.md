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
- oRPC route conventions: `docs/development/orpc-routes.md`
- oRPC client usage: `docs/development/orpc-client.md`
- Schema conventions: `docs/development/schema-conventions.md`
- Backend routes live in `apps/server/src/orpc/routes/<domain>/`; keep one file per operation
- Serializer pattern: `apps/server/src/serializers/*` with `attrs()` and `item()`, invoked via `serialize(...)`
- DB schema lives in `apps/server/src/db/schema/`
- Database migrations must be created with `pnpm db:generate` (Drizzle Kit); never hand-write migration SQL or edit `apps/server/migrations/meta/*` manually
- Web app uses Next.js App Router in `apps/web/src/app/`

## Docs Index

- Any new doc added under `docs/` must also be added to this index in `AGENTS.md`
- `docs/architecture/account-policies.md`
- `docs/architecture/rating-systems.md`
- `docs/development/backend-testing.md`
- `docs/development/orpc-client.md`
- `docs/development/orpc-routes.md`
- `docs/development/schema-conventions.md`
- `docs/features/simple-rating-system.md`
