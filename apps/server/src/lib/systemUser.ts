import { db, type AnyDatabase } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { canModerate, canModerateWhere } from "@peated/server/lib/moderators";
import { asc } from "drizzle-orm";

const PREFERRED_AUTOMATION_USERNAME = "dcramer";

export async function getAutomationModeratorUser(database: AnyDatabase = db) {
  const preferredUser = await database.query.users.findFirst({
    where: (table, { eq }) => eq(table.username, PREFERRED_AUTOMATION_USERNAME),
  });

  if (canModerate(preferredUser)) {
    return preferredUser;
  }

  const [fallbackUser] = await database
    .select()
    .from(users)
    .where(canModerateWhere())
    .orderBy(asc(users.id))
    .limit(1);

  if (!fallbackUser) {
    throw new Error("Unable to identify automation moderator user");
  }

  return fallbackUser;
}
