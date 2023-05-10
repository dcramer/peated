import { sign, verify } from "jsonwebtoken";
import config from "../config";
import { User } from "../db/schema";
interface SerializedUser {
  id: number;
  displayName: string | null;
  pictureUrl: string | null;
  admin?: boolean;
  email?: string;
  createdAt?: string;
}

export const serializeUser = (
  user: User,
  currentUser?: User
): SerializedUser => {
  const data: SerializedUser = {
    id: user.id,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl
      ? `${config.URL_PREFIX}${user.pictureUrl}`
      : null,
  };
  if (currentUser && (currentUser.admin || currentUser.id === user.id)) {
    return {
      ...data,
      email: user.email,
      createdAt: user.email,
      admin: user.admin,
    };
  }
  return data;
};

export const createAccessToken = (user: User): Promise<string | undefined> => {
  return new Promise<string | undefined>((res, rej) => {
    sign(serializeUser(user, user), config.JWT_SECRET, {}, (err, token) => {
      if (err) rej(err);
      res(token);
    });
  });
};

export const verifyToken = (
  token: string | undefined
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
