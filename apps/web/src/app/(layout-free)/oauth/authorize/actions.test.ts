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
  authorize.mockReset();
  validate.mockReset();
  redirect.mockReset();
});

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
});
