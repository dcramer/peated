import {
  test as base,
  expect,
  type Locator,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export type { Locator, Page, Request } from "@playwright/test";
export { expect };
export type { TestInfo };

type Snapshot = (
  title: string,
  options: { fullPage?: boolean; ready: Locator },
) => Promise<void>;

/** Snapshot paths are durable Frameshift identities. Keep retries and workers out of them. */
export const test = base.extend<{ snapshot: Snapshot }>({
  snapshot: async ({ page }, use, testInfo) => {
    const titles = new Set<string>();

    await use(async (title, { fullPage = true, ready }) => {
      const snapshotName = slug(title);
      if (!snapshotName)
        throw new Error("Snapshot titles must contain a letter or number.");
      if (titles.has(snapshotName)) {
        throw new Error(`Duplicate snapshot title in one test: ${title}`);
      }
      titles.add(snapshotName);

      await page.waitForLoadState("domcontentloaded");
      const loadingStates = page.locator('[aria-busy="true"]:visible');
      await page.evaluate(async () => document.fonts.ready);
      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });

      const outputRoot = visualOutputRoot();
      const file = snapshotFile(snapshotName);
      const imagePath = path.join(outputRoot, file);
      const metadataFile = snapshotMetadataFile(testInfo, snapshotName);
      const metadataPath = path.join(outputRoot, ".metadata", metadataFile);
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      await reserveSnapshot(outputRoot, file, testInfo, snapshotName);
      let captured = false;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await expect(ready).toBeVisible();
        await expect(loadingStates).toHaveCount(0);
        await page.screenshot({
          animations: "disabled",
          caret: "hide",
          fullPage,
          path: imagePath,
          type: "png",
        });
        if ((await ready.isVisible()) && (await loadingStates.count()) === 0) {
          captured = true;
          break;
        }
      }
      if (!captured) {
        throw new Error(
          "The expected page state changed during visual snapshot capture.",
        );
      }

      await fs.mkdir(path.dirname(metadataPath), { recursive: true });
      await fs.writeFile(
        metadataPath,
        `${JSON.stringify(
          {
            browserVersion: page.context().browser()?.version() ?? null,
            file,
            label: title,
          },
          null,
          2,
        )}\n`,
      );
    });
  },
});

function visualOutputRoot() {
  const configured = process.env.VISUAL_OUTPUT_DIR;
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), ".playwright/visual");
}

export function snapshotFile(snapshotName: string) {
  return `${snapshotName}.png`;
}

export function snapshotMetadataFile(testInfo: TestInfo, snapshotName: string) {
  const specPath = path
    .relative(testInfo.project.testDir, testInfo.file)
    .replaceAll(path.sep, "/")
    .replace(/\.spec\.[cm]?[jt]sx?$/, "")
    .split("/")
    .map(slug)
    .filter(Boolean);
  const testPath = snapshotTitles(testInfo).map(slug).filter(Boolean);
  return path.posix.join(
    ...(specPath.length > 0 ? specPath : ["test"]),
    ...testPath,
    `${snapshotName}__${slug(testInfo.project.name) || "project"}.json`,
  );
}

async function reserveSnapshot(
  outputRoot: string,
  file: string,
  testInfo: TestInfo,
  snapshotName: string,
) {
  const lockPath = path.join(outputRoot, ".metadata", ".locks", `${file}.lock`);
  const owner = JSON.stringify({
    file: path.relative(testInfo.project.testDir, testInfo.file),
    project: testInfo.project.name,
    snapshot: snapshotName,
    titlePath: testInfo.titlePath,
  });
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  try {
    await fs.writeFile(lockPath, owner, { flag: "wx" });
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "EEXIST")
    ) {
      throw error;
    }
    if ((await fs.readFile(lockPath, "utf8")) !== owner) {
      throw new Error(`Duplicate visual snapshot file: ${file}`, {
        cause: error,
      });
    }
  }
}

function snapshotTitles(testInfo: Pick<TestInfo, "title" | "titlePath">) {
  const titles = testInfo.titlePath.slice(1);
  return titles.length > 0 ? titles : [testInfo.title];
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
