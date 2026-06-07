import type { BrowserContext } from "@playwright/test";
import { sealData } from "iron-session";

import { testAccessToken, testUser } from "./rpc-fixtures.mjs";

export const sessionSecret =
  process.env.SESSION_SECRET ??
  "peated-playwright-session-secret-for-local-browser-tests";

export async function signIn(context: BrowserContext) {
  const value = await sealData(
    {
      user: testUser,
      accessToken: testAccessToken,
      ts: Date.now(),
    },
    {
      password: sessionSecret,
      ttl: 60 * 60 * 24 * 7,
    },
  );

  await context.addCookies([
    {
      name: "_session",
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
