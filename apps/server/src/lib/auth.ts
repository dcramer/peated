import { eq } from "drizzle-orm";
import { sign, verify } from "jsonwebtoken";
import config from "../config";
import type { DatabaseType, TransactionType } from "../db";
import { db } from "../db";
import type { NewUser, User } from "../db/schema";
import { users } from "../db/schema";
import { random } from "../lib/rand";
import { serialize } from "../serializers";
import { UserSerializer } from "../serializers/user";
import { logError } from "./log";

export const verifyToken = (token: string | undefined): Promise<any> => {
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
      res(decoded);
    });
  });
};

export const getUserFromHeader = async (
  authorizationHeader: string | undefined,
) => {
  const token = authorizationHeader?.replace(/^Bearer /i, "");
  if (!token) return null;

  const { id } = await verifyToken(token);
  if (!id) {
    console.warn(`Invalid Bearer token`);
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) {
    logError("User not found", { userId: id });
    return null;
  }

  if (!user.active) {
    console.debug(`Inactive user found for token`);
    return null;
  }

  return user;
};

export const createAccessToken = async (user: User): Promise<string> => {
  const payload = await serialize(UserSerializer, user, user);
  return new Promise<string>((res, rej) => {
    sign(payload, config.JWT_SECRET, {}, (err, token) => {
      if (err) rej(err);
      if (!token) throw new Error("Unknown error signing token.");
      res(token);
    });
  });
};

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
