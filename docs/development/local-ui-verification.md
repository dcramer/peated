# Local UI Verification

Use this playbook when validating protected Peated web flows with
`agent-browser` or Playwright.

## Servers

- Start the API with `pnpm dev:server`; the local API defaults to
  `http://localhost:4000`.
- Start the web app with `pnpm dev:web`.
- If `localhost:3000` is occupied, use a matched fallback API/web pair so
  browser RPC calls pass CORS:
  - API:
    `PORT=4001 CORS_HOST=http://localhost:3002 API_SERVER=http://localhost:4001 URL_PREFIX=http://localhost:3002 pnpm exec dotenv -e .env.local -- pnpm --filter @peated/server start:api`
  - Web:
    `API_SERVER=http://localhost:4001 URL_PREFIX=http://localhost:3002 pnpm exec dotenv -e .env.local -- pnpm --dir apps/web exec next dev -p 3002`

## Login

- Prefer the normal UI path first: open `/login?redirectTo=/addBottle`, choose
  `Sign in with Email`, then choose `Or sign in with a password`.
- For local checks, seed or update a throwaway user with a password hash from
  `generatePasswordHash("testpassword")`, `verified: true`, `active: true`, and
  `termsAcceptedAt: new Date()`.
- For moderator-only edit checks, mark the throwaway user `mod: true` before
  logging in.
- If server-action login is blocked by unrelated local service noise, set a
  browser `_session` cookie generated with `iron-session`'s `sealData` using
  `{ user, accessToken, ts }`. Build `user` with
  `serialize(UserSerializer, user, user)` and `accessToken` with
  `createAccessToken(user)`.

## Browser Automation

- `agent-browser` may need an explicit cached Chromium path if its default
  Playwright browser is missing:
  `/home/dcramer/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`.
- Verify protected form changes at desktop and mobile widths.
- For bottle-entry work, check at least `/addBottle` and an existing
  `/bottles/<id>/edit` route.
- Clean up throwaway local users when the check is finished.
