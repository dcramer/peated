import { follows, users } from "@peated/server/db/schema";
import { eq, or, sql } from "drizzle-orm";

/** Member activity visible to one viewer; critic visibility is source-owned. */
export function viewerVisibleUserCondition(currentUserId?: number) {
  const visible = [eq(users.private, false)];
  if (currentUserId) {
    visible.push(
      eq(users.id, currentUserId),
      sql`${users.id} IN (
        SELECT ${follows.toUserId}
        FROM ${follows}
        WHERE ${follows.fromUserId} = ${currentUserId}
          AND ${follows.status} = 'following'
      )`,
    );
  }
  return or(...visible)!;
}
