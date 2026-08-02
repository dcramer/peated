import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import { describe, expect, test } from "vitest";
import {
  oauthAuthorizationSearchParams,
  oauthCallbackUrl,
  parseOAuthAuthorizationQuery,
} from "./oauth";

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

function query(overrides: Record<string, unknown> = {}) {
  return {
    response_type: "code",
    client_id: "peated-cli",
    redirect_uri: "http://127.0.0.1:45678/callback",
    state: "opaque-state",
    code_challenge: createS256CodeChallenge(verifier),
    code_challenge_method: "S256",
    ...overrides,
  };
}

describe("OAuth authorization query", () => {
  test("parses and round-trips the supported request", () => {
    const parsed = parseOAuthAuthorizationQuery(query());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.state).toBe("opaque-state");
    expect(
      Object.fromEntries(oauthAuthorizationSearchParams(parsed.data)),
    ).toEqual(query());
  });

  test("rejects duplicate values and unsupported PKCE methods", () => {
    expect(
      parseOAuthAuthorizationQuery(query({ state: ["one", "two"] })).success,
    ).toBe(false);
    expect(
      parseOAuthAuthorizationQuery(query({ code_challenge_method: "plain" }))
        .success,
    ).toBe(false);
  });

  test("adds OAuth results without dropping registered query values", () => {
    expect(
      oauthCallbackUrl("http://127.0.0.1:45678/callback?source=cli", {
        code: "authorization-code",
        state: "opaque-state",
      }),
    ).toBe(
      "http://127.0.0.1:45678/callback?source=cli&code=authorization-code&state=opaque-state",
    );

    expect(
      oauthCallbackUrl(
        "https://client.example/callback?return=%2Ffoo%20bar&sig=a%2fb",
        {
          code: "authorization/code",
          state: "opaque state",
        },
      ),
    ).toBe(
      "https://client.example/callback?return=%2Ffoo%20bar&sig=a%2fb&code=authorization%2Fcode&state=opaque+state",
    );
  });
});
