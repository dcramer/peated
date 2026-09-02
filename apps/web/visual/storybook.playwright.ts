import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import {
  replaceStorybookScreenshotsInManifest,
  screenshotFile,
  storiesFromIndex,
} from "./storybook-screenshots.mjs";

const capturePageCount = 4;

test("capture Storybook stories", async ({ page, request }) => {
  const indexResponse = await request.get("/index.json");
  expect(indexResponse.ok()).toBe(true);
  const stories = storiesFromIndex(await indexResponse.json());
  expect(stories.length).toBeGreaterThan(0);

  const output = visualOutputRoot();
  const screenshots: Array<{ file: string; label: string }> = [];
  const extraPages = await Promise.all(
    Array.from({ length: Math.min(capturePageCount, stories.length) - 1 }, () =>
      page.context().newPage(),
    ),
  );
  const pages = [page, ...extraPages];
  let nextStory = 0;

  await Promise.all(
    pages.map(async (capturePage) => {
      while (nextStory < stories.length) {
        const story = stories[nextStory++];
        const label = `${story.title} / ${story.name}`;
        const screenshot = await test.step(label, () =>
          captureStory(capturePage, story, output),
        );
        screenshots.push(screenshot);
      }
    }),
  );

  const browserVersion = page.context().browser()?.version();
  if (!browserVersion) {
    throw new Error("Storybook screenshot browser version is unavailable.");
  }
  await replaceStorybookScreenshotsInManifest({
    browserVersion,
    output,
    screenshots,
  });
});

type Story = ReturnType<typeof storiesFromIndex>[number];

async function captureStory(page: Page, story: Story, output: string) {
  const search = new URLSearchParams({
    globals: "theme:light",
    id: story.id,
    viewMode: "story",
  });

  await page.goto(`/iframe.html?${search}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("#storybook-root > *").first()).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => {})),
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });

  const file = screenshotFile(story);
  await fs.mkdir(path.dirname(path.join(output, file)), {
    recursive: true,
  });
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    path: path.join(output, file),
    type: "png",
  });
  return {
    file,
    label: `${story.title} / ${story.name}`,
  };
}

function visualOutputRoot() {
  const configured = process.env.VISUAL_OUTPUT_DIR;
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), ".playwright/visual");
}
