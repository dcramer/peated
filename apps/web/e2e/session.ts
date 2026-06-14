import type { BrowserContext } from "@playwright/test";
import { sealData } from "iron-session";

import { testAccessToken, testUser } from "./rpc-fixtures.mjs";

export const sessionSecret =
  process.env.SESSION_SECRET ??
  "peated-playwright-session-secret-for-local-browser-tests";

/**
 * Seal a local iron-session cookie for e2e tests. Token/user overrides let
 * specs isolate mock API state while exercising the real session reader.
 */
export async function signIn(
  context: BrowserContext,
  {
    accessToken = testAccessToken,
    user = testUser,
  }: { accessToken?: string; user?: typeof testUser } = {},
) {
  const value = await sealData(
    {
      user,
      accessToken,
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
