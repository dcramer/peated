import { UserSchema } from "@peated/server/schemas";
import { describe, expect, it, vi } from "vitest";
import { testUser } from "../../e2e/rpc-fixtures.mjs";
import { getSession, type SessionData } from "./session.server";
import { withNextRequest } from "./test/nextRequest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage);
  vi.stubEnv("SESSION_SECRET", "peated-session-tests-session-secret-for-local");
});

/** An access token shaped like the API's JWT; the web only reads `exp`. */
const user = UserSchema.parse(testUser);

function accessTokenExpiringAt(exp: number) {
  const part = (value: Record<string, string | number>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ id: 1, aud: "access", exp })}.signature`;
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function readSession(session: Partial<SessionData>) {
  return await withNextRequest(session, async () => {
    const { user, accessToken } = await getSession();
    return { user, accessToken };
  });
}

describe("getSession", () => {
  it("keeps a member signed in while their access token is current", async () => {
    const accessToken = accessTokenExpiringAt(nowInSeconds() + 60 * 60);

    expect(await readSession({ user, accessToken, ts: 1 })).toEqual({
      user,
      accessToken,
    });
  });

  it("signs a member out once their access token has expired", async () => {
    const accessToken = accessTokenExpiringAt(nowInSeconds() - 1);

    expect(
      await readSession({ user, accessToken, ts: nowInSeconds() }),
    ).toEqual({ user: null, accessToken: null });
  });

  it("signs a member out when the session has no access token", async () => {
    expect(await readSession({ user, accessToken: null, ts: 1 })).toEqual({
      user: null,
      accessToken: null,
    });
  });
});
