import { createRouterClient } from "@orpc/server";
import {
  mockAccessToken,
  mockBadgeAward,
  mockBottle,
  mockBottleTags,
  mockCollectionBottle,
  mockComment,
  mockCountry,
  mockEntity,
  mockEntityCatalog,
  mockFlight,
  mockPublicUserDetails,
  mockRegion,
  mockReview,
  mockTasting,
  mockUser,
  mockUserDetails,
  mockUserFlavorList,
  mockUserLibraryStats,
  mockUserRegionList,
  mockUserTastingStats,
} from "./fixtures";
import { mockRouter } from "./router";

const anonymousClient = createRouterClient(mockRouter, {
  context: { user: null },
});
const authenticatedClient = createRouterClient(mockRouter, {
  context: { user: mockUser },
});

describe("mock oRPC router", () => {
  it("returns fixed data from supported routes", async () => {
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

  it("covers the main read-only page data", async () => {
    await expect(
      anonymousClient.entities.details({ entity: mockEntity.id }),
    ).resolves.toEqual(mockEntity);
    await expect(
      anonymousClient.countries.details({ country: mockCountry.slug }),
    ).resolves.toEqual(mockCountry);
    await expect(
      anonymousClient.regions.details({
        country: mockCountry.slug,
        region: mockRegion.slug,
      }),
    ).resolves.toEqual(mockRegion);
    await expect(
      anonymousClient.tastings.details({ tasting: mockTasting.id }),
    ).resolves.toEqual(mockTasting);

    const countries = await anonymousClient.countries.list({});
    expect(countries.results).toEqual([mockCountry]);

    const regions = await anonymousClient.regions.list({
      country: mockCountry.slug,
    });
    expect(regions.results).toEqual([mockRegion]);

    const tastings = await anonymousClient.tastings.list({
      bottle: mockBottle.id,
    });
    expect(tastings.results).toEqual([mockTasting]);

    const collection = await anonymousClient.collections.bottles.list({
      collection: "library",
      user: mockUser.username,
    });
    expect(collection.results).toEqual([
      {
        ...mockCollectionBottle,
        bottle: mockBottle,
        hasTasted: false,
      },
    ]);
  });

  it("completes bottle, entity, and tasting detail pages", async () => {
    await expect(
      anonymousClient.reviews.list({
        bottle: mockBottle.id,
        sort: "name",
      }),
    ).resolves.toMatchObject({ results: [mockReview] });

    await expect(
      anonymousClient.bottles.tags({ bottle: mockBottle.id }),
    ).resolves.toEqual(mockBottleTags);

    await expect(
      anonymousClient.entities.catalog({ entity: mockEntity.id }),
    ).resolves.toEqual(mockEntityCatalog);

    await expect(
      anonymousClient.comments.list({ tasting: mockTasting.id }),
    ).resolves.toMatchObject({ results: [mockComment] });
  });

  it("returns fixed user profile insights", async () => {
    const input = { user: mockUser.username };

    await expect(anonymousClient.users.badgeList(input)).resolves.toMatchObject(
      {
        results: [mockBadgeAward],
      },
    );
    await expect(anonymousClient.users.regionList(input)).resolves.toEqual(
      mockUserRegionList,
    );
    await expect(anonymousClient.users.flavorList(input)).resolves.toEqual(
      mockUserFlavorList,
    );
    await expect(anonymousClient.users.tastingStats(input)).resolves.toEqual(
      mockUserTastingStats,
    );
    await expect(anonymousClient.users.libraryStats(input)).resolves.toEqual(
      mockUserLibraryStats,
    );
  });

  it("supports fixed tasting flights", async () => {
    await expect(anonymousClient.flights.list({})).resolves.toMatchObject({
      results: [mockFlight],
    });
    await expect(
      anonymousClient.flights.list({ query: "Speyside" }),
    ).resolves.toMatchObject({ results: [] });

    await expect(
      anonymousClient.flights.details({ flight: mockFlight.id }),
    ).resolves.toMatchObject({
      bottles: [{ hasTasted: false, isLibrary: false }],
    });
    await expect(
      authenticatedClient.flights.details({ flight: mockFlight.id }),
    ).resolves.toMatchObject({
      bottles: [{ hasTasted: true, isLibrary: true }],
    });
  });

  it("keeps notification and review permissions", async () => {
    await expect(anonymousClient.notifications.count({})).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
    await expect(
      authenticatedClient.notifications.count({ filter: "unread" }),
    ).resolves.toEqual({ count: 3 });

    await expect(
      anonymousClient.reviews.list({ sort: "name" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Must be a moderator to list all reviews.",
    });
  });

  it("applies read-only filters without saving state", async () => {
    await expect(
      anonymousClient.countries.list({ query: "Japan" }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      anonymousClient.regions.list({
        country: mockCountry.slug,
        query: "Speyside",
      }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      anonymousClient.tastings.list({ bottle: 9999 }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      anonymousClient.collections.bottles.list({
        collection: "library",
        user: mockUser.username,
        status: "sealed",
      }),
    ).resolves.toMatchObject({ results: [] });
  });

  it("keeps signed-in read filters protected", async () => {
    await expect(
      anonymousClient.tastings.list({ filter: "friends" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonymousClient.collections.bottles.list({
        collection: "library",
        user: "me",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      authenticatedClient.collections.bottles.list({
        collection: "library",
        user: "me",
      }),
    ).resolves.toMatchObject({
      results: [
        {
          bottle: {
            isFavorite: true,
            isLibrary: true,
            hasTasted: true,
          },
          hasTasted: true,
        },
      ],
    });
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
