import { type User } from "@peated/server/types";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not defined.");
}

export interface SessionData {
  user: User | null;
  accessToken: string | null;
  ts: number | null;
}

export const defaultSession: SessionData = {
  user: null,
  accessToken: null,
  ts: null,
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "", // TODO: this should error out
  cookieName: "_session",
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    // secure only works in `https` environments
    // if your localhost is not on `https`, then use: `secure: process.env.NODE_ENV === "production"`
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // enable this in prod only
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  return await getIronSession<SessionData>(cookies(), sessionOptions);
}
