import fs from "node:fs/promises";
import path from "node:path";

// Bump this when an intentional capture change makes old baselines incompatible.
export const CAPTURE_CONTRACT = 2;

export default async function globalTeardown() {
  const output = process.env.VISUAL_OUTPUT_DIR
    ? path.resolve(process.env.VISUAL_OUTPUT_DIR)
    : path.resolve(".playwright/visual");
  const metadataRoot = path.join(output, ".metadata");
  const screenshots = await readMetadata(metadataRoot);
  const browserVersions = new Set(
    screenshots.map(({ browserVersion }) => browserVersion).filter(Boolean),
  );
  if (browserVersions.size > 1) {
    throw new Error("Visual snapshots used more than one browser version.");
  }

  await fs.writeFile(
    path.join(output, "manifest.json"),
    `${JSON.stringify(
      {
        capture: {
          browserVersion: browserVersions.values().next().value ?? null,
          contract: CAPTURE_CONTRACT,
          platform: `${process.platform}-${process.arch}`,
          runner: process.env.ImageOS ?? process.platform,
        },
        commitSha:
          process.env.VISUAL_SOURCE_SHA ?? process.env.GITHUB_SHA ?? null,
        screenshots: screenshots.map(({ browserVersion: _, ...item }) => item),
      },
      null,
      2,
    )}\n`,
  );
  await fs.rm(metadataRoot, { force: true, recursive: true });
}

async function readMetadata(root) {
  const files = await findJsonFiles(root).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const screenshots = await Promise.all(
    files.map(async (file) => JSON.parse(await fs.readFile(file, "utf8"))),
  );
  screenshots.sort((left, right) => left.file.localeCompare(right.file));

  const seen = new Set();
  for (const screenshot of screenshots) {
    if (seen.has(screenshot.file)) {
      throw new Error(`Duplicate visual snapshot: ${screenshot.file}`);
    }
    seen.add(screenshot.file);
    await fs.access(path.join(path.dirname(root), screenshot.file));
  }
  return screenshots;
}

async function findJsonFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? findJsonFiles(file)
        : Promise.resolve(entry.name.endsWith(".json") ? [file] : []);
    }),
  );
  return files.flat();
}
