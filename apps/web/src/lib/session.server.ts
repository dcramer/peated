import { type User } from "@peated/server/types";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { logWarn } from "./log";

if (!process.env.SESSION_SECRET) {
  logWarn("SESSION_SECRET is not defined", {});
}

export interface SessionData {
  user: User | null;
  accessToken: string | null;
  ts: number | null;
}

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

const AccessTokenClaimsSchema = z.object({ exp: z.number() });

/** Reads the `exp` claim (seconds) of a JWT access token, or null when the token has none. */
function getAccessTokenExpiry(accessToken: string): number | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const parsed = AccessTokenClaimsSchema.safeParse(claims);
  return parsed.success ? parsed.data.exp : null;
}

/**
 * Whether the session's access token can still sign API requests. The API
 * owns token checks; the web only reads `exp` so it stops claiming a signed-in
 * user once the token has run out. A token without a readable `exp` is left
 * for the API to accept or reject.
 */
function hasCurrentAccessToken(accessToken: string | null, now: number) {
  if (!accessToken) return false;
  const expiry = getAccessTokenExpiry(accessToken);
  return expiry === null || expiry > now / 1000;
}

export async function getSession() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  // Account access rule: the web is signed in only while its API token is.
  // Saving the cookie extends its lifetime but never the token's, so drop
  // the signed-in user here. Server components cannot write cookies; the
  // stale cookie stays inert until the next sign-in or sign-out replaces it.
  if (
    (session.user || session.accessToken) &&
    !hasCurrentAccessToken(session.accessToken, Date.now())
  ) {
    session.user = null;
    session.accessToken = null;
  }

  return session;
}
