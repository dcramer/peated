import { ORPCError } from "@orpc/client";
import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  approveOAuthAuthorizationWith,
  denyOAuthAuthorizationWith,
  type OAuthAuthorizationOperations,
} from "./authorizationOperations";

const authorize = vi.fn<OAuthAuthorizationOperations["authorize"]>();
const validate = vi.fn<OAuthAuthorizationOperations["validate"]>();
const redirect = vi.fn<OAuthAuthorizationOperations["redirect"]>();
const refreshSession = vi.fn<OAuthAuthorizationOperations["refreshSession"]>();

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

const authorizationFields = {
  response_type: "code",
  client_id: "peated-cli",
  redirect_uri: "http://127.0.0.1:45678/callback",
  state: "opaque-state",
  code_challenge: createS256CodeChallenge(verifier),
  code_challenge_method: "S256",
};

function authorizationFormData() {
  const formData = new FormData();
  for (const [name, value] of Object.entries(authorizationFields)) {
    formData.set(name, value);
  }
  return formData;
}

beforeEach(() => {
  authorize.mockReset();
  validate.mockReset();
  redirect.mockReset();
  refreshSession.mockReset();
});

const authorizeRequestPath = `/oauth/authorize?${new URLSearchParams(authorizationFields)}`;

describe("OAuth authorization actions", () => {
  test("approves through the authenticated API and preserves state", async () => {
    authorize.mockResolvedValue({
      code: "authorization-code",
      redirectUri: "http://127.0.0.1:45678/callback",
      state: "opaque-state",
    });

    await approveOAuthAuthorizationWith(authorizationFormData(), {
      authorize,
      redirect,
      refreshSession,
    });

    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "peated-cli",
        state: "opaque-state",
      }),
    );
    expect(redirect).toHaveBeenCalledWith(
      "http://127.0.0.1:45678/callback?code=authorization-code&state=opaque-state",
    );
  });

  test("revalidates before redirecting a denial", async () => {
    validate.mockResolvedValue({
      clientId: "peated-cli",
      name: "Peated CLI",
    });

    await denyOAuthAuthorizationWith(authorizationFormData(), {
      validate,
      redirect,
    });

    expect(validate).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith(
      "http://127.0.0.1:45678/callback?error=access_denied&state=opaque-state",
    );
  });

  test("sends an expired or rejected session to sign in and back to the same request", async () => {
    authorize.mockRejectedValue(
      new ORPCError("UNAUTHORIZED", { defined: true, status: 401 }),
    );
    refreshSession.mockResolvedValue({ user: null, accessToken: null });

    await approveOAuthAuthorizationWith(authorizationFormData(), {
      authorize,
      redirect,
      refreshSession,
    });

    expect(refreshSession).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith(
      `/login?redirectTo=${encodeURIComponent(authorizeRequestPath)}`,
    );
  });

  test("sends a suspended member to the suspension screen", async () => {
    authorize.mockRejectedValue(
      new ORPCError("ACCOUNT_SUSPENDED", { defined: true, status: 403 }),
    );
    refreshSession.mockResolvedValue({
      user: { suspendedAt: "2026-11-09T00:00:00Z" },
      accessToken: "access-token",
    });

    await approveOAuthAuthorizationWith(authorizationFormData(), {
      authorize,
      redirect,
      refreshSession,
    });

    expect(redirect).toHaveBeenCalledWith("/auth/suspended");
  });

  test("raises the API error when the session still works after a refresh", async () => {
    const error = new ORPCError("UNAUTHORIZED", {
      defined: true,
      status: 401,
    });
    authorize.mockRejectedValue(error);
    refreshSession.mockResolvedValue({ user: {}, accessToken: "access-token" });

    await expect(
      approveOAuthAuthorizationWith(authorizationFormData(), {
        authorize,
        redirect,
        refreshSession,
      }),
    ).rejects.toBe(error);
    expect(redirect).not.toHaveBeenCalled();
  });
});
