import { sign, verify } from "jsonwebtoken";
import config from "../config";
import { User } from "@prisma/client";

interface AccessToken {
  id: string;
  admin: boolean;
  displayName: string | null;
  email: string;
  pictureUrl: string;
}

export const createAccessToken = (user: User): Promise<string | undefined> => {
  return new Promise<string | undefined>((res, rej) => {
    sign(
      {
        id: `${user.id}`,
        admin: user.admin,
        displayName: user.displayName,
        email: user.email,
        pictureUrl: user.pictureUrl,
      } as AccessToken,
      config.JWT_SECRET,
      {},
      (err, token) => {
        if (err) rej(err);
        res(token);
      }
    );
  });
};

export const verifyToken = (
  token: string | undefined
): Promise<AccessToken | undefined> => {
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
      res(decoded as AccessToken);
    });
  });
};
