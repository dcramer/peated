# Local Web Checks

Use this guide to check protected Peated web flows with `agent-browser` or
Playwright.

## Start Peated

Run `docker compose up -d` once for Postgres and Redis. Then run `pnpm dev` for
the full app. The web app uses `http://localhost:3200`; the API uses
`http://localhost:4300`.

Use `pnpm dev:server:api` when the check does not need worker jobs. Use
`pnpm dev:web` only when a compatible API is already running.

If port 3200 is busy, start a matched pair so browser API calls pass CORS:

```shell
PORT=4301 CORS_HOST=http://localhost:3202 API_SERVER=http://localhost:4301 URL_PREFIX=http://localhost:3202 pnpm exec dotenv -e .env.local -- pnpm --filter @peated/server start:api
API_SERVER=http://localhost:4301 URL_PREFIX=http://localhost:3202 pnpm exec dotenv -e .env.local -- pnpm --dir apps/web exec next dev -p 3202
```

## Sign In

Create or refresh one local test user:

```shell
pnpm cli users create qa@example.com password123 --verified --accept-terms --if-exists
```

Add `--admin` for administrator or moderator checks. Use the normal login flow:
`/login?redirectTo=/addBottle` → `Sign in with Email` →
`Or sign in with a password`.

Do not build session cookies by hand. Use a real local user so permission and
save behavior are part of the check.

## Check The Change

- Open the exact changed route after login is ready.
- Inspect controls and structure with an accessibility snapshot.
- Inspect layout at desktop and mobile widths when layout changed.
- Check the saved result after reload.
- Check changed error, empty, and loading states.
- For Bottle entry, check `/addBottle` and `/bottles/<id>/edit` when both paths
  use the changed code.
- Remove throwaway records when the check is complete.
