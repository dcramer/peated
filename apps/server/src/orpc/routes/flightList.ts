import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { FlightSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

const DEFAULT_SORT = "name";

const SORT_OPTIONS = ["name", "-name"] as const;

const OutputSchema = z.object({
  results: z.array(FlightSchema),
  rel: z.object({
    nextCursor: z.number().nullable(),
    prevCursor: z.number().nullable(),
  }),
});

export default procedure
  .route({ method: "GET", path: "/flights" })
  .input(
    z
      .object({
        query: z.string().default(""),
        filter: z.enum(["public", "private", "none"]).optional(),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        sort: DEFAULT_SORT,
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

    const where: (SQL<unknown> | undefined)[] = [];
    if (query) {
      where.push(ilike(flights.name, `%${query}%`));
    }

    if (context.user?.mod && input.filter === "none") {
      // do nothing
    } else {
      if (context.user) {
        where.push(
          or(
            eq(flights.public, true),
            eq(flights.createdById, context.user.id),
          ),
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
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
