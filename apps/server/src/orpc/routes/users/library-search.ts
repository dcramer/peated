import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { getReservedCollection } from "@peated/server/lib/db";
import { implement } from "@peated/server/orpc";
import librarySearchContract from "@peated/server/orpc/contracts/users/library-search";
import { sql } from "drizzle-orm";
import { searchMemberBottles } from "./member-bottle-search";

export default implement(librarySearchContract).handler(async function ({
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

  const library = await getReservedCollection(db, user.id, "library");
  if (!library || !query) {
    return { entities: [], bottles: [] };
  }

  return searchMemberBottles({
    memberBottleIds: sql`SELECT ${collectionBottles.bottleId} AS bottle_id FROM ${collectionBottles} WHERE ${collectionBottles.collectionId} = ${library.id}`,
    query,
    limit,
    viewer: context.user,
  });
});
