// import { User } from "@prisma/client";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import config from "../config";

export const createAccessToken = (data: any): Promise<string | undefined> => {
  return new Promise<string | undefined>((res, rej) => {
    sign(data, config.JWT_SECRET, {}, (err, token) => {
      if (err) rej(err);
      res(token);
    });
  });
};

export const verifyToken = (
  token: string | undefined
): Promise<string | JwtPayload | undefined> => {
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
      res(decoded);
    });
  });
};
