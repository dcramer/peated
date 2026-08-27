import { createRouterClient } from "@orpc/server";
import {
  mockAccessToken,
  mockActivity,
  mockBadgeAwards,
  mockBottle,
  mockBottles,
  mockBottleTags,
  mockCollectionBottles,
  mockCommentsByTasting,
  mockCountries,
  mockCountry,
  mockEntities,
  mockEntity,
  mockEntityCatalog,
  mockFlight,
  mockFlights,
  mockFriendDetails,
  mockFriends,
  mockPublicUserDetails,
  mockRegion,
  mockRegions,
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
const friendClient = createRouterClient(mockRouter, {
  context: { user: mockFriends[0]! },
});

describe("mock oRPC router", () => {
  it("returns fixed data from supported routes", async () => {
    await expect(anonymousClient.root()).resolves.toEqual({ version: "mock" });

    await expect(anonymousClient.activity.list({})).resolves.toEqual({
      results: mockActivity,
      rel: { nextCursor: null, prevCursor: null },
    });

    const bottles = await anonymousClient.bottles.list({ query: "Lagavulin" });
    expect(bottles.results).toHaveLength(3);
    expect(bottles.results.map((bottle) => bottle.brand.name)).toEqual([
      "Lagavulin",
      "Lagavulin",
      "Lagavulin",
    ]);

    const search = await anonymousClient.search({
      query: "Lagavulin",
      scopes: ["bottles", "distillers"],
    });
    expect(search.exact).toEqual({ type: "entity", ref: mockEntity });
    expect(search.groups).toMatchObject([
      { type: "bottles", total: 3 },
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
    expect(countries.results).toHaveLength(mockCountries.length);
    expect(countries.results.map((country) => country.slug)).toEqual([
      "india",
      "ireland",
      "japan",
      "scotland",
      "united-states",
    ]);

    const regions = await anonymousClient.regions.list({
      country: mockCountry.slug,
    });
    expect(regions.results).toHaveLength(4);
    expect(regions.results).toEqual(
      expect.arrayContaining(
        mockRegions.filter((region) => region.country.id === mockCountry.id),
      ),
    );

    const tastings = await anonymousClient.tastings.list({
      bottle: mockBottle.id,
    });
    expect(tastings.results).toEqual([mockTasting]);

    const collection = await anonymousClient.collections.bottles.list({
      collection: "library",
      user: mockUser.username,
    });
    expect(collection.results).toHaveLength(mockCollectionBottles.length);
    expect(new Set(collection.results.map((item) => item.status))).toEqual(
      new Set(["open", "sealed", "empty", null]),
    );
  });

  it("returns varied samples with stable pages", async () => {
    const bottles = await anonymousClient.bottles.list({
      sort: "name",
      limit: 100,
    });
    expect(bottles.results).toHaveLength(mockBottles.length);
    expect(new Set(bottles.results.map((bottle) => bottle.category)).size).toBe(
      3,
    );
    expect(
      new Set(bottles.results.map((bottle) => bottle.flavorProfile)).size,
    ).toBeGreaterThan(4);
    expect(
      new Set(bottles.results.map((bottle) => bottle.avgScore)).size,
    ).toBeGreaterThan(4);

    const firstPage = await anonymousClient.countries.list({ limit: 2 });
    expect(firstPage.results).toHaveLength(2);
    expect(firstPage.rel.nextCursor).toBe(2);

    const secondPage = await anonymousClient.countries.list({
      cursor: firstPage.rel.nextCursor!,
      limit: 2,
    });
    expect(secondPage.results).toHaveLength(2);
    expect(secondPage.rel.prevCursor).toBe(1);
    expect(secondPage.results).not.toEqual(firstPage.results);
  });

  it("opens detail routes for varied list results", async () => {
    const japan = mockCountries.find((country) => country.slug === "japan")!;
    const kentucky = mockRegions.find((region) => region.slug === "kentucky")!;
    const yamazaki = mockBottles.find(
      (bottle) => bottle.brand.name === "Yamazaki",
    )!;

    await expect(
      anonymousClient.countries.details({ country: japan.slug }),
    ).resolves.toEqual(japan);
    await expect(
      anonymousClient.regions.details({
        country: kentucky.country.slug,
        region: kentucky.slug,
      }),
    ).resolves.toEqual(kentucky);
    await expect(
      anonymousClient.entities.details({ entity: yamazaki.brand.id }),
    ).resolves.toEqual(yamazaki.brand);
    await expect(
      anonymousClient.bottles.details({ bottle: yamazaki.id }),
    ).resolves.toMatchObject({ id: yamazaki.id, fullName: yamazaki.fullName });
    await expect(
      anonymousClient.users.details({ user: mockFriends[0]!.username }),
    ).resolves.toEqual(mockFriendDetails[0]);
    await expect(
      anonymousClient.flights.details({ flight: mockFlights[1]!.id }),
    ).resolves.toMatchObject({
      id: mockFlights[1]!.id,
      bottles: expect.arrayContaining([
        expect.objectContaining({
          bottle: expect.objectContaining({ id: yamazaki.id }),
        }),
      ]),
    });
  });

  it("completes bottle, entity, and tasting detail pages", async () => {
    const reviews = await anonymousClient.reviews.list({
      bottle: mockBottle.id,
      sort: "name",
    });
    expect(reviews.results).toHaveLength(3);
    expect(reviews.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: mockReview.id })]),
    );
    expect(
      new Set(reviews.results.map((review) => review.site?.type)).size,
    ).toBe(3);

    await expect(
      anonymousClient.bottles.tags({ bottle: mockBottle.id }),
    ).resolves.toEqual(mockBottleTags);

    await expect(
      anonymousClient.entities.catalog({ entity: mockEntity.id }),
    ).resolves.toMatchObject({
      ...mockEntityCatalog,
      notableBottles: expect.arrayContaining([
        expect.objectContaining({ id: mockBottle.id }),
      ]),
    });

    await expect(
      anonymousClient.comments.list({ tasting: mockTasting.id }),
    ).resolves.toMatchObject({
      results: mockCommentsByTasting.get(mockTasting.id),
    });
  });

  it("returns fixed user profile insights", async () => {
    const input = { user: mockUser.username };

    await expect(anonymousClient.users.badgeList(input)).resolves.toMatchObject(
      {
        results: mockBadgeAwards,
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
      results: expect.arrayContaining(
        mockFlights
          .filter((flight) => flight.public)
          .map((flight) => expect.objectContaining({ id: flight.id })),
      ),
    });
    await expect(
      anonymousClient.flights.list({ query: "Speyside" }),
    ).resolves.toMatchObject({ results: [] });

    await expect(
      anonymousClient.flights.details({ flight: mockFlight.id }),
    ).resolves.toMatchObject({
      bottles: [
        { hasTasted: false, isLibrary: false },
        { hasTasted: false, isLibrary: false },
        { hasTasted: false, isLibrary: false },
      ],
    });
    await expect(
      authenticatedClient.flights.details({ flight: mockFlight.id }),
    ).resolves.toMatchObject({
      bottles: [
        { hasTasted: true, isLibrary: true },
        { hasTasted: false, isLibrary: false },
        { hasTasted: false, isLibrary: false },
      ],
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

    const whiskyAdvocateReviews = await anonymousClient.reviews.list({
      site: "whiskyadvocate",
      sort: "recent",
    });
    expect(whiskyAdvocateReviews.results.map((review) => review.id)).toEqual([
      mockReview.id,
    ]);
  });

  it("applies read-only filters without saving state", async () => {
    await expect(
      anonymousClient.countries.list({ query: "New Zealand" }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      anonymousClient.regions.list({
        country: mockCountry.slug,
        query: "Lowlands",
      }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      anonymousClient.tastings.list({ bottle: 9999 }),
    ).resolves.toMatchObject({ results: [] });
    await expect(
      anonymousClient.collections.bottles.list({
        collection: "library",
        user: mockUser.username,
        query: "Ardbeg",
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
      results: expect.arrayContaining([
        expect.objectContaining({
          bottle: expect.objectContaining({
            id: mockBottle.id,
            isFavorite: true,
            isLibrary: true,
            hasTasted: true,
          }),
          hasTasted: true,
        }),
        expect.objectContaining({
          bottle: expect.objectContaining({
            id: mockBottles[4]!.id,
            isFavorite: true,
            isLibrary: false,
            hasTasted: false,
          }),
          hasTasted: false,
        }),
      ]),
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
        bottles: mockBottles.length,
        distillers: mockEntities.filter((entity) =>
          entity.type.includes("distiller"),
        ).length,
        brands: mockEntities.filter((entity) => entity.type.includes("brand"))
          .length,
        bottlers: mockEntities.filter((entity) =>
          entity.type.includes("bottler"),
        ).length,
        blenders: mockEntities.filter((entity) => entity.kind === "blender")
          .length,
        companies: mockEntities.filter((entity) => entity.kind === "company")
          .length,
        regions: mockRegions.length,
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
        members: 3,
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
      followedDistillerCount: 2,
    });
  });

  it("keeps self-only user fields out of public profiles", async () => {
    await expect(
      anonymousClient.users.details({ user: mockUser.username }),
    ).resolves.toEqual(mockPublicUserDetails);

    await expect(
      authenticatedClient.users.details({ user: "me" }),
    ).resolves.toEqual(expect.objectContaining({ email: mockUser.email }));

    await expect(friendClient.users.details({ user: "me" })).resolves.toEqual(
      mockFriendDetails[0],
    );
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
