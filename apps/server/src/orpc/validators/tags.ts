import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { inArray } from "drizzle-orm";

export async function validateTags(value: string[]): Promise<string[]> {
  if (value.length === 0) return [];
  const tagList = Array.from(new Set(value.map((t) => t.toLowerCase())));
  const results = await db
    .select()
    .from(tags)
    .where(inArray(tags.name, tagList));
  // TODO: validate each entry
  if (tagList.length !== results.length)
    throw new ORPCError("BAD_REQUEST", {
      message: "One or more tag values are invalid.",
    });
  return tagList;
}
