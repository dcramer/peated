import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("PATCH /admin/oauth-clients/{clientId}", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(
      routerClient.admin.oauthClients.update(
        { clientId: "oauth_client", active: false },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates and deactivates a client", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const client = await fixtures.OAuthClient({ name: "Peated CLI" });

    const result = await routerClient.admin.oauthClients.update(
      {
        clientId: client.clientId,
        name: "Peated Local CLI",
        redirectUris: ["http://[::1]/oauth/callback"],
        active: false,
      },
      { context: { user: admin } },
    );

    expect(result).toMatchObject({
      clientId: client.clientId,
      name: "Peated Local CLI",
      redirectUris: ["http://[::1]/oauth/callback"],
      active: false,
    });
  });

  test("returns NOT_FOUND for an unknown client", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(
      routerClient.admin.oauthClients.update(
        { clientId: "oauth_client", active: false },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: OAuth client not found.]`);
  });
});
