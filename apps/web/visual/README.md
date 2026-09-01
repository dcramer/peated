# E2E snapshots in pull requests

Playwright E2E tests can capture stable screenshots at useful workflow states.
CI compares these snapshots with the exact pull request base through
[Frameshift](https://frameshift.pub). Pixel changes do not fail the E2E test or
the screenshot workflow.

Snapshots are checkpoints inside behavioral E2E tests. There is no separate
visual scenario registry or visual test suite. Do not add a test whose only
outcome is a screenshot.

## Capture a snapshot

Import `test` and `expect` from the shared E2E fixture:

```ts
import { expect, test } from "./test";

test("opens the account menu", async ({ page, snapshot }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menu")).toBeVisible();

  await snapshot("Account menu open");
});
```

The fixture waits for visible elements with `aria-busy="true"` to finish and
for fonts to load. It also disables animation and caret differences and hides
the Next.js development portal. Use `aria-busy="true"` on loading states that
must finish before a snapshot. The fixture uses a full-page screenshot by
default. Pass `{ fullPage: false }` when the viewport itself is part of the
workflow state, such as an open mobile menu.

Use a short title that says what the image shows, such as "Home," "Bottle," or
"Menu." This title appears in Frameshift and sets the file name. Each title must
be unique.

## Run locally

Run the normal E2E suite:

```sh
pnpm test:e2e
```

Images and `manifest.json` go to `apps/web/.playwright/visual/`. The directory
is reset at the start of each Playwright run.

## Frameshift flow

The web screenshot workflow runs the normal E2E suite for both `main` and pull
request revisions. Each `main` run uploads all E2E snapshots in an artifact
keyed by the full commit SHA. A pull request run restores the artifact for the
merge commit's first parent and compares it with the candidate snapshots:

```text
main commit --run E2E--> revision-keyed baseline artifact
                                      |
pull request --run E2E----------------+--> Frameshift report
```

Before comparison, CI checks the source SHA, capture contract, platform,
runner image, and exact Chromium version. An incompatible or missing baseline
fails with an instruction to generate the exact baseline. CI does not silently
capture the base with pull request code.

The capture job has read-only permissions. It uploads only the Frameshift
report for pull requests. A dependent job does not check out pull request code;
it publishes the validated report and adds the pull request link. Published
reports and baseline artifacts expire after 30 days.

Snapshot paths identify the same state across revisions. Renaming a snapshot
title intentionally removes the old path and adds a new one.
