import { db } from "@peated/server/db";
import { externalSites, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteTypeEnum,
  StorePriceSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceSerializer } from "@peated/server/serializers/storePrice";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/prices",
    summary: "List store prices",
    description:
      "Retrieve store prices with filtering by site, validity, and unknown bottles. Requires admin privileges",
    operationId: "listPrices",
  })
  .input(
    z
      .object({
        site: ExternalSiteTypeEnum.optional(),
        query: z.string().default(""),
        onlyUnknown: z.boolean().optional(),
        onlyValid: z.boolean().optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
      }),
  )
  // TODO(response-envelope): helper enables later switch to { data, meta }
  .output(listResponse(StorePriceSchema))
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    context,
    errors,
  }) {
    const where: (SQL<unknown> | undefined)[] = [eq(storePrices.hidden, false)];

    if (input.site) {
      const site = await db.query.externalSites.findFirst({
        where: eq(externalSites.type, input.site),
      });

      if (!site) {
        throw errors.NOT_FOUND({
          message: "Site not found.",
        });
      }
      where.push(eq(storePrices.externalSiteId, site.id));
    }

    if (input.onlyValid) {
      where.push(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`);
    }

    if (input.onlyUnknown) {
      where.push(isNull(storePrices.bottleId));
    }

    if (query) {
      where.push(ilike(storePrices.name, `%${query}%`));
    }

    const offset = (cursor - 1) * limit;

    const results = await db
      .select()
      .from(storePrices)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(
        desc(sql`${storePrices.updatedAt} > NOW() - interval '1 week'`),
        asc(storePrices.name),
      );

    return {
      results: await serialize(
        StorePriceSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
