import { createRouterClient } from "@orpc/server";
import { mockBottle, mockUser } from "./fixtures";
import { mockRouter } from "./router";

const client = createRouterClient(mockRouter, { context: {} });

describe("mock oRPC router", () => {
  it("returns fixture data from supported routes", async () => {
    await expect(client.root()).resolves.toEqual({ version: "mock" });

    await expect(client.activity.list({})).resolves.toEqual({
      results: [],
      rel: { nextCursor: null, prevCursor: null },
    });

    const bottles = await client.bottles.list({ query: "Lagavulin" });
    expect(bottles.results).toEqual([mockBottle]);

    const user = await client.users.details({ user: "me" });
    expect(user.id).toBe(mockUser.id);
  });

  it("returns no results when the fixed data does not match", async () => {
    const results = await client.search({
      query: "Ardbeg",
      include: ["bottles", "entities", "users"],
    });

    expect(results).toEqual({ query: "Ardbeg", results: [] });
  });

  it("returns the route's not-found error for unknown records", async () => {
    await expect(
      client.bottles.details({ bottle: 9999 }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Mock bottle not found.",
    });
  });

  it("signs in without saving anything", async () => {
    const result = await client.auth.login({
      email: "qa@example.com",
      password: "anything",
    });

    expect(result).toEqual({
      user: mockUser,
      accessToken: "peated-mock-access-token",
    });
  });
});
