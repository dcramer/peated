import { createRouterClient } from "@orpc/server";
import { mockAccessToken, mockBottle, mockUser } from "./fixtures";
import { mockRouter } from "./router";

const anonymousClient = createRouterClient(mockRouter, {
  context: { user: null },
});
const authenticatedClient = createRouterClient(mockRouter, {
  context: { user: mockUser },
});

describe("mock oRPC router", () => {
  it("returns fixture data from supported routes", async () => {
    await expect(anonymousClient.root()).resolves.toEqual({ version: "mock" });

    await expect(anonymousClient.activity.list({})).resolves.toEqual({
      results: [],
      rel: { nextCursor: null, prevCursor: null },
    });

    const bottles = await anonymousClient.bottles.list({ query: "Lagavulin" });
    expect(bottles.results).toEqual([mockBottle]);

    const user = await authenticatedClient.users.details({ user: "me" });
    expect(user.id).toBe(mockUser.id);
  });

  it("returns no results when the fixed data does not match", async () => {
    const results = await anonymousClient.search({
      query: "Ardbeg",
      include: ["bottles", "entities", "users"],
    });

    expect(results).toEqual({ query: "Ardbeg", results: [] });
  });

  it("shows user search results only after sign-in", async () => {
    await expect(
      anonymousClient.search({
        query: mockUser.username,
        include: ["users"],
      }),
    ).resolves.toEqual({
      query: mockUser.username,
      results: [],
    });
    await expect(
      authenticatedClient.search({
        query: mockUser.username,
        include: ["users"],
      }),
    ).resolves.toEqual({
      query: mockUser.username,
      results: [{ type: "user", ref: mockUser }],
    });
  });

  it("returns the route's not-found error for unknown records", async () => {
    await expect(
      anonymousClient.bottles.details({ bottle: 9999 }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Mock bottle not found.",
    });
  });

  it("signs in without saving anything", async () => {
    const result = await anonymousClient.auth.login({
      email: "qa@example.com",
      password: "anything",
    });

    expect(result).toEqual({
      user: mockUser,
      accessToken: mockAccessToken,
    });
  });
});
