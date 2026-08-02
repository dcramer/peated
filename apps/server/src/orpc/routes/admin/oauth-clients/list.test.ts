import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /admin/oauth-clients", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(
      routerClient.admin.oauthClients.list(
        {},
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists clients by name", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const second = await fixtures.OAuthClient({ name: "Peated CLI" });
    const first = await fixtures.OAuthClient({ name: "Data Cleanup Tool" });

    const { results } = await routerClient.admin.oauthClients.list(
      {},
      { context: { user: admin } },
    );

    expect(results.map((client) => client.clientId)).toEqual([
      first.clientId,
      second.clientId,
    ]);
  });
});
