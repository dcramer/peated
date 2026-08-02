import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("POST /admin/oauth-clients", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(
      routerClient.admin.oauthClients.create(
        {
          name: "Peated CLI",
          redirectUris: ["http://127.0.0.1/callback"],
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("registers an active public client", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const first = await routerClient.admin.oauthClients.create(
      {
        name: "Peated CLI",
        redirectUris: ["http://127.0.0.1/callback"],
      },
      { context: { user: admin } },
    );
    const second = await routerClient.admin.oauthClients.create(
      {
        name: "Data Cleanup Tool",
        redirectUris: ["https://tools.peated.com/oauth/callback"],
      },
      { context: { user: admin } },
    );

    expect(first).toMatchObject({
      name: "Peated CLI",
      redirectUris: ["http://127.0.0.1/callback"],
      active: true,
    });
    expect(first.clientId).not.toEqual(second.clientId);
  });

  test("rejects unsafe redirect URIs", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    for (const redirectUri of [
      "http://example.com/callback",
      "http://localhost/callback",
      "https://*.example.com/callback",
      "https://user@example.com/callback",
      "https://@example.com/callback",
      "https://example.com/callback#fragment",
      "https://example.com/callback#",
    ]) {
      const error = await waitError(
        routerClient.admin.oauthClients.create(
          { name: "Unsafe client", redirectUris: [redirectUri] },
          { context: { user: admin } },
        ),
      );

      expect(error, redirectUri).toBeDefined();
    }
  });
});
