import type { User } from "@peated/server/types";
import { useSession } from "@tanstack/react-start/server";

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

export function useAppSession() {
  return useSession<SessionData>({
    password: process.env.SESSION_SECRET || "", // TODO: this should error out
    // cookieName: "_session",
    cookie: {
      // secure only works in `https` environments
      // if your localhost is not on `https`, then use: `secure: process.env.NODE_ENV === "production"`
      sameSite: "lax",
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // enable this in prod only
    },
  });
}
