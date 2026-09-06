import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import type { TagCategory } from "@peated/server/types";
import { inArray } from "drizzle-orm";

export async function loadTagCategories(tagNames: readonly string[]) {
  const names = [...new Set(tagNames)];
  if (!names.length) return new Map<string, TagCategory>();

  const storedTags = await db
    .select({ name: tags.name, category: tags.tagCategory })
    .from(tags)
    .where(inArray(tags.name, names));

  return new Map(storedTags.map((tag) => [tag.name, tag.category]));
}

export function categoriesForTags(
  tagNames: readonly string[],
  categoriesByName: ReadonlyMap<string, TagCategory>,
): Record<string, TagCategory> {
  return Object.fromEntries(
    tagNames.flatMap((name) => {
      const category = categoriesByName.get(name);
      return category ? [[name, category]] : [];
    }),
  );
}
