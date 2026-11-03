import {
  BottleCandidateSchema,
  type BottleCandidate,
} from "@peated/bottle-classifier/internal/types";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import { afterEach, expect, test, vi } from "vitest";
import {
  createBottleCandidateLookup,
  findBottleReferenceCandidates,
  getBottleCandidateById,
  mergeBottleCandidate,
  searchBottleCandidates,
  type BottleEmbeddingCreator,
} from "./bottleReferenceCandidates";

const originalAIGatewayApiKey = config.AI_GATEWAY_API_KEY;
const originalScraperAIGatewayApiKey = config.SCRAPER_AI_GATEWAY_API_KEY;

function createEmbeddingSpy() {
  return vi
    .fn<BottleEmbeddingCreator>()
    .mockResolvedValue(new Array<number>(1536).fill(0));
}

afterEach(() => {
  config.AI_GATEWAY_API_KEY = originalAIGatewayApiKey;
  config.SCRAPER_AI_GATEWAY_API_KEY = originalScraperAIGatewayApiKey;
  vi.restoreAllMocks();
});

test("candidate merging preserves the accepted exact reference", () => {
  const candidates = new Map<number, BottleCandidate>();

  mergeBottleCandidate(
    candidates,
    BottleCandidateSchema.parse({
      bottleId: 1,
      reference: "Similar search reference",
      fullName: "Example Small Batch",
      source: ["vector"],
    }),
  );
  mergeBottleCandidate(
    candidates,
    BottleCandidateSchema.parse({
      bottleId: 1,
      reference: "Accepted exact reference",
      fullName: "Example Small Batch",
      source: ["exact"],
    }),
  );

  expect(candidates.get(1)).toMatchObject({
    reference: "Accepted exact reference",
    source: ["vector", "exact"],
  });
});

test("returns a complete Bottle candidate with active BottleGroup siblings", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const bottle = await fixtures.Bottle({
    name: "Warehouse Selection",
    edition: "Batch 1",
    bottlingYear: 2023,
    releaseYear: 2024,
    maturation: "Bourbon barrel",
    caskNumber: "#1234",
    outturn: 240,
  });
  if (bottle.groupId === null) {
    throw new Error("Expected Bottle fixture to belong to a BottleGroup.");
  }

  const sibling = await fixtures.BottleGroupMember({
    groupId: bottle.groupId,
    edition: "Batch 2",
    bottlingYear: 2024,
    releaseYear: 2025,
    maturation: "Oloroso hogshead",
    caskNumber: "#9012",
    outturn: 200,
  });
  const retiredSibling = await fixtures.BottleGroupMember({
    groupId: bottle.groupId,
    edition: "Retired Batch",
    releaseYear: 2023,
  });
  await db.insert(bottleTombstones).values({
    bottleId: retiredSibling.id,
  });

  const candidate = await getBottleCandidateById(bottle.id);

  expect(candidate).toMatchObject({
    bottleId: bottle.id,
    fullName: bottle.fullName,
    edition: "Batch 1",
    bottlingYear: 2023,
    releaseYear: 2024,
    maturation: "Bourbon barrel",
    caskNumber: "#1234",
    outturn: 240,
    familyContext: {
      siblingBottles: [
        expect.objectContaining({
          bottleId: sibling.id,
          fullName: sibling.fullName,
          edition: "Batch 2",
          bottlingYear: 2024,
          releaseYear: 2025,
          traitFields: expect.not.arrayContaining([
            "maturation",
            "caskNumber",
            "outturn",
          ]),
          maturation: "Oloroso hogshead",
          caskNumber: "#9012",
          outturn: 200,
        }),
      ],
    },
  });
  expect(candidate).not.toHaveProperty("kind");
  expect(candidate).not.toHaveProperty("releaseId");
  expect(candidate).not.toHaveProperty("bottleFullName");
  expect(
    candidate?.familyContext?.siblingBottles.map(({ bottleId }) => bottleId),
  ).toEqual([sibling.id]);

  const candidates = await findBottleReferenceCandidates(
    {
      name: bottle.fullName,
      bottleId: bottle.id,
    },
    {
      brand: null,
      bottler: null,
      expression: "Warehouse Selection",
      series: null,
      distillery: null,
      category: null,
      stated_age: null,
      abv: null,
      release_year: 2024,
      vintage_year: null,
      maturation: "Bourbon barrel",
      cask_number: "#1234",
      outturn: 240,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 1",
    },
  );

  expect(candidates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        bottleId: bottle.id,
        maturation: "Bourbon barrel",
        caskNumber: "#1234",
        outturn: 240,
      }),
    ]),
  );
});

