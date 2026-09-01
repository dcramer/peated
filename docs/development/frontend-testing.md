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

- Use Vitest for logic such as state, validation, callbacks, and route loading
  decisions.
- Use Playwright to prove a user-visible behavior: a workflow completes,
  navigation reaches the right destination, a mutation changes state, a filter
  changes results, access boundaries hold, or a browser-only interaction works.
- Keep one Playwright test for each material user outcome. Test response
  variants, validation rules, and deterministic rendering in Vitest unless the
  browser makes a different decision.
- Add breakpoint-specific Playwright coverage only when responsive behavior
  changes the interaction or available workflow. Do not rerun the same contract
  at multiple sizes solely to verify presentation.
- Do not use automated tests to check copy, icons, labels, page structure, card
  layout, element counts, or exact sizes and positions.
- Check spacing, color, artwork, copy, and responsive layouts manually or with
  browser screenshots.
- E2E tests can call the shared `snapshot` fixture after they prove a useful
  workflow state. Frameshift reviews the image change, but the image is not a
  test assertion. The fixture waits for visible `aria-busy="true"` loading
  states to finish before capture. Do not add screenshot-only E2E tests.
- Prefer the fewest assertions that prove the material outcome. Avoid repeating
  lower-level component or API contracts inside an end-to-end workflow.
- Test a loading fallback only when it changes what a user can do. Check how it
  looks during browser QA.
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

This keeps browser tests independent from a local database and API server.
Browser workflow tests should reuse the shared e2e fixtures and add narrow mock
RPC responses for the routes they exercise.

Import `test` and `expect` from `e2e/test.ts`, not directly from Playwright.
This makes the optional `snapshot` fixture available to every browser test.
Snapshot paths include the spec, test, checkpoint, and browser project, so keep
these names stable unless the visual identity should change.

CI runs all browser workflows once with desktop Chromium. The mobile project
runs only tests tagged `@mobile`. Use the tag only when a touch interaction,
responsive control, or mobile-only workflow has a separate product contract:

```ts
test(
  "uses the mobile-only interaction",
  { tag: "@mobile" },
  async ({ page }) => {
    // Prove the interaction that differs on mobile.
  },
);
```

Useful overrides:

```shell
PLAYWRIGHT_PORT=3201 pnpm test:e2e
PLAYWRIGHT_API_PORT=5000 pnpm test:e2e
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 pnpm test:e2e
```

`PLAYWRIGHT_BASE_URL` skips starting Next, so only use it when an equivalent
web server is already running with the API pointed at a compatible test target.

## CI Budget

- The Playwright command should finish in less than 5 minutes on a healthy CI
  runner. Its hard timeout is 7 minutes. The 15-minute GitHub job timeout also
  includes dependency and browser setup.
- The suite can schedule at most 80 tests across all browser projects. The
  `test:e2e` command checks this limit and the mobile tagging, timeout, retry,
  and failure policies before it starts a browser.
- A test gets one CI retry. Do not increase retries or timeouts to hide an
  intermittent failure. Fix the ownership or remove browser coverage that a
  cheaper test already proves.
- CI stops after two failures so it can retain traces and report the failing
  scenarios before the outer job timeout.
- Review the browser count and CI duration when adding a scenario. If a change
  pushes the healthy run above the budget, consolidate the suite in the same
  change.

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
