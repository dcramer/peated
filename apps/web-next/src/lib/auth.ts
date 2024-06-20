import { type User } from "@peated/server/src/types";
import { type SessionOptions } from "iron-session";
import { redirect } from "next/navigation";

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

export function getSafeRedirect(value: string | null) {
  if (!value || value?.indexOf("/") !== 0 || value?.indexOf("//") === 0)
    return "/";
  return value;
}

export function redirectToAuth({
  pathname = "/",
  search = "",
}: {
  pathname?: string;
  search?: string;
}) {
  return redirect(getAuthRedirect({ pathname, search }));
}

export function getAuthRedirect({
  pathname = "/",
  search = "",
}: {
  pathname?: string;
  search?: string;
}) {
  const redirectTo = pathname + search;

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
