import { OpenAPIHono } from "@hono/zod-openapi";
import { MAJOR_COUNTRIES } from "@peated/api/constants";
import { db } from "@peated/api/db";
import { countries } from "@peated/api/db/schema";
import { CountrySchema } from "@peated/api/schemas/countries";
import { serialize } from "@peated/api/serializers";
import { CountrySerializer } from "@peated/api/serializers/country";
import { and, asc, desc, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { CursorSchema } from "../schemas";

const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

const CountryListQuerySchema = z.object({
  query: z
    .string()
    .default("")
    .openapi({ param: { style: "form" } }),
  cursor: z
    .number()
    .gte(1)
    .default(1)
    .openapi({ param: { style: "form" } }),
  limit: z
    .number()
    .gte(1)
    .lte(100)
    .default(100)
    .openapi({ param: { style: "form" } }),
  sort: z
    .enum(SORT_OPTIONS)
    .default("name")
    .openapi({ param: { style: "form" } }),
  onlyMajor: z
    .boolean()
    .default(false)
    .openapi({ param: { style: "form" } }),
  hasBottles: z
    .boolean()
    .default(false)
    .openapi({ param: { style: "form" } }),
});

const CountryListResponseSchema = z.object({
  results: z.array(CountrySchema),
  rel: CursorSchema,
});

export default new OpenAPIHono().openapi(
  {
    method: "get",
    path: "/",
    request: {
      query: CountryListQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CountryListResponseSchema,
          },
        },
        description:
          "List countries with optional filters, sorting, and pagination.",
      },
    },
    tags: ["countries"],
    summary: "List countries",
  },
  async (c) => {
    const { query, cursor, limit, sort, onlyMajor, hasBottles } =
      c.req.valid("query");
    const where: SQL<unknown>[] = [];
    const offset = (cursor - 1) * limit;
    if (query) {
      where.push(ilike(countries.name, `%${query}%`));
    }
    if (hasBottles) {
      where.push(ne(countries.totalBottles, 0));
    }
    if (onlyMajor) {
      where.push(
        inArray(
          sql`LOWER(${countries.slug})`,
          MAJOR_COUNTRIES.map(([, slug]) => slug),
        ),
      );
    }
    let orderBy: SQL<unknown>;
    switch (sort) {
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
        orderBy = asc(countries.name);
    }
    const results = await db
      .select()
      .from(countries)
      .where(where.length ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);
    return c.json({
      results: await serialize(CountrySerializer, results.slice(0, limit)),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    });
  },
);
