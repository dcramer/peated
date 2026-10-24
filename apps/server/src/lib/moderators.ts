import { users } from "@peated/server/db/schema";
import { eq, or } from "drizzle-orm";

/**
 * Moderation rule: administrators and moderators can both moderate. The
 * "Who Can Moderate" section of docs/features/reports-and-blocks.md owns it.
 * A false result still allows the user to exist; it only rules out moderation.
 */
export function canModerate<
  TUser extends { admin?: boolean | null; mod?: boolean | null },
>(
  user: TUser | null | undefined,
): user is TUser & ({ admin: true } | { mod: true }) {
  return Boolean(user && (user.admin || user.mod));
}

/** Database filter for users who can moderate, matching `canModerate`. */
export function canModerateWhere() {
  return or(eq(users.admin, true), eq(users.mod, true));
}
