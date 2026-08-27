import { db } from "@peated/server/db";
import { flights } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import flightListContract from "@peated/server/orpc/contracts/flights/list";
import { serialize } from "@peated/server/serializers";
import { FlightSerializer } from "@peated/server/serializers/flight";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

export default implement(flightListContract).handler(async function ({
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
        or(eq(flights.public, true), eq(flights.createdById, context.user.id)),
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
