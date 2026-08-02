import { db } from "@peated/server/db";
import { bottleTags, bottles, tags } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { TagSchema } from "@peated/server/schemas";
import { desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

const COMMON_TASTING_NOTE_NAMES = [
  "vanilla",
  "caramel",
  "oak",
  "apple",
  "smoke",
] as const;

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/suggested-tags",
    summary: "Get suggested tags for bottle",
    description:
      "Retrieve suggested tags for a bottle based on usage patterns for the bottle, brand, and category",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleSuggestedTags",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          tag: TagSchema,
          count: z.number(),
        }),
      ),
    }),
  )
  .handler(async function ({ input, errors }) {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    // TODO: change the logic to be weighted:
    // 1. high: recorded for this bottle (e.g. Hibiki 12-year-old)
    // 2. medium: recorded for this brand (e.g. Hibiki)
    // 3. low: recorded for this category (e.g. bourbon)
    const usedTags = Object.fromEntries(
      (
        await db
          .select({
            tag: bottleTags.tag,
            total: sql<string>`SUM(${bottleTags.count})`.as("total"),
          })
          .from(bottleTags)
          .innerJoin(bottles, eq(bottles.id, bottleTags.bottleId))
          .where(
            or(
              eq(bottleTags.bottleId, bottle.id),
              eq(bottles.brandId, bottle.brandId),
            ),
          )
          .groupBy(bottleTags.tag)
          .orderBy(desc(sql`total`))
      ).map((t) => [t.tag, t.total]),
    );

    const defaultTags = await db.select().from(tags);

    const commonTagOrder = new Map<string, number>(
      COMMON_TASTING_NOTE_NAMES.map((name, index) => [name, index]),
    );
    const results = defaultTags
      .map((t) => ({
        tag: t,
        count: Number(usedTags[t.name] || 0),
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (commonTagOrder.get(a.tag.name) ?? Number.MAX_SAFE_INTEGER) -
            (commonTagOrder.get(b.tag.name) ?? Number.MAX_SAFE_INTEGER) ||
          a.tag.name.localeCompare(b.tag.name),
      );

    return {
      results,
    };
  });
