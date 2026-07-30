# Frontend Testing

Frontend tests should be cheap to run locally and clear about what they prove.
Use fast Vitest coverage for deterministic component contracts and Playwright
for user workflows or interactions that require a real browser. Use manual or
agent-based QA for visual hierarchy, copy quality, spacing, color, artwork, and
the overall appearance of responsive layouts.

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
- Use Playwright to prove a user-visible behavior: a workflow completes,
  navigation reaches the right destination, a mutation changes state, a filter
  changes results, access boundaries hold, or a browser-only interaction works.
- Add breakpoint-specific Playwright coverage only when responsive behavior
  changes the interaction or available workflow. Do not rerun the same contract
  at multiple sizes solely to verify presentation.
- Do not use Playwright to lock down general copy, decorative rendering, DOM
  structure, element counts, individual icons or labels, card composition, or
  pixel geometry unless that exact output is the product contract.
- Verify visual hierarchy, spacing, color, artwork, content quality, and broad
  responsive appearance through manual QA or agent-browser screenshots.
- Prefer the fewest assertions that prove the material outcome. Avoid repeating
  lower-level component or API contracts inside an end-to-end workflow.
- For user-facing web route/layout changes, run the related Vitest coverage and
  targeted `pnpm test:e2e` checks only when the changed workflow has a browser
  behavior to prove.
- Before opening a PR, run targeted tests/typechecks/lint for the touched web
  surface. Use `pnpm test:all` when the change has broad UI or routing impact;
  otherwise PR CI is the required full-repo validation gate.

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
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL` skips starting Next, so only use it when an equivalent
web server is already running with the API pointed at a compatible test target.

## Reliability Rules

- Prefer Playwright locators and web-first assertions over manual DOM polling.
- Avoid arbitrary sleeps. Increase assertion timeouts only for known cold-start
  costs such as Next dev route compilation.
- Mock external/API boundaries for layout and loading tests; use real services
  only when the behavior under test requires them.
- Do not mock or suppress logging. Logs should remain visible to test output;
  assert user-visible behavior or state changes instead of logger calls.
- Keep layout assertions narrow and intentional. A shared shell may warrant a
  dedicated overflow or focus test; ordinary page composition belongs in
  manual or agent-based visual QA.
- Keep Playwright output under `apps/web/.playwright`; it is ignored by git.
- When a Playwright failure is not obvious from the terminal, run
  `pnpm test:e2e:report` and inspect the retained trace.
