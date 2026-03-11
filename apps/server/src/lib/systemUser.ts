import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { asc, eq, or } from "drizzle-orm";

const PREFERRED_AUTOMATION_USERNAME = "dcramer";

export async function getAutomationModeratorUser() {
  const preferredUser = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.username, PREFERRED_AUTOMATION_USERNAME),
  });

  if (preferredUser && (preferredUser.admin || preferredUser.mod)) {
    return preferredUser;
  }

  const [fallbackUser] = await db
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
