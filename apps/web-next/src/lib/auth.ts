import { type User } from "@peated/server/src/types";
import { type SessionOptions } from "iron-session";

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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// export async function getSession(request: Request | ExpressRequest) {
//   const cookie =
//     "get" in request
//       ? request.get("Cookie")
//       : (request as Request).headers.get("Cookie");
//   return await sessionStorage.getSession(cookie);
// }

// export async function getUser(
//   session: Session<SessionPayload, SessionPayload>,
// ) {
//   return session.get("user");
// }

// export async function getAccessToken(
//   session: Session<SessionPayload, SessionPayload>,
// ) {
//   return session.get("accessToken");
// }

// export async function createSession({
//   request,
//   session,
//   remember = true,
//   redirectTo = "/",
// }: {
//   request: Request;
//   session: SessionPayload;
//   remember?: boolean;
//   redirectTo?: string | null;
// }) {
//   const s = await getSession(request);
//   s.set("user", session.user);
//   s.set("accessToken", session.accessToken);

//   return redirectDocument(getSafeRedirect(redirectTo), {
//     headers: {
//       "Set-Cookie": await sessionStorage.commitSession(s, {
//         maxAge: remember
//           ? 60 * 60 * 24 * 7 // 7 days
//           : undefined,
//       }),
//     },
//   });
// }

// export async function logout(request: Request | ExpressRequest) {
//   const s = await getSession(request);
//   return redirectDocument("/", {
//     headers: {
//       "Set-Cookie": await sessionStorage.destroySession(s),
//     },
//   });
// }

// function getSafeRedirect(value: string | null) {
//   if (!value || value?.indexOf("/") !== 0 || value?.indexOf("//") === 0)
//     return "/";
//   return value;
// }
