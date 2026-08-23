import { describe, expect, test } from "vitest";
import {
  getOAuthClientFormDefaults,
  OAuthClientFormSchema,
  parseOAuthClientRedirectUris,
} from "./oauthClientForm";

describe("OAuthClientForm", () => {
  test("parses and validates one registered redirect per line", () => {
    const redirectUris = parseOAuthClientRedirectUris(
      "http://127.0.0.1/callback\n\nhttps://tools.peated.com/callback",
    );

    expect(redirectUris).toEqual([
      "http://127.0.0.1/callback",
      "https://tools.peated.com/callback",
    ]);
    expect(
      OAuthClientFormSchema.safeParse({
        name: "Peated CLI",
        redirectUris: redirectUris.join("\n"),
      }).success,
    ).toBe(true);
    expect(
      OAuthClientFormSchema.safeParse({
        name: "Peated CLI",
        redirectUris: "http://localhost/callback",
      }).success,
    ).toBe(false);
  });

  test("uses empty registration defaults and serialized editing defaults", () => {
    expect(getOAuthClientFormDefaults()).toEqual({
      name: "",
      redirectUris: "",
    });
    expect(
      getOAuthClientFormDefaults({
        clientId: "public-client-id",
        name: "Peated CLI",
        redirectUris: [
          "http://127.0.0.1/callback",
          "https://tools.peated.com/callback",
        ],
      }),
    ).toEqual({
      name: "Peated CLI",
      redirectUris:
        "http://127.0.0.1/callback\nhttps://tools.peated.com/callback",
    });
  });
});
