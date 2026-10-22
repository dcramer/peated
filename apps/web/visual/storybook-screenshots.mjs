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

/** @typedef {z.infer<typeof storySchema>} Story */

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