test("normalizes proof-like ABV before building candidate search evidence", async () => {
  config.AI_GATEWAY_API_KEY = "test-gateway-key";
  const embeddingSpy = createEmbeddingSpy();
  const lookup = createBottleCandidateLookup(embeddingSpy);

  await lookup.searchBottleCandidates({
    query: "Proof Normalization Candidate",
    abv: 118.4,
  });

  expect(embeddingSpy).toHaveBeenCalledWith(
    expect.stringContaining("59.2% ABV"),
  );
});

test("uses the scraper credential workload for scraper candidate embeddings", async () => {
  config.AI_GATEWAY_API_KEY = undefined;
  config.SCRAPER_AI_GATEWAY_API_KEY = "scraper-key";
  const embeddingSpy = createEmbeddingSpy();
  const lookup = createBottleCandidateLookup(embeddingSpy);

  await lookup.searchBottleCandidates(
    { query: "Scraped Candidate" },
    { workload: "scraper" },
  );

  expect(embeddingSpy).toHaveBeenCalledWith(expect.any(String), {
    workload: "scraper",
  });
});

test("includes maturation and cask number in candidate search evidence", async () => {
  config.AI_GATEWAY_API_KEY = "test-gateway-key";
  const embeddingSpy = createEmbeddingSpy();
  const lookup = createBottleCandidateLookup(embeddingSpy);

  await lookup.searchBottleCandidates({
    query: "Example Distillery Warehouse Selection",
    brand: "Example Distillery",
    expression: "Warehouse Selection",
    maturation: "Tawny port butt",
    cask_number: "#1234",
    outturn: 240,
  });

  const queryText = embeddingSpy.mock.calls[0]?.[0];
  expect(queryText).toContain("Warehouse Selection");
  expect(queryText).toContain("Tawny port butt");
  expect(queryText).toContain("#1234");
});

test("ranks a same-Brand release by covered words when the scraped title cannot pass an all-words match", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await fixtures.Entity({ name: "Laphroaig", kind: "brand" });
  const release = await fixtures.Bottle({
    name: "Willem Dafoe - The Limited Edition",
    brandId: brand.id,
    edition: "The Limited Edition",
    statedAge: 14,
    abv: 53.7,
    releaseYear: 2026,
    maturation: "Finished in Oloroso sherry casks",
  });
  const sibling = await fixtures.Bottle({
    name: "14-year-old Oloroso Sherry Finish",
    brandId: brand.id,
    statedAge: 14,
  });
  await fixtures.Bottle({
    name: "10-year-old",
    brandId: brand.id,
    statedAge: 10,
  });

  const results = await searchBottleCandidates({
    query:
      "Laphroaig 14-year-old – Willem Dafoe Edition (53,7%, OB 2026, Oloroso sherry cask finish)",
    brand: "Laphroaig",
    expression: "Willem Dafoe Edition",
    stated_age: 14,
    abv: 53.7,
    release_year: 2026,
  });

  expect(results[0]).toMatchObject({
    bottleId: release.id,
    source: expect.arrayContaining(["brand_coverage"]),
  });
  expect(results[0].source).toContain("text");
  const siblingIndex = results.findIndex(
    (candidate) => candidate.bottleId === sibling.id,
  );
  expect(siblingIndex).toBeGreaterThan(0);
});

