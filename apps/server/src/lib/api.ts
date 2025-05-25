import { and, eq } from "drizzle-orm";
import type { AnyDatabase } from "../db";
import type { User } from "../db/schema";
import { follows, users } from "../db/schema";

// export async function getUserFromId(
//   db: AnyDatabase,
//   userId: "me",
//   currentUser?: User | null | undefined,
// ): Promise<User | null>;
// export async function getUserFromId(
//   db: AnyDatabase,
//   userId: number,
//   currentUser?: User | null | undefined,
// ): Promise<User | null>;
// export async function getUserFromId(
//   db: AnyDatabase,
//   username: string,
//   currentUser?: User | null | undefined,
// ): Promise<User | null>;
export async function getUserFromId(
  db: AnyDatabase,
  userId: string | number | "me",
  currentUser?: User | null | undefined,
): Promise<User | null> {
  if (userId === "me") {
    return currentUser || null;
  }

  // TODO: this isnt ideal, but if we're only going to use this in the API
  // its ok. The rationale here is that numbers are passed as strings from
  // the query string, thus we have to coerce sometimes.
  if (typeof userId === "number" || Number.isFinite(+userId)) {
    return (
      (await db.query.users.findFirst({
        where: eq(users.id, Number(userId)),
      })) || null
    );
  }

  return (
    (await db.query.users.findFirst({
      where: eq(users.username, userId),
    })) || null
  );
}

export const profileVisible = async (
  db: AnyDatabase,
  user: User,
  currentUser?: User | null,
) => {
  if (!user.private) return true;
  if (!currentUser) return false;
  if (currentUser.id === user.id) return true;
  return !!(
    await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.fromUserId, currentUser.id),
          eq(follows.toUserId, user.id),
          eq(follows.status, "following"),
        ),
      )
  ).find((d) => !!d);
};
