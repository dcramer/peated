# Web screenshots in pull requests

This tool takes repeatable screenshots for web changes. CI captures the pull
request base and candidate revisions, compares matching PNG files, and posts
only visual changes. A page change does not fail CI.

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

Compare two capture directories:

```sh
pnpm --dir apps/web visual:diff -- \
  --baseline /tmp/visual-base \
  --candidate /tmp/visual-candidate \
  --output /tmp/visual-report
```

The report contains `report.json`. Changed PNGs include before, after, and
pixel diff images. Added PNGs include only after. Removed PNGs include only
before. It does not copy unchanged images.

CI uploads only the baseline and candidate manifests, `report.json`, and these
review images. The full baseline and candidate screenshots stay on the runner.

## Reuse the comparison action

The comparison accepts any two directories of PNG files. Matching relative
paths identify the same screenshot. Another public repository can use the
bundled action without installing Peated dependencies:

```yaml
- uses: dcramer/peated/.github/actions/visual-diff@<commit-sha>
  with:
    baseline: path/to/baseline
    candidate: path/to/candidate
    output: path/to/report
```

The action writes the report directory and returns the number of visual changes
as the `changes` output. Screenshot capture and report publication remain the
calling repository's responsibility.

After changing the comparison source, rebuild the committed action. Focused
tests fail if the bundle or its license file is out of date.

```sh
pnpm --dir apps/web visual:diff:build-action
```

## Add a scenario

1. Copy the nearest scenario file in `visual/scenarios/`.
2. Set its `id`, `label`, `path`, `heading`, and viewports.
3. Write `shouldRunFor` so the file states when it runs.
4. Add it to `visual/scenarios/index.mjs` in review order.
5. Add selection tests for files that should and should not select it.
6. Use fixed test data. Do not use production data or credentials.

The tests check the filename, ID, required fields, browser sizes, and ordered
list. A new scenario cannot pass `pnpm test` until these are complete.
