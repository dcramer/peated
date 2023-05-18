import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sign, verify } from "jsonwebtoken";
import config from "../config";
import { NewUser, User, users } from "../db/schema";
import { random } from "./rand";
import { serialize } from "./serializers";
import { UserSerializer } from "./serializers/user";

export const createAccessToken = async (
  user: User,
): Promise<string | undefined> => {
  const payload = await serialize(UserSerializer, user, user);
  return new Promise<string | undefined>((res, rej) => {
    sign(payload, config.JWT_SECRET, {}, (err, token) => {
      if (err) rej(err);
      res(token);
    });
  });
};

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

export const createUser = async (
  db: NodePgDatabase,
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
