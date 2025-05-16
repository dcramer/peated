import { db } from "@peated/server/db";
import { tags } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { TagSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TagSerializer } from "@peated/server/serializers/tag";
import { and, asc, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({ method: "GET", path: "/tags" })
  .input(
    z
      .object({
        bottle: z.coerce.number().optional(),
        query: z.string().default(""),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  .output(
    z.object({
      results: z.array(TagSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    context,
    errors,
  }) {
    const where: (SQL<unknown> | undefined)[] = [];

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(tags.name, `%${query}%`));
    }

    const results = await db
      .select()
      .from(tags)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(tags.name));

    return {
      results: await serialize(
        TagSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
