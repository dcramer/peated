import { type User } from "@peated/server/types";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set in production. Set it in the environment.",
    );
  } else {
    console.warn(
      "SESSION_SECRET is not defined; using insecure development secret.",
    );
  }
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
  password:
    SESSION_SECRET || "insecure-development-session-secret-do-not-use-in-prod",
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