test("keeps a same-Brand release with a matching name when a stored fact conflicts", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await fixtures.Entity({ name: "Little Book", kind: "brand" });
  const release = await fixtures.Bottle({
    name: "The Infinite - Edition III",
    brandId: brand.id,
    category: "blend",
    edition: "Edition III",
  });
  const otherBrand = await fixtures.Entity({
    name: "Jim Beam",
    kind: "brand",
  });
  for (let index = 0; index < 20; index += 1) {
    await fixtures.Bottle({
      name: `Infinite Straight Bourbon Whiskey ${index}`,
      brandId: otherBrand.id,
      category: "bourbon",
    });
  }

  const results = await searchBottleCandidates({
    query: "Little Book The Infinite Edition 3 Straight Bourbon Whiskey",
    brand: "Little Book",
    expression: "The Infinite",
    category: "bourbon",
    edition: "Edition 3",
    limit: 15,
  });

  expect(results).toHaveLength(15);
  expect(results.at(-1)).toMatchObject({
    bottleId: release.id,
    source: expect.arrayContaining(["brand"]),
    comparison: expect.objectContaining({
      conflicts: expect.arrayContaining(["category"]),
    }),
  });
});

test("does not read a dash in a scraped title as a word exclusion", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await fixtures.Entity({ name: "Laphroaig", kind: "brand" });
  const release = await fixtures.Bottle({
    name: "Willem Dafoe - The Limited Edition",
    brandId: brand.id,
  });

  const results = await searchBottleCandidates({
    query: "Laphroaig – Willem Dafoe",
  });

  expect(results).toContainEqual(
    expect.objectContaining({
      bottleId: release.id,
      source: expect.arrayContaining(["text"]),
    }),
  );
});

// Candidate retrieval shapes behind wrong store-listing matches (September 2026):
// the moderator's Bottle never reached the classifier, so it matched another.
// Each Brand gets enough other Bottles that the candidate limits apply.
function sourceLabel(
  overrides: Partial<Parameters<typeof findBottleReferenceCandidates>[1]>,
) {
  return {
    brand: null,
    bottler: null,
    expression: null,
    series: null,
    distillery: null,
    category: null,
    stated_age: null,
    abv: null,
    release_year: null,
    vintage_year: null,
    maturation: null,
    cask_number: null,
    outturn: null,
    cask_strength: null,
    single_cask: null,
    edition: null,
    ...overrides,
  };
}

async function brandWithOtherBottles(
  fixtures: Pick<typeof Fixtures, "Entity" | "Bottle">,
  name: string,
) {
  const brand = await fixtures.Entity({ name, kind: "distillery" });
  const otherNames = [
    "12-year-old",
    "15-year-old",
    "18-year-old",
    "21-year-old",
    "25-year-old",
    "Sherry Cask",
    "Port Cask Finish",
    "Peated",
    "Cask Strength - Batch 1",
    "Cask Strength - Batch 2",
    "Single Cask",
    "Distillery Exclusive",
    "Founder's Reserve",
    "Double Wood",
    "Triple Cask",
    "Reserve",
    "Heritage",
    "Rare Cask",
    "Limited Release",
    "Signature",
  ];
  for (const otherName of otherNames)
    await fixtures.Bottle({ name: otherName, brandId: brand.id });
  return brand;
}

test("finds a Bottle whose stored name still carries strength and cask wording", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await brandWithOtherBottles(fixtures, "Tomintoul");
  const release = await fixtures.Bottle({
    name: "Madeira Cask Finish - 40.0% ABV - Madeira Cask",
    brandId: brand.id,
    abv: 40,
  });

  const candidates = await findBottleReferenceCandidates(
    { name: "Tomintoul Madeira Wine Cask Finish" },
    sourceLabel({ brand: "Tomintoul", expression: "Madeira Wine Cask Finish" }),
  );

  expect(candidates.map(({ bottleId }) => bottleId)).toContain(release.id);
});

