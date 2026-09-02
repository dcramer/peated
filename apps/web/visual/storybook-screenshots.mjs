import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const entrySchema = z.object({ type: z.string() }).passthrough();
const storySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  type: z.literal("story"),
});
const indexSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
});
const screenshotSchema = z
  .object({ file: z.string().min(1), label: z.string() })
  .passthrough();
const manifestSchema = z
  .object({
    capture: z.object({ browserVersion: z.string().nullable() }).passthrough(),
    screenshots: z.array(screenshotSchema),
  })
  .passthrough();

/** @typedef {z.infer<typeof storySchema>} Story */
/** @typedef {z.infer<typeof screenshotSchema>} Screenshot */

/**
 * Return the stories from a generated Storybook index.
 * @param {unknown} value
 * @returns {Story[]}
 */
export function storiesFromIndex(value) {
  const index = indexSchema.parse(value);
  return Object.values(index.entries)
    .flatMap((entry) =>
      entrySchema.parse(entry).type === "story"
        ? [storySchema.parse(entry)]
        : [],
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Use the Storybook hierarchy as Frameshift groups and the story as a variant.
 * @param {Story} story
 */
export function screenshotFile(story) {
  const title = story.title.split("/").map(slug);
  const name = slug(story.name);
  if (title.some((part) => !part) || !name) {
    throw new Error("Story titles and names must contain a letter or number.");
  }

  const component = title.pop();
  if (!component) {
    throw new Error("Story title must contain a component name.");
  }
  return path.posix.join("storybook", ...title, `${component}__${name}.png`);
}

/**
 * Replace the Storybook section of the existing E2E capture manifest.
 * @param {{
 *   browserVersion: string,
 *   output: string,
 *   screenshots: Screenshot[],
 * }} options
 */
export async function replaceStorybookScreenshotsInManifest({
  browserVersion,
  output,
  screenshots,
}) {
  const manifestFile = path.join(output, "manifest.json");
  const manifest = manifestSchema.parse(
    JSON.parse(await fs.readFile(manifestFile, "utf8")),
  );
  const routeScreenshots = manifest.screenshots.filter(
    (screenshot) => !screenshot.file.startsWith("storybook/"),
  );
  if (
    routeScreenshots.length > 0 &&
    manifest.capture.browserVersion !== browserVersion
  ) {
    throw new Error(
      "Storybook and E2E screenshots must use the same browser version.",
    );
  }
  const files = new Set(routeScreenshots.map((screenshot) => screenshot.file));

  for (const screenshot of screenshots) {
    if (files.has(screenshot.file)) {
      throw new Error(`Duplicate visual screenshot: ${screenshot.file}`);
    }
    await fs.access(path.join(output, screenshot.file));
    files.add(screenshot.file);
  }

  manifest.screenshots = [...routeScreenshots, ...screenshots].sort(
    (left, right) => left.file.localeCompare(right.file),
  );
  manifest.capture.browserVersion = browserVersion;
  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** @param {string} value */
function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
