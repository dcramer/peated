import { db, type AnyDatabase } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { asc, eq, or } from "drizzle-orm";

const PREFERRED_AUTOMATION_USERNAME = "dcramer";

export async function getAutomationModeratorUser(database: AnyDatabase = db) {
  const preferredUser = await database.query.users.findFirst({
    where: (table, { eq }) => eq(table.username, PREFERRED_AUTOMATION_USERNAME),
  });

  if (preferredUser && (preferredUser.admin || preferredUser.mod)) {
    return preferredUser;
  }

  const [fallbackUser] = await database
    .select()
    .from(users)
    .where(or(eq(users.admin, true), eq(users.mod, true)))
    .orderBy(asc(users.id))
    .limit(1);

  if (!fallbackUser) {
    throw new Error("Unable to identify automation moderator user");
  }

  return fallbackUser;
}
