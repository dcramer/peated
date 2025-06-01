import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CursorSchema, ExternalSiteSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalSiteSerializer } from "@peated/server/serializers/externalSite";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, ilike } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/external-sites",
    summary: "List external sites",
    description: "Retrieve external sites with search and sorting options",
  })
  .input(
    z.object({
      query: z.coerce.string().default(""),
      sort: z.enum(["name", "-name"]).default("name"),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(100),
    })
  )
  .output(
    z.object({
      results: z.array(ExternalSiteSchema),
      rel: CursorSchema,
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { cursor, sort, limit, query } = input;
    const offset = (cursor - 1) * limit;

    const where: SQL<unknown>[] = [];
    if (query) {
      where.push(ilike(externalSites.name, `%${query}%`));
    }

    let orderBy: SQL<unknown>;
    switch (sort) {
      case "-name":
        orderBy = desc(externalSites.name);
        break;
      default:
        orderBy = asc(externalSites.name);
        break;
    }

    const results = await db
      .select()
      .from(externalSites)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        ExternalSiteSerializer,
        results.slice(0, limit),
        context.user
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
