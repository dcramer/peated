import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  authorizationDetails: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@peated/web/lib/orpc/client.server", () => ({
  createServerClient: async () => ({
    client: { oauth: { authorize: mocks.authorize } },
  }),
  createAnonymousServerClient: async () => ({
    client: {
      oauth: { authorizationDetails: mocks.authorizationDetails },
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { approveOAuthAuthorization, denyOAuthAuthorization } from "./actions";

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

function authorizationFormData() {
  const formData = new FormData();
  formData.set("response_type", "code");
  formData.set("client_id", "peated-cli");
  formData.set("redirect_uri", "http://127.0.0.1:45678/callback");
  formData.set("state", "opaque-state");
  formData.set("code_challenge", createS256CodeChallenge(verifier));
  formData.set("code_challenge_method", "S256");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OAuth authorization actions", () => {
  test("approves through the authenticated API and preserves state", async () => {
    mocks.authorize.mockResolvedValue({
      code: "authorization-code",
      redirectUri: "http://127.0.0.1:45678/callback",
      state: "opaque-state",
    });

    await approveOAuthAuthorization(authorizationFormData());

    expect(mocks.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "peated-cli",
        state: "opaque-state",
      }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith(
      "http://127.0.0.1:45678/callback?code=authorization-code&state=opaque-state",
    );
  });

  test("revalidates before redirecting a denial", async () => {
    mocks.authorizationDetails.mockResolvedValue({
      clientId: "peated-cli",
      name: "Peated CLI",
    });

    await denyOAuthAuthorization(authorizationFormData());

    expect(mocks.authorizationDetails).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith(
      "http://127.0.0.1:45678/callback?error=access_denied&state=opaque-state",
    );
  });
});
