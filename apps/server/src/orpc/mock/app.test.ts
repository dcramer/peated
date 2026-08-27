import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { mockApp } from "./app";
import { mockAccessToken, mockStats } from "./fixtures";
import type { mockRouter } from "./router";

function createMockClient(accessToken?: string) {
  const link = new RPCLink({
    url: "http://mock.local/rpc",
    headers: accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : undefined,
    fetch: async (request) => mockApp.fetch(request),
  });

  // SAFETY: The client and test server use the same mock router.
  return createORPCClient(link) as RouterClient<typeof mockRouter>;
}

describe("mock API over HTTP", () => {
  it("handles requests before and after sign-in", async () => {
    const anonymousClient = createMockClient();
    await expect(anonymousClient.stats()).resolves.toEqual(mockStats);

    const session = await anonymousClient.auth.login({
      email: "qa@example.com",
      password: "anything",
    });
    expect(session.accessToken).toBe(mockAccessToken);

    const authenticatedClient = createMockClient(session.accessToken);
    await expect(
      authenticatedClient.notifications.list({ filter: "unread" }),
    ).resolves.toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({ read: false }),
      ]),
    });
  });

  it("exposes a health check", async () => {
    const response = await mockApp.request("/_health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("serves local images", async () => {
    const response = await mockApp.request(
      "/_assets/cairdeas-warehouse-1.webp",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);

    await expect(
      mockApp.request("/_assets/missing.webp"),
    ).resolves.toMatchObject({ status: 404 });
  });
});
