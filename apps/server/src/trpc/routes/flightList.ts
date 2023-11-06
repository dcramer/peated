import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

const DEFAULT_SORT = "name";

const SORT_OPTIONS = ["name", "-name"] as const;

export default publicProcedure
  .input(
    z
      .object({
        query: z.string().default(""),
        filter: z.enum(["public", "private", "none"]).optional(),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        page: z.number().gte(1).default(1),
        limit: z.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        sort: DEFAULT_SORT,
        page: 1,
        limit: 100,
      }),
  )
  .query(async function ({ input: { query, page, limit, ...input }, ctx }) {
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(ilike(flights.name, `%${query}%`));
    }

    if (ctx.user?.mod && input.filter === "none") {
      // do nothing
    } else {
      if (ctx.user) {
        where.push(
          or(eq(flights.public, true), eq(flights.createdById, ctx.user.id)),
        );
      } else {
        where.push(eq(flights.public, true));
      }

      if (input.filter === "public") {
        where.push(eq(flights.public, true));
      } else if (input.filter === "private") {
        where.push(eq(flights.public, false));
      }
    }

    let orderBy: SQL<unknown>;
    switch (input.sort) {
      case "name":
        orderBy = asc(flights.name);
        break;
      case "-name":
        orderBy = desc(flights.name);
        break;
      default:
        orderBy = asc(flights.name);
    }

    const results = await db
      .select()
      .from(flights)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(orderBy);

    return {
      results: await serialize(
        FlightSerializer,
        results.slice(0, limit),
        ctx.user,
      ),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  });
