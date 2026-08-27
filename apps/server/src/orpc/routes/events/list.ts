import { db } from "@peated/server/db";
import { events } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import eventListContract from "@peated/server/orpc/contracts/events/list";
import { serialize } from "@peated/server/serializers";
import { EventSerializer } from "@peated/server/serializers/event";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
export default implement(eventListContract).handler(async function ({
  input: { cursor, sort, limit, query, ...input },
  context,
}) {
  const offset = (cursor - 1) * limit;

  const where: (SQL<unknown> | undefined)[] = [
    or(
      and(isNull(events.dateEnd), gte(events.dateStart, sql`CURRENT_DATE`)),
      gte(events.dateEnd, sql`CURRENT_DATE`),
    ),
  ];

  if (input.onlyUpcoming) {
    where.push(lte(events.dateStart, sql`CURRENT_DATE + INTERVAL '45' DAY`));
  }

  if (query) {
    where.push(ilike(events.name, `%${query}%`));
  }

  let orderBy: SQL<unknown>;
  switch (sort) {
    case "date":
      orderBy = asc(events.dateStart);
      break;
    case "-date":
      orderBy = desc(events.dateStart);
      break;
    case "-name":
      orderBy = desc(events.name);
      break;
    case "name":
      orderBy = asc(events.name);
      break;
  }

  const results = await db
    .select()
    .from(events)
    .where(where ? and(...where) : undefined)
    .limit(limit + 1)
    .offset(offset)
    .orderBy(orderBy);

  return {
    results: await serialize(
      EventSerializer,
      results.slice(0, limit),
      context.user,
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
