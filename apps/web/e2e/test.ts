import { test as base, expect, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

export type { Locator, Page, Request } from "@playwright/test";
export { expect };
export type { TestInfo };

type Snapshot = (
  name: string,
  options?: { fullPage?: boolean },
) => Promise<void>;

/** Snapshot paths are durable Frameshift identities. Keep retries and workers out of them. */
export const test = base.extend<{ snapshot: Snapshot }>({
  snapshot: async ({ page }, use, testInfo) => {
    const names = new Set<string>();

    await use(async (name, { fullPage = true } = {}) => {
      const snapshotName = slug(name);
      if (!snapshotName)
        throw new Error("Snapshot names must contain a letter or number.");
      if (names.has(snapshotName)) {
        throw new Error(`Duplicate snapshot name in one test: ${name}`);
      }
      names.add(snapshotName);

      await page.evaluate(async () => document.fonts.ready);
      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });

      const outputRoot = visualOutputRoot();
      const file = snapshotFile(testInfo, snapshotName);
      const imagePath = path.join(outputRoot, file);
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      await page.screenshot({
        animations: "disabled",
        caret: "hide",
        fullPage,
        path: imagePath,
        type: "png",
      });

      const metadataPath = path.join(outputRoot, ".metadata", `${file}.json`);
      await fs.mkdir(path.dirname(metadataPath), { recursive: true });
      await fs.writeFile(
        metadataPath,
        `${JSON.stringify(
          {
            browserVersion: page.context().browser()?.version() ?? null,
            file,
            label: [
              ...snapshotTitles(testInfo),
              name,
              projectLabel(testInfo.project.name),
            ].join(" · "),
            project: testInfo.project.name,
            snapshot: name,
            test: snapshotTitles(testInfo).join(" › "),
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

export function snapshotFile(testInfo: TestInfo, snapshotName: string) {
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
    `${snapshotName}__${slug(testInfo.project.name) || "project"}.png`,
  );
}

function snapshotTitles(testInfo: Pick<TestInfo, "title" | "titlePath">) {
  const titles = testInfo.titlePath.slice(1);
  return titles.length > 0 ? titles : [testInfo.title];
}

function projectLabel(project: string) {
  return project
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
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
