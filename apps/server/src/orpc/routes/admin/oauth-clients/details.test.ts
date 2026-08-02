import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /admin/oauth-clients/{clientId}", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(
      routerClient.admin.oauthClients.details(
        { clientId: "oauth_client" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns a registered client", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const client = await fixtures.OAuthClient({ name: "Peated CLI" });

    const result = await routerClient.admin.oauthClients.details(
      { clientId: client.clientId },
      { context: { user: admin } },
    );

    expect(result).toMatchObject({
      clientId: client.clientId,
      name: client.name,
      redirectUris: client.redirectUris,
      active: true,
    });
  });

  test("returns NOT_FOUND for an unknown client", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(
      routerClient.admin.oauthClients.details(
        { clientId: "oauth_client" },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: OAuth client not found.]`);
  });
});
