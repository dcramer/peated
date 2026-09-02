import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import {
  replaceStorybookScreenshotsInManifest,
  screenshotFile,
  storiesFromIndex,
} from "./storybook-screenshots.mjs";

test("capture Storybook stories", async ({ page, request }) => {
  const indexResponse = await request.get("/index.json");
  expect(indexResponse.ok()).toBe(true);
  const stories = storiesFromIndex(await indexResponse.json());
  expect(stories.length).toBeGreaterThan(0);

  const output = visualOutputRoot();
  const screenshots: Array<{ file: string; label: string }> = [];
  for (const story of stories) {
    await test.step(`${story.title} / ${story.name}`, async () => {
      const url = new URL("/iframe.html", storybookUrl());
      url.searchParams.set("id", story.id);
      url.searchParams.set("viewMode", "story");
      url.searchParams.set("globals", "theme:light");

      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#storybook-root > *").first()).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images, (image) =>
            image.decode().catch(() => {}),
          ),
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
      screenshots.push({
        file,
        label: `${story.title} / ${story.name}`,
      });
    });
  }

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

function storybookUrl() {
  return process.env.STORYBOOK_URL ?? "http://127.0.0.1:6006";
}

function visualOutputRoot() {
  const configured = process.env.VISUAL_OUTPUT_DIR;
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), ".playwright/visual");
}
