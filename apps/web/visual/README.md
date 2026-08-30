# Web screenshots in pull requests

This tool takes repeatable screenshots for web changes. It posts the images on
the pull request. It does not compare pixels. A page change does not fail CI.

Each page has its own file in `visual/scenarios/`. That file contains:

- The URL to open.
- The heading that proves the page loaded.
- Whether the page needs a signed-in user.
- The desktop and mobile browser sizes.
- `shouldRunFor`, which lists the source changes that affect the page.

The ordered scenario list is in `visual/scenarios/index.mjs`. The four-page
limit is in `visual/select-scenarios.mjs`.

## How CI chooses pages

CI checks each changed file against each scenario's `shouldRunFor` function.
It captures the first four matching scenarios. This keeps the pull request
comment short.

Shared UI and web setup changes match four representative pages: home, bottle
detail, member profile, and log a tasting. Changes to fixed test data match
each page that reads that data. The four-page limit still applies. Test-only
changes do not capture a page.

Add the `run-all-screenshots` label to capture every scenario.

## Run locally

Capture named scenarios:

```sh
pnpm visual:web -- --scenarios home,bottle-detail
```

Capture all scenarios:

```sh
pnpm visual:web -- --all
```

Choose scenarios from changed files:

```sh
git diff --name-only origin/main...HEAD > /tmp/peated-screenshot-changes.txt
pnpm visual:web -- --changed-file /tmp/peated-screenshot-changes.txt
```

Images and `manifest.json` go to `apps/web/.playwright/visual/`.

## Add a scenario

1. Copy the nearest scenario file in `visual/scenarios/`.
2. Set its `id`, `label`, `path`, `heading`, and viewports.
3. Write `shouldRunFor` so the file states when it runs.
4. Add it to `visual/scenarios/index.mjs` in review order.
5. Add selection tests for files that should and should not select it.
6. Use fixed test data. Do not use production data or credentials.

The tests check the filename, ID, required fields, browser sizes, and ordered
list. A new scenario cannot pass `pnpm test` until these are complete.
