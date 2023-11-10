import type { Session } from "@remix-run/node";
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import type { Request as ExpressRequest } from "express";
import invariant from "tiny-invariant";
import type { SessionPayload } from "~/types";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: [process.env.SESSION_SECRET], // replace this with an actual secret
    secure: process.env.NODE_ENV === "production", // enable this in prod only
  },
});

export async function getSession(request: Request | ExpressRequest) {
  const cookie =
    "get" in request
      ? request.get("Cookie")
      : (request as Request).headers.get("Cookie");
  return await sessionStorage.getSession(cookie);
}

export async function getUser(
  session: Session<SessionPayload, SessionPayload>,
) {
  return session.get("user");
}

export async function getAccessToken(
  session: Session<SessionPayload, SessionPayload>,
) {
  return session.get("accessToken");
}

export async function createSession({
  request,
  session,
  remember = true,
  redirectTo = "/",
}: {
  request: Request;
  session: SessionPayload;
  remember?: boolean;
  redirectTo?: string | null;
}) {
  const s = await getSession(request);
  s.set("user", session.user);
  s.set("accessToken", session.accessToken);

  return redirect(
    !session.user.pictureUrl ? "/settings" : getSafeRedirect(redirectTo),
    {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(s, {
          maxAge: remember
            ? 60 * 60 * 24 * 7 // 7 days
            : undefined,
        }),
      },
    },
  );
}

export async function logout(request: Request | ExpressRequest) {
  const s = await getSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(s),
    },
  });
}

function getSafeRedirect(value: string | null) {
  if (!value || value?.indexOf("/") !== 0 || value?.indexOf("//") === 0)
    return "/";
  return value;
}
