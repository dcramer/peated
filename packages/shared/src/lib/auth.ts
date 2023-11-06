import { eq } from "drizzle-orm";
import { sign, verify } from "jsonwebtoken";
import config from "../config";
import { db } from "../db";
import type { User } from "../db/schema";
import { users } from "../db/schema";
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
  const token = authorizationHeader?.replace("Bearer ", "");
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
    // this code path is expected, no need to log
    return null;
  }

  return user;
};

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
