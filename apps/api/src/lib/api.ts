import { and, eq } from "drizzle-orm";
import { DatabaseType, TransactionType } from "../db";
import { User, follows, users } from "../db/schema";

// export async function getUserFromId(
//   db: DatabaseType | TransactionType,
//   userId: "me",
//   currentUser?: User | null | undefined,
// ): Promise<User | null>;
// export async function getUserFromId(
//   db: DatabaseType | TransactionType,
//   userId: number,
//   currentUser?: User | null | undefined,
// ): Promise<User | null>;
// export async function getUserFromId(
//   db: DatabaseType | TransactionType,
//   username: string,
//   currentUser?: User | null | undefined,
// ): Promise<User | null>;
export async function getUserFromId(
  db: DatabaseType | TransactionType,
  userId: string | number | "me",
  currentUser?: User | null | undefined,
): Promise<User | null> {
  if (userId === "me") {
    return currentUser || null;
  }

  if (typeof userId === "number") {
    return (
      (await db.query.users.findFirst({
        where: eq(users.id, userId),
      })) || null
    );
  }

  return (
    (await db.query.users.findFirst({
      where: eq(users.username, userId),
    })) || null
  );
}

export const fixBottleName = (name: string, age?: number | null): string => {
  // try to ease UX and normalize common name components
  if (age && name == `${age}`) return `${age}-year-old`;
  name = name
    .replace(/ years? old/i, "-year-old")
    .replace(/-years?-old/i, "-year-old")
    .replace(/ years?/, "-year-old");
  if (name.indexOf(`${age} `) === 0) {
    name = name.replace(`${age} `, `${age}-year-old `);
  }
  if (name.endsWith(` ${age}`)) {
    name = `${name}-year-old`;
  }
  return name.replace(` ${age} `, ` ${age}-year-old `);
};

export const profileVisible = async (
  db: DatabaseType | TransactionType,
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
