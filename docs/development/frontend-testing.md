# Frontend Testing

Frontend tests should be cheap to run locally and clear about what they prove.
Use fast Vitest coverage for component structure and Playwright for browser-only
behavior such as layout, responsive rendering, Suspense streaming, and overflow.

## Commands

```shell
pnpm test:web
pnpm test:e2e
pnpm test:all
```

- `pnpm test:web` runs the web Vitest suite only.
- `pnpm test:e2e` runs the Playwright browser suite only.
- `pnpm test:all` runs the standard repo test suite and then Playwright.
- `pnpm test` is still the standard Turbo-backed repo test suite.
- Pull request CI runs Playwright e2e in a separate job from the build and
  package test job so browser coverage does not serialize the whole pipeline.

For local browser debugging:

```shell
pnpm test:e2e:ui
pnpm test:e2e:headed
pnpm test:e2e:report
```

On a fresh machine, install the Playwright browser once:

```shell
pnpm test:e2e:install
```

## What To Test

- Use Vitest for deterministic component contracts: rendered fallback shape,
  accessible roles, props, and route loading component output.
- Use Playwright when the browser matters: CSS layout, responsive states,
  streamed loading UI, page overflow, focus behavior, or navigation.
- For user-facing web route/layout changes, run `pnpm test:e2e` in addition to
  `pnpm test:web`.
- Before handing off non-trivial UI work, run `pnpm test:all`.

## Playwright Setup

The web Playwright config lives at
[`apps/web/playwright.config.ts`](../../apps/web/playwright.config.ts).

The suite starts two local servers:

- a small mock RPC server on `127.0.0.1:4999`;
- Next.js on `127.0.0.1:3200`.

This keeps browser tests independent from a local database and API server. The
current loading-fallback tests intentionally keep unknown `/rpc` calls pending
so the real Next routes render their Suspense fallbacks. Browser workflow tests
should reuse the shared e2e fixtures and add narrow mock RPC responses for the
routes they exercise.

Useful overrides:

```shell
PLAYWRIGHT_PORT=3201 pnpm test:e2e
PLAYWRIGHT_API_PORT=5000 pnpm test:e2e
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL` skips starting Next, so only use it when an equivalent
web server is already running with the API pointed at a compatible test target.

## Reliability Rules

- Prefer Playwright locators and web-first assertions over manual DOM polling.
- Avoid arbitrary sleeps. Increase assertion timeouts only for known cold-start
  costs such as Next dev route compilation.
- Mock external/API boundaries for layout and loading tests; use real services
  only when the behavior under test requires them.
- Keep Playwright output under `apps/web/.playwright`; it is ignored by git.
- When a Playwright failure is not obvious from the terminal, run
  `pnpm test:e2e:report` and inspect the retained trace.
