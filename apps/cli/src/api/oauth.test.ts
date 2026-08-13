import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { authorizeWithOAuth } from "./oauth";

describe("authorizeWithOAuth", () => {
  test("completes PKCE through a loopback callback and exchanges the code", async () => {
    const now = Date.parse("2026-08-12T00:00:00.000Z");
    let authorizationUrl: URL | undefined;
    const tokenFetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      expect(init?.body).toBeInstanceOf(URLSearchParams);
      const tokenRequest = init?.body as URLSearchParams;
      const verifier = tokenRequest.get("code_verifier") ?? "";
      expect(tokenRequest.get("code")).toBe("authorization-code");
      expect(tokenRequest.get("redirect_uri")).toBe(
        authorizationUrl?.searchParams.get("redirect_uri"),
      );
      expect(createHash("sha256").update(verifier).digest("base64url")).toBe(
        authorizationUrl?.searchParams.get("code_challenge"),
      );
      return Response.json({
        access_token: "secret-token",
        token_type: "Bearer",
        expires_in: 604800,
      });
    });

    const credentials = await authorizeWithOAuth({
      apiServer: "https://api.peated.com",
      webServer: "https://peated.com",
      clientId: "peated-cli",
      now: () => now,
      fetch: tokenFetch,
      onAuthorize: async (url) => {
        authorizationUrl = new URL(url);
        const redirectUri = authorizationUrl.searchParams.get("redirect_uri");
        const state = authorizationUrl.searchParams.get("state");
        expect(redirectUri).toMatch(
          /^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/,
        );
        expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
          "S256",
        );
        const invalidCallback = new URL(redirectUri!);
        invalidCallback.search = new URLSearchParams({
          code: "attacker-code",
          state: "wrong-state",
        }).toString();
        expect((await globalThis.fetch(invalidCallback)).status).toBe(400);

        const callback = new URL(redirectUri!);
        callback.search = new URLSearchParams({
          code: "authorization-code",
          state: state!,
        }).toString();
        const callbackResponse = await globalThis.fetch(callback);
        expect(callbackResponse.status).toBe(200);
        expect(callbackResponse.headers.get("connection")).toBe("close");
      },
    });

    expect(credentials).toEqual({
      accessToken: "secret-token",
      apiServer: "https://api.peated.com",
      clientId: "peated-cli",
      expiresAt: "2026-08-19T00:00:00.000Z",
    });
    expect(tokenFetch).toHaveBeenCalledOnce();
    expect(tokenFetch.mock.calls[0][0]).toBeInstanceOf(URL);
    expect((tokenFetch.mock.calls[0][0] as URL).href).toBe(
      "https://api.peated.com/oauth/token",
    );
  });

  test("rejects a denied authorization without exchanging a token", async () => {
    const tokenFetch = vi.fn<typeof globalThis.fetch>();

    await expect(
      authorizeWithOAuth({
        apiServer: "https://api.peated.com",
        webServer: "https://peated.com",
        clientId: "peated-cli",
        fetch: tokenFetch,
        onAuthorize: async (url) => {
          const authorizationUrl = new URL(url);
          const callback = new URL(
            authorizationUrl.searchParams.get("redirect_uri")!,
          );
          callback.search = new URLSearchParams({
            error: "access_denied",
            state: authorizationUrl.searchParams.get("state")!,
          }).toString();
          expect((await globalThis.fetch(callback)).status).toBe(400);
        },
      }),
    ).rejects.toThrow("Peated authorization failed: access_denied");
    expect(tokenFetch).not.toHaveBeenCalled();
  });
});
