import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@peated/api/db";
import { countries } from "@peated/api/db/schema";
import { regions } from "@peated/api/db/schema/regions";
import { serialize } from "@peated/api/serializers";
import { RegionSerializer } from "@peated/api/serializers/region";
import { and, asc, desc, eq, ilike, ne, sql, type SQL } from "drizzle-orm";
import { BadRequestError, badRequestSchema } from "http-errors-enhanced";
import { z } from "zod";
import { CursorSchema, RegionSchema } from "../schemas";

const DEFAULT_SORT = "name";
const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

export default new OpenAPIHono().openapi(
  {
    method: "get",
    path: "/",
    request: {
      query: z.object({
        country: z.union([z.number(), z.string()]),
        query: z.string().default(""),
        cursor: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        hasBottles: z.boolean().default(false),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              results: z.array(RegionSchema),
              rel: CursorSchema,
            }),
          },
        },
        description: "List of regions",
      },
      400: badRequestSchema,
    },
  },
  async function (c) {
    const { country, query, cursor, limit, sort, hasBottles } =
      c.req.valid("query");

    const where: (SQL<unknown> | undefined)[] = [];
    const offset = (cursor - 1) * limit;

    if (query) {
      where.push(ilike(regions.name, `%${query}%`));
    }

    if (typeof country === "number" || Number.isFinite(+country)) {
      where.push(eq(regions.countryId, Number(country)));
    } else if (country) {
      const [result] = await db
        .select({ id: countries.id })
        .from(countries)
        .where(eq(sql`LOWER(${countries.slug})`, country.toLowerCase()))
        .limit(1);
      if (!result) {
        throw new BadRequestError("Invalid country");
      }
      where.push(eq(regions.countryId, result.id));
    }

    if (hasBottles) {
      where.push(ne(regions.totalBottles, 0));
    }

    let orderBy: SQL<unknown>;
    switch (sort) {
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
        throw new Error(`Invalid sort: ${sort}`);
    }

    const results = await db
      .select()
      .from(regions)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return c.json({
      results: await serialize(
        RegionSerializer,
        results.slice(0, limit),
        c.get("user"),
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    });
  },
);
