import { createRouterClient } from "@orpc/server";
import {
  mockAccessToken,
  mockBottle,
  mockEntity,
  mockPublicUserDetails,
  mockUser,
  mockUserDetails,
} from "./fixtures";
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

    const search = await anonymousClient.search({
      query: "Lagavulin",
      scopes: ["bottles", "distillers"],
    });
    expect(search.exact).toEqual({ type: "entity", ref: mockEntity });
    expect(search.groups).toMatchObject([
      { type: "bottles", total: 1, results: [mockBottle] },
      { type: "distillers", total: 1, results: [mockEntity] },
    ]);

    const user = await authenticatedClient.users.details({ user: "me" });
    expect(user.id).toBe(mockUser.id);
  });

  it("returns no results when the fixed data does not match", async () => {
    const results = await anonymousClient.search({
      query: "Ardbeg",
      scopes: ["bottles", "distillers", "members"],
    });

    expect(results).toEqual({
      query: "Ardbeg",
      exact: null,
      groups: [
        { type: "bottles", total: 0, results: [] },
        { type: "distillers", total: 0, results: [] },
      ],
      scopeTotals: {
        bottles: 1,
        distillers: 1,
        brands: 1,
        bottlers: 0,
        blenders: 0,
        companies: 0,
        regions: 0,
      },
      nearest: [],
    });
  });

  it("shows member search results only after sign-in", async () => {
    const anonymousResults = await anonymousClient.search({
      query: mockUser.username,
      scopes: ["members"],
    });
    expect(anonymousResults.groups).toEqual([]);
    expect(anonymousResults.scopeTotals.members).toBeUndefined();

    await expect(
      authenticatedClient.search({
        query: mockUser.username,
        scopes: ["members"],
      }),
    ).resolves.toMatchObject({
      groups: [
        {
          type: "members",
          total: 1,
          results: [
            {
              member: mockUser,
              totalTastings: mockUserDetails.stats.tastings,
            },
          ],
        },
      ],
      scopeTotals: {
        members: 1,
      },
    });
  });

  it("returns viewer-specific bottle data", async () => {
    const anonymousBottle = await anonymousClient.bottles.details({
      bottle: mockBottle.id,
    });
    expect(anonymousBottle).toMatchObject({
      isFavorite: false,
      isLibrary: false,
      hasTasted: false,
    });

    const authenticatedBottle = await authenticatedClient.bottles.details({
      bottle: mockBottle.id,
    });
    expect(authenticatedBottle).toMatchObject({
      isFavorite: true,
      isLibrary: true,
      hasTasted: true,
    });
  });

  it("requires sign-in for followed bottles", async () => {
    await expect(
      anonymousClient.bottles.list({ filter: "following" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await expect(
      authenticatedClient.bottles.list({ filter: "following" }),
    ).resolves.toMatchObject({
      followedDistillerCount: 1,
    });
  });

  it("keeps self-only user fields out of public profiles", async () => {
    await expect(
      anonymousClient.users.details({ user: mockUser.username }),
    ).resolves.toEqual(mockPublicUserDetails);

    await expect(
      authenticatedClient.users.details({ user: "me" }),
    ).resolves.toEqual(expect.objectContaining({ email: mockUser.email }));
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
