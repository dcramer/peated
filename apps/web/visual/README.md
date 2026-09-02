# E2E snapshots in pull requests

Playwright E2E tests can capture stable screenshots at useful workflow states.
CI compares these snapshots with the exact pull request base through
[Frameshift](https://frameshift.pub). Pixel changes do not fail the E2E test or
the screenshot workflow.

Snapshots are checkpoints inside behavioral E2E tests. There is no separate
visual scenario registry or visual test suite. Do not add a test whose only
outcome is a screenshot.

Storybook stories are the exception. The screenshot workflow captures each
story in its isolated view after the E2E suite finishes. Storybook owns these
component states, so the capture does not add another scenario registry.

## Capture a snapshot

Import `test` and `expect` from the shared E2E fixture:

```ts
import { expect, test } from "./test";

test("opens the account menu", async ({ page, snapshot }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Account" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  await snapshot("Account menu open", { ready: menu });
});
```

Pass the page element that proves the page is ready as `ready`. The fixture
checks that this element stays visible while it takes the screenshot. It also
waits for visible elements with `aria-busy="true"` to finish and for fonts to
load. Use `aria-busy="true"` on loading states that must block a screenshot. The
fixture disables animation and caret differences and hides the Next.js
development portal. It uses a full-page screenshot by default. Pass
`fullPage: false` when the screen size is part of the test, such as an open
mobile menu.

Use a short title that says what the image shows, such as "Home," "Bottle," or
"Menu." This title appears in Frameshift and sets the file name. Each title must
be unique.

Use `/` to group related states in Frameshift. For example,
`snapshot("Tasting form / Review / 1 Score")` writes
`tasting-form/review/1-score.png`. Keep the final segment specific to the visible
state. Use a number when workflow order matters.

## Run locally

Run the normal E2E suite, then capture the Storybook stories:

```sh
pnpm test:e2e
pnpm storybook:screenshots:build
pnpm storybook:screenshots
```

Images and `manifest.json` go to `apps/web/.playwright/visual/`. The E2E suite
resets the directory, and the Storybook command adds its screenshots from the
static build.

Storybook screenshot paths follow the story hierarchy. The story name is a
Frameshift variant, so related states stay together. For example, the
`Components/Layout/Workflow Screen` stories write:

```text
storybook/components/layout/workflow-screen__overview.png
storybook/components/layout/workflow-screen__saving.png
```

## Frameshift flow

The web screenshot workflow runs the normal E2E suite for both `main` and pull
request revisions. Each `main` run uploads all E2E snapshots in an artifact
keyed by the full commit SHA. A pull request run restores the artifact for the
merge commit's first parent and compares it with the candidate snapshots:

```text
main commit --run E2E--> revision-keyed baseline artifact
                                      |
pull request --run E2E + Storybook----+--> Frameshift report
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
