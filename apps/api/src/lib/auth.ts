import type { DatabaseType, TransactionType } from "@peated/core/db";
import type { NewUser, User } from "@peated/core/db/schema";
import { users } from "@peated/core/db/schema";
import { random } from "@peated/core/lib/rand";

export const createUser = async (
  db: DatabaseType | TransactionType,
  data: NewUser,
): Promise<User> => {
  let user: User | undefined;
  let attempt = 0;
  const baseUsername = data.username.toLowerCase();
  let currentUsername = baseUsername;
  if (currentUsername === "me")
    currentUsername = `${baseUsername}-${random(10000, 99999)}`;
  const maxAttempts = 5;
  while (!user && attempt < maxAttempts) {
    attempt += 1;

    try {
      user = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            ...data,
            username: currentUsername,
          })
          .returning();
        return user;
      });
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "user_username_unq") {
        currentUsername = `${baseUsername}-${random(10000, 99999)}`;
      } else {
        throw err;
      }
    }
  }
  if (!user) throw new Error("Unable to create user");
  return user;
};
