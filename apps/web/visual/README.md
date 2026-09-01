# Web screenshots in pull requests

This tool takes repeatable screenshots for web changes. CI captures the pull
request base and candidate revisions, compares matching PNG files, and links to
a focused Frameshift report. A page change does not fail CI.

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
It captures the first four matching scenarios. This keeps each report focused.

Shared UI and web setup changes match four representative pages: home, bottle
detail, member profile, and log a tasting. Changes to fixed test data match
each page that reads that data. The four-page limit still applies. Test-only
changes do not capture a page.

Add the `run-all-screenshots` label to capture every scenario.

## Where the baseline comes from

The workflow generates both screenshot sets during each pull request run. It
does not download the baseline from an older workflow artifact.

GitHub's `pull_request` event checks out a temporary merge commit. That commit
represents the pull request applied to its current base branch. CI uses it as
the candidate revision. It resolves the merge commit's first parent and checks
that exact Git commit out into `base-source`. It uses that checkout as the
baseline revision.

CI then installs each revision from its own lockfile and runs the same capture
command in both directories:

```text
merge commit checkout ──capture──> visual-output/candidate
       first parent ────capture──> visual-output/baseline
```

Both captures run on the same GitHub runner with the same Chromium version.
The capture tool also fixes the mock API data, color scheme, device scale,
locale, timezone, reduced-motion setting, and viewport sizes. This keeps the
comparison tied to source revisions without keeping a permanent screenshot
archive.

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

CI uses the pinned Frameshift Action to compare the base and candidate
directories. The report contains `report.json` plus only the images needed for
review. The PR comment and native `Frameshift` commit status link to the same
immutable report on [frameshift.pub](https://frameshift.pub).

CI uploads only the baseline and candidate manifests, `report.json`, and these
review images. The full baseline and candidate screenshots stay on the runner.

## Frameshift setup

Peated uses pinned Frameshift comparison and publisher Actions. Matching
relative paths identify the same screenshot:

```yaml
- uses: dcramer/frameshift@<full-commit-sha>
  with:
    baseline: path/to/baseline
    candidate: path/to/candidate
    output: path/to/report
```

The Action writes the report directory and returns the number of visual changes
as the `changes` output. A trusted `workflow_run` job passes that directory to
`dcramer/frameshift/publish`. The publisher validates the Zod contract, creates
the immutable report tag, and posts only a compact change summary plus the
Frameshift link. Peated keeps capture and privileged publication in separate
workflows so pull request code cannot receive write permissions.

## Add a scenario

1. Copy the nearest scenario file in `visual/scenarios/`.
2. Set its `id`, `label`, `path`, `heading`, and viewports.
3. Write `shouldRunFor` so the file states when it runs.
4. Add it to `visual/scenarios/index.mjs` in review order.
5. Add selection tests for files that should and should not select it.
6. Use fixed test data. Do not use production data or credentials.

The tests check the filename, ID, required fields, browser sizes, and ordered
list. A new scenario cannot pass `pnpm test` until these are complete.
