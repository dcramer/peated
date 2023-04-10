// import { User } from "@prisma/client";
import { sign, verify } from "jsonwebtoken";
import config from "../config";

interface AccessToken {
  id: string;
  admin: boolean;
}

export const createAccessToken = (
  data: AccessToken
): Promise<string | undefined> => {
  return new Promise<string | undefined>((res, rej) => {
    sign(data, config.JWT_SECRET, {}, (err, token) => {
      if (err) rej(err);
      res(token);
    });
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
