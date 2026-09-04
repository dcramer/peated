import { createRouterClient } from "@orpc/server";
import {
  mockAccessToken,
  mockActivity,
  mockBadgeAwards,
  mockBadges,
  mockBadgeUsers,
  mockBottle,
  mockBottleGroup,
  mockBottlePrices,
  mockBottles,
  mockBottleTags,
  mockCaolIlaEntity,
  mockChanges,
  mockCollectionBottles,
  mockCommentsByTasting,
  mockCountries,
  mockCountry,
  mockEntities,
  mockEntity,
  mockEntityCatalog,
  mockEntityHistory,
  mockEvents,
  mockExternalReview,
  mockFlight,
  mockFlights,
  mockFriendDetails,
  mockFriends,
  mockFriendships,
  mockHighlandParkEntity,
  mockIrishDistillersEntity,
  mockJohnnieWalkerEntity,
  mockLaphroaigEntity,
  mockNotifications,
  mockPernodRicardEntity,
  mockPublicUserDetails,
  mockRegion,
  mockRegions,
  mockSparseCompanyEntity,
  mockStats,
  mockSuntoryGlobalSpiritsEntity,
  mockTaliskerEntity,
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
    await expect(
      anonymousClient.activity.list({ includeCriticReviews: true, limit: 1 }),
    ).resolves.toMatchObject({
      results: [
        {
          id: `critic_review:${mockExternalReview.id}`,
          type: "critic_review",
          review: { id: mockExternalReview.id },
        },
      ],
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
      scopes: ["bottles", "distilleries"],
    });
    expect(search.exact).toMatchObject({
      type: "entity",
      ref: { id: mockEntity.id, name: mockEntity.name },
    });
    expect(search.groups).toMatchObject([
      { type: "bottles", total: 3 },
      {
        type: "distilleries",
        total: 1,
        results: [{ id: mockEntity.id, name: mockEntity.name }],
      },
    ]);

    const user = await authenticatedClient.users.details({ user: "me" });
    expect(user.id).toBe(mockUser.id);
  });

  it("returns data used by the main pages", async () => {
    await expect(
      anonymousClient.entities.details({ entity: mockEntity.id }),
    ).resolves.toEqual({ ...mockEntity, images: [], isFollowing: false });
    await expect(
      anonymousClient.entities.events.list({ entity: mockEntity.id }),
    ).resolves.toEqual({ results: mockEntityHistory });
    const entities = await anonymousClient.entities.list({ limit: 100 });
    expect(entities.results).toHaveLength(mockEntities.length);
    expect(entities.results.every((entity) => entity.kind)).toBe(true);
    const diageoEntities = await anonymousClient.entities.list({
      owner: 9210,
      sort: "-bottles",
    });
    expect(diageoEntities.results).toEqual([
      mockCaolIlaEntity,
      mockTaliskerEntity,
      mockEntity,
      mockJohnnieWalkerEntity,
    ]);
    const nestedPortfolio = await anonymousClient.entities.portfolio({
      company: mockPernodRicardEntity.id,
      sort: "name",
    });
    expect(nestedPortfolio.results.map(({ name }) => name)).toEqual([
      "Midleton",
      "Redbreast",
    ]);
    expect(nestedPortfolio.groupCompanies.results).toEqual([
      mockIrishDistillersEntity,
    ]);
    expect(
      nestedPortfolio.results[0]?.ownershipPath.map(({ name }) => name),
    ).toEqual(["Pernod Ricard", "Irish Distillers"]);
    await expect(
      anonymousClient.entities.portfolio({
        company: mockSuntoryGlobalSpiritsEntity.id,
      }),
    ).resolves.toMatchObject({
      results: [expect.objectContaining({ name: "Laphroaig" })],
      total: 1,
      totals: { all: 1, distilleries: 1 },
    });
    const companyBottles = await anonymousClient.bottles.list({
      company: mockSuntoryGlobalSpiritsEntity.id,
      sort: "-release",
    });
    expect(companyBottles.results.map(({ brand }) => brand.name)).toEqual([
      "Laphroaig",
      "Laphroaig",
    ]);
    const nestedCompanyBottles = await anonymousClient.bottles.list({
      company: mockPernodRicardEntity.id,
    });
    expect(nestedCompanyBottles.results.map(({ brand }) => brand.name)).toEqual(
      ["Redbreast"],
    );
    await expect(
      anonymousClient.bottles.list({
        company: mockPernodRicardEntity.id,
        entity: mockLaphroaigEntity.id,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Choose either a Company or an Entity.",
    });
    await expect(
      anonymousClient.entities.portfolio({
        company: mockSparseCompanyEntity.id,
      }),
    ).resolves.toMatchObject({
      results: [],
      total: 0,
      totals: { all: 0 },
    });
    const laphroaigReleases = await anonymousClient.bottles.list({
      entity: mockLaphroaigEntity.id,
      sort: "-release",
    });
    expect(
      laphroaigReleases.results.map((bottle) => bottle.releaseYear),
    ).toEqual([2023, 2022]);
    await expect(
      authenticatedClient.entities.create({
        name: "New Bottler",
        kind: "bottler",
      }),
    ).resolves.toMatchObject({ name: "New Bottler", kind: "bottler" });
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
      "england",
      "france",
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
    expect(new Set(bottles.results.map((bottle) => bottle.category))).toEqual(
      new Set([
        "single_malt",
        "single_pot_still",
        "bourbon",
        "rye",
        "blend",
        "blended_malt",
      ]),
    );
    expect(
      new Set(bottles.results.map((bottle) => bottle.flavorProfile)).size,
    ).toBeGreaterThan(4);
    expect(
      new Set(bottles.results.map((bottle) => bottle.medianScore)).size,
    ).toBeGreaterThan(4);
    expect(bottles.results.some((bottle) => bottle.imageUrl !== null)).toBe(
      true,
    );
    expect(bottles.results.some((bottle) => bottle.imageUrl === null)).toBe(
      true,
    );

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
    ).resolves.toEqual({ ...yamazaki.brand, images: [], isFollowing: false });
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

  it("keeps real producer geography and ownership on detail pages", async () => {
    const highlandPark = await anonymousClient.entities.details({
      entity: mockHighlandParkEntity.id,
    });
    expect(highlandPark).toMatchObject({
      kind: "distillery",
      country: { slug: "scotland" },
      region: { slug: "highlands" },
      address:
        "Highland Park Distillery, Holm Road, Kirkwall, Orkney, KW15 1SU, UK",
      owner: { name: "Edrington", kind: "company" },
    });
    const society = await anonymousClient.entities.details({ entity: 9212 });
    expect(society).toMatchObject({
      kind: "bottler",
      address: "The Vaults, 87 Giles Street, Edinburgh, EH6 6BZ, UK",
      region: null,
      location: null,
    });
    const redbreast = await anonymousClient.entities.details({ entity: 9207 });
    expect(redbreast).toMatchObject({
      yearEstablished: 1912,
      ownerId: mockIrishDistillersEntity.id,
      owner: { name: "Irish Distillers" },
    });
    const owner = await anonymousClient.entities.details({
      entity: mockIrishDistillersEntity.id,
    });
    expect(owner.owner).toMatchObject({ name: "Pernod Ricard" });

    const entities = await anonymousClient.entities.list({ limit: 100 });
    expect(new Set(entities.results.map((entity) => entity.id)).size).toBe(
      entities.results.length,
    );
    for (const entity of entities.results) {
      if (entity.region)
        expect(entity.region.country.id).toBe(entity.country?.id);
      if (entity.ownerId !== null) {
        const owner = entities.results.find(
          (candidate) => candidate.id === entity.ownerId,
        );
        expect(owner).toBeDefined();
        expect(entity.owner).toMatchObject({
          id: owner!.id,
          name: owner!.name,
          kind: owner!.kind,
        });
      }
    }
  });

  it("exposes sourced history for each producer without leaking another history", async () => {
    const history = await anonymousClient.entities.events.list({
      entity: 9204,
    });
    expect(history.results).toMatchObject([
      { entityId: 9204, kind: "opened", date: "1858" },
      { entityId: 9204, kind: "acquired", date: "1992", newOwnerId: 9217 },
    ]);
    for (const event of history.results) {
      expect(event.sourceUrl).toBe(
        "https://www.buffalotracedistillery.com/buffalo-trace-history/",
      );
    }
    await expect(
      anonymousClient.entities.events.list({ entity: 9205 }),
    ).resolves.toEqual({ results: [] });
  });

  it("uses real bottle categories and producer relationships", async () => {
    const rye = await anonymousClient.bottles.list({ category: "rye" });
    expect(rye.results).toMatchObject([
      {
        brand: { name: "Sazerac Rye", kind: "brand" },
        distillers: [{ name: "Buffalo Trace" }],
        abv: 45,
        statedAge: null,
        noAgeStatement: true,
      },
    ]);
    const blendedMalts = await anonymousClient.bottles.list({
      category: "blended_malt",
    });
    expect(blendedMalts.results).toMatchObject([
      {
        name: "The Peat Monster",
        brand: { name: "Compass Box" },
        bottler: { name: "Compass Box" },
        abv: 46,
        statedAge: null,
        naturalColor: true,
        nonChillFiltered: true,
      },
    ]);
    const india = await anonymousClient.distilleries.list({ country: "india" });
    expect(india.results.map((entity) => entity.name)).toEqual(["Amrut"]);
    const fusion = await anonymousClient.bottles.list({
      distiller: india.results[0]!.id,
    });
    expect(fusion.results).toMatchObject([
      { name: "Fusion", category: "single_malt", abv: 50 },
    ]);
    const releases = await anonymousClient.bottleGroups.bottles({
      group: mockBottleGroup.id,
    });
    expect(
      releases.results.every((bottle) => bottle.caskStrength === false),
    ).toBe(true);
    expect(
      releases.results.every((bottle) => bottle.name.includes(bottle.edition!)),
    ).toBe(true);
  });

  it("completes bottle, entity, and tasting detail pages", async () => {
    const externalReviews = await anonymousClient.externalReviews.list({
      bottle: mockBottle.id,
      sort: "name",
    });
    expect(externalReviews.results).toHaveLength(3);
    expect(externalReviews.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mockExternalReview.id }),
      ]),
    );
    expect(
      new Set(externalReviews.results.map((review) => review.site?.type)).size,
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

  it("returns a Bottle release family", async () => {
    await expect(
      anonymousClient.bottleGroups.details({ group: mockBottleGroup.id }),
    ).resolves.toEqual(mockBottleGroup);

    const releases = await anonymousClient.bottleGroups.bottles({
      group: mockBottleGroup.id,
      sort: "-releaseYear",
    });
    expect(releases.results.map((bottle) => bottle.releaseYear)).toEqual([
      2023, 2022,
    ]);
    expect(releases.results.every((bottle) => bottle.imageUrl !== null)).toBe(
      true,
    );

    await expect(
      anonymousClient.bottleGroups.bottles({
        group: mockBottleGroup.id,
        query: "Warehouse 1",
      }),
    ).resolves.toMatchObject({
      results: [expect.objectContaining({ edition: "Warehouse 1" })],
    });
  });

  it("returns fixed user profile stats", async () => {
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

  it("returns data used by the remaining main pages", async () => {
    await expect(anonymousClient.stats()).resolves.toEqual(mockStats);

    await expect(
      anonymousClient.events.list({ limit: 3, onlyUpcoming: true }),
    ).resolves.toMatchObject({ results: mockEvents.slice(0, 3) });

    await expect(
      anonymousClient.prices.changeList({ limit: 25 }),
    ).resolves.toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({ id: mockBottle.id }),
      ]),
    });

    await expect(
      anonymousClient.bottles.prices.list({ bottle: mockBottle.id }),
    ).resolves.toEqual({ results: mockBottlePrices });

    await expect(anonymousClient.changes.list({})).resolves.toEqual({
      results: mockChanges,
      rel: { nextCursor: null, prevCursor: null },
    });

    await expect(authenticatedClient.friends.list({})).resolves.toMatchObject({
      results: mockFriendships,
    });

    await expect(
      authenticatedClient.notifications.list({ filter: "unread" }),
    ).resolves.toMatchObject({
      results: mockNotifications.filter((notification) => !notification.read),
    });

    await expect(
      authenticatedClient.users.activity.list({ user: "me" }),
    ).resolves.toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({
          createdBy: expect.objectContaining({ id: mockUser.id }),
        }),
      ]),
    });

    await expect(
      authenticatedClient.badges.details({ badge: mockBadges[0]!.id }),
    ).resolves.toEqual(mockBadges[0]);
    await expect(
      authenticatedClient.badges.userList({ badge: mockBadges[0]!.id }),
    ).resolves.toMatchObject({ results: mockBadgeUsers });
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
    ).resolves.toEqual({
      count: mockNotifications.filter((notification) => !notification.read)
        .length,
    });

    await expect(
      anonymousClient.externalReviews.list({ sort: "name" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Must be a moderator to list all external reviews.",
    });

    const whiskyAdvocateReviews = await anonymousClient.externalReviews.list({
      site: "whiskyadvocate",
      sort: "recent",
    });
    expect(whiskyAdvocateReviews.results.map((review) => review.id)).toEqual([
      mockExternalReview.id,
    ]);
  });

  it("applies filters without saving changes", async () => {
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
    await expect(anonymousClient.friends.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(anonymousClient.notifications.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      anonymousClient.badges.userList({ badge: mockBadges[0]!.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      anonymousClient.users.activity.list({ user: "me" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

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
      includeFacets: true,
      query: "Ardbeg",
      scopes: ["bottles", "distilleries", "members"],
    });

    expect(results).toEqual({
      query: "Ardbeg",
      exact: null,
      groups: [
        { type: "bottles", total: 0, results: [] },
        { type: "distilleries", total: 0, results: [] },
      ],
      scopeTotals: {
        bottles: mockBottles.length,
        series: 0,
        distilleries: mockEntities.filter(
          (entity) => entity.kind === "distillery",
        ).length,
        brands: mockEntities.filter((entity) => entity.kind === "brand").length,
        bottlers: mockEntities.filter((entity) => entity.kind === "bottler")
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
      includeFacets: true,
      query: mockUser.username,
      scopes: ["members"],
    });
    expect(anonymousResults.groups).toEqual([]);
    expect(anonymousResults.scopeTotals?.members).toBeUndefined();

    await expect(
      authenticatedClient.search({
        includeFacets: true,
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
              member: {
                id: mockUser.id,
                username: mockUser.username,
                pictureUrl: mockUser.pictureUrl,
              },
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
      followedEntityCount: 3,
    });
  });

  it("requires sign-in for followed catalog records", async () => {
    await expect(
      anonymousClient.brands.list({ filter: "following" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(
      authenticatedClient.brands.list({ filter: "following" }),
    ).resolves.toMatchObject({
      results: [expect.objectContaining({ id: 9207, name: "Redbreast" })],
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

    await expect(
      anonymousClient.bottleGroups.details({ group: 9999 }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Mock Bottle Group not found.",
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
