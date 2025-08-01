import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BadgeSchema, CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import type { SQL } from "drizzle-orm";
import { and, asc, ilike } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = z.object({
  results: z.array(BadgeSchema),
  rel: CursorSchema,
});

export default procedure
  .route({
    method: "GET",
    path: "/badges",
    operationId: "listBadges",
    summary: "List badges",
    description: "Retrieve available badges with search and pagination support",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        sort: z.enum(["name"]).default("name"),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        sort: "name",
        cursor: 1,
        limit: 100,
      }),
  )
  .output(OutputSchema)
  .handler(async function ({
    input: { query, cursor, limit, ...input },
    context,
  }) {
    const offset = (cursor - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (query) {
      where.push(ilike(badges.name, `%${query}%`));
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      default:
        orderBy = asc(badges.name);
        break;
    }

    const results = await db
      .select()
      .from(badges)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        BadgeSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
