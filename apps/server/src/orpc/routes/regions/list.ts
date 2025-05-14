import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { regions } from "@peated/server/db/schema/regions";
import { procedure } from "@peated/server/orpc";
import { CursorSchema, RegionSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { RegionSerializer } from "@peated/server/serializers/region";
import { and, asc, desc, eq, ilike, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_SORT = "name";

const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

const InputSchema = z.object({
  country: z.union([z.coerce.number(), z.string()]),
  query: z.string().default(""),
  cursor: z.coerce.number().gte(1).default(1),
  limit: z.coerce.number().gte(1).lte(100).default(100),
  sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
  hasBottles: z.coerce.boolean().default(false),
});

const OutputSchema = z.object({
  results: z.array(RegionSchema),
  rel: CursorSchema,
});

export default procedure
  .route({ method: "GET", path: "/regions" })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    context,
  }) {
    const where: (SQL<unknown> | undefined)[] = [];

    const offset = (cursor - 1) * limit;

    // TODO: switch to tsvector to improve upon unicode
    if (query) {
      where.push(ilike(regions.name, `%${query}%`));
    }

    if (Number.isFinite(+input.country)) {
      where.push(eq(regions.countryId, Number(input.country)));
    } else if (input.country) {
      const [result] = await db
        .select({ id: countries.id })
        .from(countries)
        .where(
          eq(
            sql`LOWER(${countries.slug})`,
            String(input.country).toLowerCase(),
          ),
        )
        .limit(1);
      if (!result) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid country",
        });
      }
      where.push(eq(regions.countryId, result.id));
    }

    if (input.hasBottles) {
      where.push(ne(regions.totalBottles, 0));
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      case "name":
        orderBy = asc(regions.name);
        break;
      case "-name":
        orderBy = desc(regions.name);
        break;
      case "bottles":
        orderBy = asc(regions.totalBottles);
        break;
      case "-bottles":
        orderBy = desc(regions.totalBottles);
        break;
      default:
        throw new ORPCError("BAD_REQUEST", {
          message: `Invalid sort: ${input.sort}`,
        });
    }

    const results = await db
      .select()
      .from(regions)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        RegionSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
