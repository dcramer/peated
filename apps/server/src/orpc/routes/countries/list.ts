import { MAJOR_COUNTRIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { CountrySchema, CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { CountrySerializer } from "@peated/server/serializers/country";
import { and, asc, desc, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_SORT = "name";

const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

const OutputSchema = z.object({
  results: z.array(CountrySchema),
  rel: CursorSchema,
});

export default procedure
  .route({
    method: "GET",
    path: "/countries",
    summary: "List countries",
    description:
      "Retrieve countries with filtering by major whisky regions, bottle counts, and search support",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        onlyMajor: z.coerce.boolean().default(false),
        hasBottles: z.coerce.boolean().default(false),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
        sort: DEFAULT_SORT,
      }),
  )
  .output(OutputSchema)
  .handler(async function ({
    input: { cursor, query, limit, ...input },
    context,
    errors,
  }) {
    const where: (SQL<unknown> | undefined)[] = [];

    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(countries.name, `%${query}%`));
    }

    if (input.hasBottles) {
      where.push(ne(countries.totalBottles, 0));
    }

    if (input.onlyMajor) {
      where.push(
        inArray(
          sql`LOWER(${countries.slug})`,
          MAJOR_COUNTRIES.map(([, slug]) => slug),
        ),
      );
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      case "name":
        orderBy = asc(countries.name);
        break;
      case "-name":
        orderBy = desc(countries.name);
        break;
      case "bottles":
        orderBy = asc(countries.totalBottles);
        break;
      case "-bottles":
        orderBy = desc(countries.totalBottles);
        break;
      default:
        // TODO: should be a schema validation error
        throw errors.BAD_REQUEST({
          message: `Invalid sort: ${input.sort}`,
        });
    }

    const results = await db
      .select()
      .from(countries)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        CountrySerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
