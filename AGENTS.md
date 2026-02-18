# Agent Instructions

## Package Manager

Use **pnpm 10.3** with Turborepo. Node 22.14.x required.

- `pnpm dev` — start all apps
- `pnpm dev:server` / `pnpm dev:web` — start individually
- `pnpm test` — run all tests
- `pnpm lint` / `pnpm typecheck` — lint and typecheck
- `pnpm format` — prettier

## Commit Attribution

AI commits MUST include:

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Monorepo Structure

```
apps/server   — Hono API server (oRPC + OpenAPI + RPC transports)
apps/web      — Next.js 14 App Router
apps/cli      — Commander.js CLI (imports directly from @peated/server)
packages/design  — shared UI components
packages/email   — jsx-email templates
packages/orpc    — shared oRPC contract types
packages/tsconfig — shared TS configs
```

## Server (apps/server)

### Tech Stack

- **Framework:** Hono with `@hono/node-server`
- **API:** oRPC (`@orpc/server`) — OpenAPI at `/v1/*`, RPC at `/rpc/*`
- **ORM:** Drizzle ORM (node-postgres)
- **Queue:** BullMQ + ioredis
- **Auth:** JWT + SimpleWebAuthn (passkeys)
- **Validation:** Zod schemas on every procedure input/output

### oRPC Route Pattern

One file per operation, co-located in `src/routes/<domain>/`:

```ts
export default procedure
  .route({ method: "GET", path: "/bottles", summary: "..." })
  .input(z.object({ ... }))
  .output(SomeSchema)
  .handler(async ({ input, context, errors }) => { ... });
```

Router composition in `src/routes/<domain>/index.ts`:

```ts
export default base
  .tag("bottles")
  .router({ details, list, create, update, delete: delete_ });
```

### Auth Middleware

Chain before `.route()`: `requireAuth`, `requireVerified`, `requireAdmin`, `requireMod`, `requireTosAccepted`, `rateLimit`

### Serializers

Custom pattern in `src/serializers/` — `attrs()` for batch-loading, `item()` for final shape. Use via `serialize(SomeSerializer, data, user)`.

### Database

- Schema: `apps/server/src/db/schema/` — one file per domain, `bigserial` IDs
- Generate migration: `pnpm db:generate`
- Apply migration: `pnpm db:migrate`
- Enums: `pgEnum` in `src/db/schema/enums.ts`

## Web (apps/web)

- **Framework:** Next.js 14 App Router (`src/app/`)
- **Data:** oRPC client + TanStack Query (`useORPC()` hook)
- **Styling:** Tailwind CSS + CVA + tailwind-merge
- **Forms:** react-hook-form + Zod resolvers
- **Session:** iron-session (server-side)
- Route groups: `(admin)`, `(bottles-sidebar)`, `(default)`, `(entities-sidebar)`, `(layout-free)`

## Testing

### Vitest (globals enabled — no imports needed for describe/test/expect/vi)

- Tests co-located: `foo.test.ts` next to `foo.ts`
- Real PostgreSQL (`test_peated`), truncated per test
- Serial execution (`fileParallelism: false`, `singleFork: true`)

### Test Context

Available via `ctx` in each test:

- `ctx.defaults.user` — pre-created default user
- `ctx.defaults.authHeaders` — `{ Authorization: "Bearer ..." }`
- `ctx.fixtures.Bottle({...})`, `ctx.fixtures.Entity({...})`, etc. — factory functions with faker defaults

### Calling Routes in Tests

Use `routerClient` (in-process oRPC client, no HTTP):

```ts
const result = await routerClient.bottles.create(
  { name: "Test" },
  { context: { user: defaults.user } },
);
```

### Error Testing

```ts
const err = await waitError(routerClient.bottles.create(...));
expect(err).toMatchInlineSnapshot(...);
```

## Code Style

- **TypeScript:** strict, ESM, Bundler moduleResolution
- **Imports:** `consistent-type-imports` enforced (`import type { Foo }`)
- **Formatting:** Prettier — double quotes, semicolons, 2-space indent, trailing commas
- **Pre-commit:** lint-staged runs prettier + eslint

## Skills

Skills managed via [dotagents](https://github.com/getsentry/dotagents). Config in `agents.toml`.

| Skill             | When to use                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `commit`          | **Always** use for commits. See `.agents/skills/commit/SKILL.md`                |
| `create-pr`       | **Always** use for PRs. See `.agents/skills/create-pr/SKILL.md`                 |
| `iterate-pr`      | Fix CI failures / iterate until green. See `.agents/skills/iterate-pr/SKILL.md` |
| `code-review`     | Review PRs and code changes. See `.agents/skills/code-review/SKILL.md`          |
| `code-simplifier` | Simplify/refactor for clarity. See `.agents/skills/code-simplifier/SKILL.md`    |
| `find-bugs`       | Find bugs in local branch changes. See `.agents/skills/find-bugs/SKILL.md`      |
| `security-review` | Audit for vulnerabilities. See `.agents/skills/security-review/SKILL.md`        |

## CLI Commands Reference

| Command              | Description                            |
| -------------------- | -------------------------------------- |
| `pnpm dev`           | Start all apps (requires `.env.local`) |
| `pnpm test`          | Run all tests                          |
| `pnpm db:generate`   | Generate Drizzle migration SQL         |
| `pnpm db:migrate`    | Apply migrations                       |
| `pnpm cli <cmd>`     | Run CLI commands                       |
| `make reset-db`      | Drop and recreate dev + test databases |
| `make reset-test-db` | Drop and recreate test database only   |
