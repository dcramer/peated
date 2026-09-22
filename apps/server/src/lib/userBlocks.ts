import { and, eq, or } from "drizzle-orm";
import type { AnyDatabase } from "../db";
import { userBlocks } from "../db/schema";

// Block rule (members): a block in either direction stops both members from
// commenting on, toasting, or sending friend requests to each other. It does
// not hide content. See docs/features/reports-and-blocks.md.
export async function hasBlockBetween(
  db: AnyDatabase,
  userId: number,
  otherUserId: number,
): Promise<boolean> {
  const [block] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(
          eq(userBlocks.userId, userId),
          eq(userBlocks.blockedUserId, otherUserId),
        ),
        and(
          eq(userBlocks.userId, otherUserId),
          eq(userBlocks.blockedUserId, userId),
        ),
      ),
    )
    .limit(1);
  return !!block;
}
