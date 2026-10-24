import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { implement } from "@peated/server/orpc";
import tastingSearchContract from "@peated/server/orpc/contracts/users/tasting-search";
import { sql } from "drizzle-orm";
import { searchMemberBottles } from "./member-bottle-search";

export default implement(tastingSearchContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const { query, limit } = input;

  const user = await getUserFromId(db, input.user, context.user);
  if (!user) {
    throw errors.NOT_FOUND({
      message: "User not found.",
    });
  }

  if (!(await profileVisible(db, user, context.user))) {
    throw errors.BAD_REQUEST({
      message: "User's profile is private.",
    });
  }

  if (!query) {
    return { entities: [], bottles: [] };
  }

  return searchMemberBottles({
    memberBottleIds: sql`SELECT DISTINCT ${tastings.bottleId} AS bottle_id FROM ${tastings} WHERE ${tastings.createdById} = ${user.id} AND ${tastings.removedAt} IS NULL`,
    query,
    limit,
    viewer: context.user,
  });
});
