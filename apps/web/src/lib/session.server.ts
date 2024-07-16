import { type User } from "@peated/server/src/types";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not defined.");
}

export interface SessionData {
  user: User | null;
  accessToken: string | null;
}

export const defaultSession: SessionData = {
  user: null,
  accessToken: null,
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "", // TODO: this should error out
  cookieName: "_session",
  cookieOptions: {
    // secure only works in `https` environments
    // if your localhost is not on `https`, then use: `secure: process.env.NODE_ENV === "production"`
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // enable this in prod only
  },
};

export async function getSession() {
  return await getIronSession<SessionData>(cookies(), sessionOptions);
}
