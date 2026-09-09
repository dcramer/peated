import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import {
  replaceStorybookScreenshotsInManifest,
  screenshotFile,
  storiesFromIndex,
} from "./storybook-screenshots.mjs";

const capturePageCount = 4;
const defaultViewport = { height: 900, width: 1440 };

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

declare global {
  interface Window {
    __STORYBOOK_PREVIEW__?: {
      currentRender?: {
        id?: string;
        phase?: string;
        story?: {
          parameters?: {
            viewport?: {
              options?: Record<
                string,
                { styles?: { height?: string; width?: string } }
              >;
            };
          };
          storyGlobals?: {
            viewport?: { isRotated?: boolean; value?: string };
          };
        };
      };
    };
  }
}

async function captureStory(page: Page, story: Story, output: string) {
  const search = new URLSearchParams({
    globals: "theme:light",
    id: story.id,
    viewMode: "story",
  });
  const href = `/iframe.html?${search}`;

  await page.setViewportSize(defaultViewport);
  await openStory(page, href, story.id);

  const storyViewport = await page.evaluate(() => {
    const story = window.__STORYBOOK_PREVIEW__?.currentRender?.story;
    const selected = story?.storyGlobals?.viewport;
    const option = selected?.value
      ? story?.parameters?.viewport?.options?.[selected.value]
      : undefined;
    const width = Number.parseInt(option?.styles?.width ?? "", 10);
    const height = Number.parseInt(option?.styles?.height ?? "", 10);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return selected?.isRotated
      ? { height: width, width: height }
      : { height, width };
  });

  if (
    storyViewport &&
    (storyViewport.width !== defaultViewport.width ||
      storyViewport.height !== defaultViewport.height)
  ) {
    await page.setViewportSize(storyViewport);
    await openStory(page, href, story.id);
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
    const imagesReady = Promise.all(
      Array.from(document.images, (image) => {
        // A lazy image below the viewport may never start loading. Do not let it
        // hold every Storybook screenshot open until the test times out.
        if (image.loading === "lazy" && !image.complete) {
          return Promise.resolve();
        }
        return image.decode().catch(() => {});
      }),
    );
    await Promise.race([
      imagesReady,
      new Promise((resolve) => window.setTimeout(resolve, 5_000)),
    ]);
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

async function openStory(page: Page, href: string, storyId: string) {
  await page.goto(href, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#storybook-root > *").first()).toBeVisible();
  // Storybook's root appears before portal effects and play functions finish.
  await page.waitForFunction((storyId) => {
    const render = window.__STORYBOOK_PREVIEW__?.currentRender;
    return (
      render?.id === storyId &&
      (render.phase === "afterEach" || render.phase === "finished")
    );
  }, storyId);
}

function visualOutputRoot() {
  const configured = process.env.VISUAL_OUTPUT_DIR;
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), ".playwright/visual");
}
