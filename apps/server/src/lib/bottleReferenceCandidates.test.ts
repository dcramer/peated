import {
  BottleCandidateSchema,
  type BottleCandidate,
} from "@peated/bottle-classifier/internal/types";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
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