test("returns both releases of an expression when the source gives no strength", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await brandWithOtherBottles(fixtures, "Tomintoul");
  const older = await fixtures.Bottle({
    name: "Madeira Cask Finish - 40.0% ABV - Madeira Cask",
    brandId: brand.id,
    abv: 40,
  });
  const newer = await fixtures.Bottle({
    name: "Madeira Cask Finish",
    brandId: brand.id,
    abv: 46,
  });

  const candidates = await findBottleReferenceCandidates(
    { name: "Tomintoul Madeira Wine Cask Finish" },
    sourceLabel({ brand: "Tomintoul", expression: "Madeira Wine Cask Finish" }),
  );

  expect(candidates.map(({ bottleId }) => bottleId)).toEqual(
    expect.arrayContaining([older.id, newer.id]),
  );
});

test("finds an aged Bottle whose stored name writes the age as a bare number", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await brandWithOtherBottles(fixtures, "GlenAllachie");
  const bottle = await fixtures.Bottle({
    name: "08",
    brandId: brand.id,
    statedAge: 8,
  });

  const candidates = await findBottleReferenceCandidates(
    { name: "Glenallachie 8-year-old Single Malt Whisky" },
    sourceLabel({ brand: "GlenAllachie", stated_age: 8 }),
  );

  expect(candidates.map(({ bottleId }) => bottleId)).toContain(bottle.id);
});

test("keeps a better-named Bottle when another holds an accepted reference for a similar name", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await brandWithOtherBottles(fixtures, "Glen Moray");
  const elginClassic = await fixtures.Bottle({
    name: "Elgin Classic",
    brandId: brand.id,
  });
  await fixtures.BottleReference({
    bottleId: elginClassic.id,
    name: "Glen Moray Elgin Classic Chardonnay Cask Finish Scotch Whiskey",
  });
  const chardonnay = await fixtures.Bottle({
    name: "Chardonnay Finish - 40.0% ABV - Chardonnay Cask",
    brandId: brand.id,
    abv: 40,
  });

  const candidates = await findBottleReferenceCandidates(
    { name: "Glen Moray Chardonnay Cask Single Malt Scotch Whiskey" },
    sourceLabel({ brand: "Glen Moray", expression: "Chardonnay Cask" }),
  );

  expect(candidates.map(({ bottleId }) => bottleId)).toContain(chardonnay.id);
});

test("returns every release of an aged expression, not only the one with an exact reference", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await brandWithOtherBottles(fixtures, "Laphroaig");
  const original = await fixtures.Bottle({
    name: "15-year-old",
    brandId: brand.id,
    statedAge: 15,
  });
  // Creating the Bottle accepts its full name, "Laphroaig 15-year-old", as an
  // exact reference.
  const relaunch = await fixtures.Bottle({
    name: "15-year-old",
    edition: "2026 Release",
    brandId: brand.id,
    statedAge: 15,
  });

  const candidates = await findBottleReferenceCandidates(
    { name: "Laphroaig 15-year-old" },
    sourceLabel({ brand: "Laphroaig", stated_age: 15 }),
  );

  expect(candidates.map(({ bottleId }) => bottleId)).toEqual(
    expect.arrayContaining([original.id, relaunch.id]),
  );
});

test("finds the plain expression beside its cask-finish edition", async ({
  fixtures,
}) => {
  config.AI_GATEWAY_API_KEY = undefined;
  const brand = await brandWithOtherBottles(fixtures, "Jameson");
  const plain = await fixtures.Bottle({
    name: "Triple Triple",
    brandId: brand.id,
  });
  await fixtures.Bottle({
    name: "Triple Triple Marsala Cask Edition - 40.0% ABV - Marsala Cask",
    brandId: brand.id,
    abv: 40,
  });

  const candidates = await findBottleReferenceCandidates(
    { name: "Jameson Triple Triple Irish Whiskey" },
    sourceLabel({ brand: "Jameson", expression: "Triple Triple" }),
  );

  expect(candidates.map(({ bottleId }) => bottleId)).toContain(plain.id);
});
