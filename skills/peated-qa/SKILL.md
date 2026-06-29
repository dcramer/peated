---
name: peated-qa
description: Use when manually QAing Peated changes across the API, CLI, or web UI; selecting smoke checks after code changes; using agent-browser for Peated flows; verifying local behavior beyond tests and lint.
---

# Peated QA

Use after Peated code changes need manual behavior checks. This is not a test/lint checklist.

## Select Surfaces

| Changed area                                 | QA                                       |
| -------------------------------------------- | ---------------------------------------- |
| `apps/server/src/orpc/routes/**`             | API + any UI/CLI caller                  |
| `apps/server/src/worker/**`, uploads, queues | API + worker side effect                 |
| `apps/cli/**`                                | CLI + backing API/DB effect              |
| `apps/web/**`                                | UI + API calls it depends on             |
| schema/migration/data model                  | API + CLI + UI path that reads/writes it |

## Start Local Runtime

For normal web UI QA, prefer the root `pnpm dev` command. It starts the web
app, API, worker, package watchers, and shared `.env.local` setup together,
which matches the expected local development runtime. Use the narrower commands
below only when intentionally isolating one surface.

| Need         | Command                                         | URL                                                        |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------- |
| Full app     | `pnpm dev`                                      | web: `http://localhost:3200`, API: `http://localhost:4300` |
| API only     | `pnpm dev:server:api`                           | `http://localhost:4300`                                    |
| API + worker | `docker compose up -d redis`; `pnpm dev:server` | `http://localhost:4300`                                    |
| Web          | `pnpm dev:web`                                  | `http://localhost:3200`                                    |
| CLI          | `pnpm cli <cmd>`                                | loads `.env.local`                                         |

Fallback paired ports when `3200` is busy:

- API:
  `PORT=4301 CORS_HOST=http://localhost:3202 API_SERVER=http://localhost:4301 URL_PREFIX=http://localhost:3202 pnpm exec dotenv -e .env.local -- pnpm --filter @peated/server start:api`
- Web:
  `API_SERVER=http://localhost:4301 URL_PREFIX=http://localhost:3202 pnpm exec dotenv -e .env.local -- pnpm --dir apps/web exec next dev -p 3202`

## API QA

1. Identify exact route file and operation.
2. Hit local API, not `peated.com`: `http://localhost:4300`.
3. For public reads, use `curl` against the route or spec-shaped endpoint.
4. For protected writes, create/login a throwaway local user and send `Authorization: Bearer <token>`.
5. Check success response, validation failure, auth failure, and not-found/conflict when relevant.
6. Verify DB-visible side effects when mutation behavior matters.
7. If the route is used by web/CLI, QA that caller too.

Useful refs:

- Local OpenAPI in dev: `http://localhost:4300/spec.json`
- Production API host for comparison only: `https://api.peated.com`
- Public API paths are under `/v1/*`.

For protected local API QA, use the stable local QA account. Reusing the same
account keeps test data bounded and makes repeated QA runs predictable:

```bash
pnpm cli users create qa@example.com password123 --verified --accept-terms --if-exists
pnpm cli users generate-token qa@example.com
```

Keep the printed token out of committed docs and final reports. Use
`Authorization: Bearer <token>` for protected local API requests.

## CLI QA

1. Run the changed command through root scripts, not direct `tsx`: `pnpm cli <cmd>`.
2. For aliases, prefer root scripts when present: `pnpm bottles`, `pnpm entities`, `pnpm tastings`, `pnpm mocks`, `pnpm user`, `pnpm db`.
3. Use a harmless local fixture or throwaway record.
4. Verify stdout/stderr, exit status, and DB/API side effect.
5. For destructive commands, use dry-run/help first when available; otherwise use local throwaway data only.
6. If a CLI command drives server logic, also QA the matching API route or DB result.

## Classifier QA

Use this for changes under `packages/bottle-classifier/**` or
`apps/server/src/agents/bottleClassifier/**`.

1. For bottle-name checks, run:
   `pnpm cli classifier run "Ardbeg Uigeadail"`.
2. For image checks, run:
   `pnpm cli classifier run --image /path/to/bottle.jpg` or
   `pnpm cli classifier run --image https://example.com/bottle.jpg`.
3. For exact contract payloads, run:
   `pnpm cli classifier run --input-file /tmp/classifier-input.json`.
4. Use `--initial-only` when the check should stay closed-set and avoid follow-up
   bottle/web search.
5. Live classifier runs use `.env.local`, local DB adapters, and OpenAI config.
   They may call OpenAI and local search depending on the reference.
6. Pair manual classifier smoke checks with package validation:
   `pnpm --filter @peated/bottle-classifier typecheck` and focused tests or evals.

Minimal input-file payload:

```json
{
  "reference": { "name": "Ardbeg Uigeadail" },
  "candidateExpansion": "initial_only"
}
```

## UI QA

1. Start API and web with matched origins.
2. Use `agent-browser` for browser checks.
3. Verify desktop and mobile widths for changed user-facing flows.
4. Prefer normal login:
   `/login?redirectTo=/addBottle` -> `Sign in with Email` -> `Or sign in with a password`.
5. For local protected UI checks, seed a throwaway verified active user with
   `termsAcceptedAt`, then log in through the UI. Do not use bearer-token API
   setup or a manually sealed `_session` cookie for UI QA unless normal UI login
   is blocked by unrelated local service noise.
6. For moderator flows, set that throwaway user `mod: true`.
7. For bottle entry changes, check `/addBottle` and `/bottles/<id>/edit`.
8. Inspect rendered state, network/API outcome, persistence after reload, and error/empty/loading states when changed.
9. Clean up throwaway local users/records when done.

## Finish With Evidence

Report:

- Surfaces QAed: API / CLI / UI.
- Commands and URLs used.
- Browser viewport(s), if UI.
- Data used or created.
- Pass/fail per scenario.
- Any skipped surface and why.
