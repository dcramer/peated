import { db } from "@peated/server/db";
import { actors, changes } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import changeListContract from "@peated/server/orpc/contracts/changes/list";
import { serialize } from "@peated/server/serializers";
import { ChangeSerializer } from "@peated/server/serializers/change";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";

export default implement(changeListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const { cursor, limit, ...rest } = input;
  const offset = (cursor - 1) * limit;

  const where: (SQL<unknown> | undefined)[] = [
    inArray(changes.objectType, ["bottle", "entity"]),
  ];

  if (rest.type) {
    where.push(eq(changes.objectType, rest.type));
  }
  if (rest.user) {
    if (rest.user === "me") {
      if (!context.user) {
        throw errors.UNAUTHORIZED();
      }

      const [actor] = await db
        .select({ id: actors.id })
        .from(actors)
        .where(
          and(eq(actors.type, "user"), eq(actors.key, String(context.user.id))),
        )
        .limit(1);
      where.push(eq(changes.actorId, actor?.id ?? -1));
    } else {
      const [actor] = await db
        .select({ id: actors.id })
        .from(actors)
        .where(and(eq(actors.type, "user"), eq(actors.key, String(rest.user))))
        .limit(1);
      where.push(eq(changes.actorId, actor?.id ?? -1));
    }
  }

  const pageIds = db
    .select({ id: changes.id })
    .from(changes)
    .where(and(...where))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(desc(changes.id))
    .as("change_page_ids");
  const results = await db
    .select({ ...getTableColumns(changes) })
    .from(changes)
    .innerJoin(pageIds, eq(pageIds.id, changes.id))
    .orderBy(desc(changes.id));

  return {
    results: await serialize(
      ChangeSerializer,
      results.slice(0, limit),
      context.user,
    ),
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});
