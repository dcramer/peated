import { db } from "@peated/server/db";
import { bottleAliases, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalSiteSchema,
  StorePriceSchema,
  listResponse,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import {
  and,
  asc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

const OutputSchema = listResponse(
  z.object({
    name: z.string(),
    createdAt: z.string(),
    bottleId: z.number().nullable(),
    bestMatch: z.null(),
    exampleListing: StorePriceSchema.extend({
      site: ExternalSiteSchema,
    }).nullable(),
  }),
);

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/unmatched",
    summary: "List unmatched bottles",
    description:
      "Retrieve bottle aliases that haven't been matched to existing bottles, with example store listings. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "listUnmatchedBottles",
    }),
  })
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
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    const { cursor, query, limit, ...rest } = input;

    const where: (SQL<unknown> | undefined)[] = [
      eq(bottleAliases.ignored, false),
      isNull(bottleAliases.bottleId),
    ];

    if (query) {
      where.push(ilike(bottleAliases.name, `%${query}%`));
    }

    const offset = (cursor - 1) * limit;

    const { embedding, ...columns } = getTableColumns(bottleAliases);
    const results = await db
      .select(columns)
      .from(bottleAliases)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(asc(bottleAliases.name));

    const hasNextPage = results.length > limit;

    const exampleListings = await db.query.storePrices.findMany({
      where: inArray(
        storePrices.name,
        results.map((a) => a.name),
      ),
      with: {
        externalSite: true,
      },
    });

    const examplesByName = Object.fromEntries(
      (
        await serialize(
          StorePriceWithSiteSerializer,
          exampleListings,
          context.user,
        )
      ).map((data, index) => [exampleListings[index].name, data]),
    );

    return {
      results: results.slice(0, limit).map((a) => ({
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        bottleId: a.bottleId,
        bestMatch: null,
        exampleListing: examplesByName[a.name] || null,
      })),
      rel: {
        nextCursor: hasNextPage ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
