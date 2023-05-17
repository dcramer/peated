import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sign, verify } from "jsonwebtoken";
import config from "../config";
import { NewUser, User, users } from "../db/schema";
import { random } from "./rand";
import { SerializedUser, serializeUser } from "./serializers/user";

export const createAccessToken = (user: User): Promise<string | undefined> => {
  return new Promise<string | undefined>((res, rej) => {
    sign(serializeUser(user, user), config.JWT_SECRET, {}, (err, token) => {
      if (err) rej(err);
      res(token);
    });
  });
};

export const verifyToken = (
  token: string | undefined,
): Promise<SerializedUser> => {
  return new Promise((res, rej) => {
    if (!token) {
      rej("invalid token");
      return;
    }

    verify(token, config.JWT_SECRET, {}, (err, decoded) => {
      if (err) {
        rej("invalid token");
        return;
      }
      if (!decoded || typeof decoded === "string") {
        rej("invalid token");
      }
      res(decoded as SerializedUser);
    });
  });
};

export const createUser = async (
  db: NodePgDatabase,
  data: NewUser,
): Promise<User> => {
  let user: User | undefined;
  let attempt = 0;
  const baseUsername = data.username.toLowerCase();
  let currentUsername = baseUsername;
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
