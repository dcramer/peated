import {
  BottleGroupV1Schema,
  CatalogTargetV1Schema,
  ConcreteBottleV1Schema,
} from "./catalogIdentity";

const ratingStats = {
  pass: 0,
  sip: 0,
  savor: 0,
  total: 0,
  avg: null,
  percentage: { pass: 0, sip: 0, savor: 0 },
};

const group = BottleGroupV1Schema.parse({
  schemaVersion: 1,
  id: 1,
  fullName: "Example 12-year-old",
  name: "12-year-old",
  brandId: 2,
  bottlerId: null,
  distillerIds: [2],
  category: "single_malt",
  seriesId: null,
  statedAge: 12,
  representativeBottleId: 3,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  flavorProfile: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  ratingStats,
  totalTastings: 0,
  totalBottles: 1,
  createdByActorId: 4,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
});

const bottle = ConcreteBottleV1Schema.parse({
  schemaVersion: 1,
  id: 3,
  groupId: 1,
  fullName: "Example 12-year-old Batch 1",
  name: "12-year-old Batch 1",
  brandId: 2,
  bottlerId: 5,
  distillerIds: [6, 7],
  category: "single_malt",
  seriesId: 8,
  flavorProfile: "peated",
  edition: "Batch 1",
  statedAge: null,
  abv: 54.2,
  singleCask: false,
  caskStrength: true,
  vintageYear: null,
  releaseYear: 2026,
  caskSize: null,
  caskType: null,
  caskFill: null,
  description: null,
  descriptionSrc: null,
  imageUrl: null,
  tastingNotes: null,
  suggestedTags: [],
  avgRating: null,
  ratingStats,
  totalTastings: 0,
  createdByActorId: 4,
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
});

describe("catalog identity runtime schemas", () => {
  test("parses group and exact Bottle targets as distinct results", () => {
    expect(
      CatalogTargetV1Schema.parse({
        schemaVersion: 1,
        kind: "group",
        targetId: 10,
        group,
      }),
    ).not.toHaveProperty("bottle");
    expect(
      CatalogTargetV1Schema.parse({
        schemaVersion: 1,
        kind: "bottle",
        targetId: 11,
        group,
        bottle,
      }),
    ).toMatchObject({
      kind: "bottle",
      bottle: {
        id: 3,
        groupId: 1,
        brandId: 2,
        bottlerId: 5,
        distillerIds: [6, 7],
        category: "single_malt",
        seriesId: 8,
        flavorProfile: "peated",
      },
    });
  });

  test("rejects an exact target without a concrete Bottle", () => {
    expect(() =>
      CatalogTargetV1Schema.parse({
        schemaVersion: 1,
        kind: "bottle",
        targetId: 11,
        group,
      }),
    ).toThrow();
  });
});
