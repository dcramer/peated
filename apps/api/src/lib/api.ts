import { eq } from "drizzle-orm";
import { DatabaseType, TransactionType } from "../db";
import { User, users } from "../db/schema";

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
  return name
    .replace(" years old", "-year-old")
    .replace(" year old", "-year-old")
    .replace("-years-old", "-year-old")
    .replace(" years", "-year-old")
    .replace(" year", "-year-old");
};
