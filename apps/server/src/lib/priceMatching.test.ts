import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import {
  applyApprovedStorePriceMatch,
  findStorePriceMatchCandidates,
  resolveStorePriceMatchProposal,
} from "@peated/server/lib/priceMatching";
import { findBottleMatchCandidates } from "@peated/server/lib/priceMatchingCandidates";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/agents/whisky/labelExtractor", () => ({
  extractFromImage: vi.fn(),
  extractFromText: vi.fn(),
}));

vi.mock("@peated/server/agents/priceMatch", () => ({
  classifyStorePriceMatch: vi.fn(),
  StorePriceMatchClassificationError: class StorePriceMatchClassificationError extends Error {
    searchEvidence: unknown[];
    candidateBottles: unknown[];

    constructor(
      message: string,
      searchEvidence: unknown[] = [],
      candidateBottles: unknown[] = [],
    ) {
      super(message);
      this.name = "StorePriceMatchClassificationError";
      this.searchEvidence = searchEvidence;
      this.candidateBottles = candidateBottles;
    }
  },
}));

vi.mock("@peated/server/lib/openaiEmbeddings", async () => {
  const actual = await vi.importActual("@peated/server/lib/openaiEmbeddings");
  return {
    ...actual,
    getOpenAIEmbedding: vi.fn(),
  };
});

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("priceMatching", () => {
  const originalOpenAIApiKey = config.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    config.OPENAI_API_KEY = originalOpenAIApiKey;
  });

  afterEach(() => {
    config.OPENAI_API_KEY = originalOpenAIApiKey;
  });

  test("falls back to exact candidates when embeddings fail", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = "test-openai-key";
    const { getOpenAIEmbedding } = await import(
      "@peated/server/lib/openaiEmbeddings"
    );
    vi.mocked(getOpenAIEmbedding).mockRejectedValue(
      new Error("Embeddings unavailable"),
    );

    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Fallback Candidate",
    });

    const candidates = await findStorePriceMatchCandidates(
      {
        name: "Fallback Candidate",
        bottleId: null,
      },
      null,
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("prefers structured extracted identity over noisy retailer titles for exact lookup", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Shibui",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Pure Malt",
    });

    const candidates = await findBottleMatchCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("includes extracted cask flags in exact alias lookup", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Shibui",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Pure Malt",
      singleCask: true,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Shibui Pure Malt Single Cask",
    });

    const candidates = await findBottleMatchCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_strength: null,
      single_cask: true,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          alias: "Shibui Pure Malt Single Cask",
          source: expect.arrayContaining(["exact"]),
          singleCask: true,
        }),
      ]),
    );
  });

  test("normalizes string bottle ids returned from raw candidate queries", async () => {
    config.OPENAI_API_KEY = "test-openai-key";

    const { getOpenAIEmbedding } = await import(
      "@peated/server/lib/openaiEmbeddings"
    );
    vi.mocked(getOpenAIEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy.mockImplementation(async () => ({
      rows: [
        {
          bottleId: "123",
          alias: "Synthetic Candidate",
          fullName: "Synthetic Candidate",
          brand: "Synthetic Brand",
          score: "0.91",
        },
      ],
    }));

    const candidates = await findBottleMatchCandidates({
      query: "Synthetic Candidate",
      brand: null,
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        bottleId: 123,
        alias: "Synthetic Candidate",
      }),
    ]);
  });

  test("normalizes fractional classifier confidence before persisting proposals", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Fractional Confidence Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Confidence Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Confidence Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "match_existing",
        confidence: 0.88,
        rationale: "Alias and listing details strongly match.",
        suggestedBottleId: bottle.id,
        candidateBottleIds: [bottle.id],
        proposedBottle: null,
      },
      searchEvidence: [],
      candidateBottles: [
        {
          bottleId: bottle.id,
          alias: "Fractional Confidence Candidate",
          fullName: bottle.fullName,
          brand: null,
          bottler: null,
          series: null,
          distillery: [],
          category: null,
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 0.95,
          source: ["exact"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("match_existing");
    expect(proposal.confidence).toBe(88);
  });

  test("downgrades non-exact existing matches without web support to no_match", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const brand = await fixtures.Entity({
      name: "Wild Turkey",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [brand.id],
      name: "Rare Breed Barrel-Proof Kentucky Straight Rye",
      category: "rye",
      caskStrength: true,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Wild Turkey Rare Breed Rye",
      imageUrl: null,
      url: "https://shop.example/wild-turkey-rare-breed-rye",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Wild Turkey",
      bottler: null,
      expression: "Rare Breed",
      series: null,
      distillery: ["Wild Turkey"],
      category: "rye",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "match_existing",
        confidence: 82,
        rationale: "The local rye candidate looks like the closest match.",
        suggestedBottleId: bottle.id,
        candidateBottleIds: [bottle.id],
        proposedBottle: null,
      },
      searchEvidence: [],
      candidateBottles: [
        {
          kind: "bottle",
          bottleId: bottle.id,
          releaseId: null,
          alias: null,
          fullName: bottle.fullName,
          bottleFullName: bottle.fullName,
          brand: "Wild Turkey",
          bottler: null,
          series: null,
          distillery: ["Wild Turkey"],
          category: "rye",
          statedAge: null,
          edition: null,
          caskStrength: true,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 0.86,
          source: ["brand"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("no_match");
    expect(proposal.suggestedBottleId).toBeNull();
    expect(proposal.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps exact-ish bottle matches when only generic retailer words differ", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Ardbeg Uigeadail Single Malt Scotch Whisky",
      imageUrl: null,
      url: "https://shop.example/ardbeg-uigeadail",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Ardbeg",
      bottler: null,
      expression: "Uigeadail",
      series: null,
      distillery: ["Ardbeg"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "match_existing",
        confidence: 84,
        rationale: "The bottle identity matches cleanly.",
        suggestedBottleId: bottle.id,
        candidateBottleIds: [bottle.id],
        proposedBottle: null,
      },
      searchEvidence: [],
      candidateBottles: [
        {
          kind: "bottle",
          bottleId: bottle.id,
          releaseId: null,
          alias: null,
          fullName: "Ardbeg Uigeadail",
          bottleFullName: "Ardbeg Uigeadail",
          brand: "Ardbeg",
          bottler: null,
          series: null,
          distillery: ["Ardbeg"],
          category: "single_malt",
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 0.84,
          source: ["brand"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("match_existing");
    expect(proposal.suggestedBottleId).toBe(bottle.id);
  });

  test("rejects create_new release proposals that point at an unknown parent bottle", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const candidateBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Unknown Parent Release Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Parent Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Parent Distillery"],
      category: "single_malt",
      stated_age: null,
      abv: 58.4,
      release_year: 2024,
      vintage_year: null,
      cask_type: "tawny_port",
      cask_size: null,
      cask_fill: null,
      cask_strength: true,
      single_cask: true,
      edition: "Batch 1",
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 97,
        rationale: "This looks like a new release under an existing bottle.",
        suggestedBottleId: null,
        suggestedReleaseId: null,
        parentBottleId: 999999,
        creationTarget: "release",
        candidateBottleIds: [candidateBottle.id],
        proposedBottle: null,
        proposedRelease: {
          edition: "Batch 1",
          statedAge: null,
          abv: 58.4,
          releaseYear: 2024,
          vintageYear: null,
          caskType: "tawny_port",
          caskSize: null,
          caskFill: null,
          caskStrength: true,
          singleCask: true,
          description: null,
          imageUrl: null,
          tastingNotes: null,
        },
      },
      searchEvidence: [],
      candidateBottles: [
        {
          bottleId: candidateBottle.id,
          alias: null,
          fullName: candidateBottle.fullName,
          brand: null,
          bottler: null,
          series: null,
          distillery: [],
          category: null,
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 0.84,
          source: ["brand"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("errored");
    expect(proposal.error).toContain("unknown parent bottle id");
  });

  test("keeps local-only create_new proposals in review without mutating model confidence", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Local Only Create Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Local Only Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Local Only Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 95,
        rationale: "Looks like a distinct bottle from local evidence.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Reserve",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Local Only Brand",
          },
          distillers: [
            {
              id: null,
              name: "Local Only Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.confidence).toBe(95);
  });

  test("normalizes proposed bottle drafts before persisting create_new proposals", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Normalized Draft Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Normalized Brand",
      expression: "8 Year",
      series: null,
      distillery: ["Normalized Distillery"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 85,
        rationale: "The listing looks like a distinct release.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        creationTarget: "bottle",
        proposedBottle: {
          name: "Normalized Brand 8 year Batch 7",
          series: null,
          category: "single_malt",
          edition: "Batch 7",
          statedAge: null,
          caskStrength: true,
          singleCask: null,
          abv: 46,
          vintageYear: null,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
          brand: {
            id: null,
            name: "Normalized Brand",
          },
          distillers: [
            {
              id: null,
              name: "Normalized Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.creationTarget).toBe("bottle");
    expect(proposal.proposedBottle).toMatchObject({
      name: "8-year-old (Batch 7)",
      statedAge: 8,
      edition: "Batch 7",
      caskStrength: true,
      abv: 46,
      releaseYear: 2024,
      brand: {
        name: "Normalized Brand",
      },
    });
    expect(proposal.proposedRelease).toBeNull();
  });

  test("splits normalized drafts when create_new explicitly targets bottle_and_release", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Normalized Release Draft Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Normalized Brand",
      expression: "8 Year",
      series: null,
      distillery: ["Normalized Distillery"],
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 85,
        rationale: "The listing looks like a distinct release.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        creationTarget: "bottle_and_release",
        proposedBottle: {
          name: "Normalized Brand 8 year Batch 7",
          series: null,
          category: "single_malt",
          edition: "Batch 7",
          statedAge: null,
          caskStrength: true,
          singleCask: null,
          abv: 46,
          vintageYear: null,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
          brand: {
            id: null,
            name: "Normalized Brand",
          },
          distillers: [
            {
              id: null,
              name: "Normalized Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.creationTarget).toBe("bottle_and_release");
    expect(proposal.proposedBottle).toMatchObject({
      name: "8-year-old (Batch 7)",
      statedAge: 8,
      edition: null,
      caskStrength: null,
      abv: null,
      releaseYear: null,
      brand: {
        name: "Normalized Brand",
      },
    });
    expect(proposal.proposedRelease).toMatchObject({
      edition: "Batch 7",
      caskStrength: true,
      abv: 46,
      releaseYear: 2024,
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "1st_fill",
    });
  });

  test("treats unknown or spirit create_new categories as review-only", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Spirit Category Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Spirit Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Spirit Distillery"],
      category: "spirit",
      stated_age: 12,
      abv: null,
      release_year: 2024,
      vintage_year: 2010,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 1",
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 96,
        rationale: "Web evidence suggests this is a real release.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Reserve Batch 1 2024",
          series: null,
          category: "spirit",
          edition: "Batch 1",
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: 2010,
          releaseYear: 2024,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Spirit Brand",
          },
          distillers: [
            {
              id: null,
              name: "Spirit Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [
        {
          query: 'site:woodencork.com "Spirit Category Candidate"',
          summary: "Retailer listing for Spirit Category Candidate.",
          results: [
            {
              title: "Spirit Category Candidate",
              url: "https://woodencork.example/spirit-category-candidate",
              domain: "woodencork.example",
              description: "Retailer listing",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal.status).toBe("pending_review");
    expect(proposal.confidence).toBe(96);
    expect(proposal.extractedLabel).toMatchObject({
      category: null,
      edition: "Batch 1",
      release_year: 2024,
      vintage_year: 2010,
    });
    expect(proposal.proposedBottle).toMatchObject({
      category: null,
      edition: "Batch 1",
      releaseYear: 2024,
      vintageYear: 2010,
    });
    expect(proposal.proposedRelease).toBeNull();
    expect(updatedPrice?.bottleId).toBeNull();
  });

  test("does not auto-create from empty web evidence", async ({ fixtures }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Empty Evidence Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Evidence Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Evidence Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 95,
        rationale: "A web search was attempted but found nothing useful.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Reserve",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Evidence Brand",
          },
          distillers: [
            {
              id: null,
              name: "Evidence Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [
        {
          query: 'site:example.com "Empty Evidence Candidate"',
          summary: null,
          results: [],
        },
      ],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.confidence).toBe(95);
    expect(updatedPrice?.bottleId).toBeNull();
  });

  test("auto ignores clearly non-whisky listings", async ({ fixtures }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Tito's Handmade Vodka",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue(null);

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(classifyStorePriceMatch).not.toHaveBeenCalled();
    expect(proposal.status).toBe("ignored");
    expect(proposal.proposalType).toBe("no_match");
  });

  test("auto approves trusted SMWS matches without classifier when aliases differ", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: null,
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "RW6.5 Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-existing",
    });

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    });

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyStorePriceMatch).not.toHaveBeenCalled();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(listingAlias?.bottleId).toBe(bottle.id);
  });

  test("auto creates trusted SMWS bottles without classifier", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-new",
    });

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    });
    const observation = await db.query.bottleObservations.findFirst({
      where: (bottleObservations, { eq }) =>
        eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });
    const distillerLinks = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, proposal.suggestedBottleId!));

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyStorePriceMatch).not.toHaveBeenCalled();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      currentBottleId: expect.any(Number),
      suggestedBottleId: expect.any(Number),
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
    expect(createdBottle).toMatchObject({
      name: "RW6.5 Sauna Smoke",
      fullName: "SMWS RW6.5 Sauna Smoke",
      brandId: brand.id,
      bottlerId: brand.id,
      category: "rye",
      singleCask: true,
    });
    expect(listingAlias?.bottleId).toBe(proposal.suggestedBottleId);
    expect(observation).toMatchObject({
      bottleId: proposal.suggestedBottleId,
      releaseId: null,
      sourceType: "store_price",
      parsedIdentity: expect.objectContaining({
        single_cask: true,
      }),
    });
    expect(distillerLinks).toEqual([
      expect.objectContaining({
        bottleId: proposal.suggestedBottleId,
        distillerId: distiller.id,
      }),
    ]);
  });

  test("trusted SMWS auto approval succeeds while a retry lease is active", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: null,
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "RW6.5 Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-processing",
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, existingProposal.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyStorePriceMatch).not.toHaveBeenCalled();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
  });

  test("trusted SMWS matching requires the canonical bottle name to preserve the parsed cask code", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const mismatchedBottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-name-invariant",
    });

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyStorePriceMatch).not.toHaveBeenCalled();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      suggestedBottleId: expect.any(Number),
    });
    expect(proposal.suggestedBottleId).not.toBe(mismatchedBottle.id);
    expect(createdBottle).toMatchObject({
      name: "RW6.5 Sauna Smoke",
      fullName: "SMWS RW6.5 Sauna Smoke",
      brandId: brand.id,
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
  });

  test("auto creates high-confidence web-validated new bottles", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Auto Create Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Auto Brand",
      expression: "Web Reserve",
      series: null,
      distillery: ["Auto Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 92,
        rationale: "Web evidence confirms a distinct release.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Web Reserve",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Auto Brand",
          },
          distillers: [
            {
              id: null,
              name: "Auto Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [
        {
          query: '"Auto Brand" "Web Reserve" official',
          summary:
            "The official Auto Brand release page confirms Web Reserve as a 12 year single malt.",
          results: [
            {
              title: "Auto Create Candidate",
              url: "https://www.autobrand.com/web-reserve",
              domain: "autobrand.com",
              description:
                "The official Auto Brand release page confirms Web Reserve as a 12 year single malt.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      reviewedById: expect.any(Number),
      currentBottleId: expect.any(Number),
      suggestedBottleId: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
    expect(createdBottle).toMatchObject({
      name: "Web Reserve",
      fullName: "Auto Brand Web Reserve",
    });
    expect(listingAlias?.bottleId).toBe(proposal.suggestedBottleId);
  });

  test("auto creates high-confidence bottles while a retry lease is active", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Retry Auto Create Candidate",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Retry Auto Brand",
      expression: "Lease Reserve",
      series: null,
      distillery: ["Retry Auto Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 92,
        rationale: "Web evidence confirms a distinct release.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Lease Reserve",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Retry Auto Brand",
          },
          distillers: [
            {
              id: null,
              name: "Retry Auto Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [
        {
          query: '"Retry Auto Brand" "Lease Reserve" official',
          summary:
            "The official Retry Auto Brand release page confirms Lease Reserve as a 12 year single malt.",
          results: [
            {
              title: "Retry Auto Brand Lease Reserve",
              url: "https://www.retryautobrand.com/lease-reserve",
              domain: "retryautobrand.com",
              description:
                "The official Retry Auto Brand release page confirms Lease Reserve as a 12 year single malt.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, existingProposal.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      suggestedBottleId: expect.any(Number),
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      suggestedBottleId: proposal.suggestedBottleId,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
    expect(createdBottle).toMatchObject({
      name: "Lease Reserve",
      fullName: "Retry Auto Brand Lease Reserve",
    });
  });

  test("auto creates new bottles even when replacing an existing assignment", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const currentBottle = await fixtures.Bottle();
    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: currentBottle.id,
      name: "Replacement Create Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Replacement Brand",
      expression: "Fresh Release",
      series: null,
      distillery: ["Replacement Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 92,
        rationale: "Web evidence confirms this is a distinct bottling.",
        suggestedBottleId: null,
        candidateBottleIds: [currentBottle.id],
        proposedBottle: {
          name: "Fresh Release",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Replacement Brand",
          },
          distillers: [
            {
              id: null,
              name: "Replacement Distillery",
            },
          ],
          bottler: null,
        },
      },
      searchEvidence: [
        {
          query: '"Replacement Brand" "Fresh Release" official',
          summary:
            "The official Replacement Brand page confirms Fresh Release from Replacement Distillery as a 12 year single malt release.",
          results: [
            {
              title: "Replacement Create Candidate",
              url: "https://www.replacementbrand.com/fresh-release",
              domain: "replacementbrand.com",
              description:
                "The official Replacement Brand page confirms Fresh Release from Replacement Distillery as a 12 year single malt release.",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [
        {
          bottleId: currentBottle.id,
          alias: null,
          fullName: currentBottle.fullName,
          brand: null,
          bottler: null,
          series: null,
          distillery: [],
          category: null,
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 1,
          source: ["current"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      reviewedById: expect.any(Number),
      currentBottleId: expect.any(Number),
      suggestedBottleId: expect.any(Number),
    });
    expect(proposal.suggestedBottleId).not.toBe(currentBottle.id);
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
    expect(createdBottle).toMatchObject({
      name: "Fresh Release",
      fullName: "Replacement Brand Fresh Release",
    });
  });

  test("preserves extracted label and candidates when classification fails", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch, StorePriceMatchClassificationError } =
      await import("@peated/server/agents/priceMatch");
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Classifier Failure Candidate",
    });
    const price = await fixtures.StorePrice({
      name: "Classifier Failure Candidate",
      imageUrl: null,
    });

    const candidateBottles = [
      {
        bottleId: bottle.id,
        alias: "Classifier Failure Candidate",
        fullName: bottle.fullName,
        brand: null,
        bottler: null,
        series: null,
        distillery: [],
        category: null,
        statedAge: null,
        edition: null,
        caskStrength: null,
        singleCask: null,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        score: 1,
        source: ["exact"],
      },
    ];

    vi.mocked(classifyStorePriceMatch).mockRejectedValue(
      new StorePriceMatchClassificationError(
        "Classifier blew up",
        [],
        candidateBottles,
      ),
    );

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Failure Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Failure Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      edition: null,
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("errored");
    expect(proposal.error).toBe("Classifier blew up");
    expect(proposal.extractedLabel).toMatchObject({
      brand: "Failure Brand",
      expression: "Reserve",
      stated_age: 12,
    });
    expect(proposal.candidateBottles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("includes structured bottle fields in candidate search text", async () => {
    config.OPENAI_API_KEY = "test-openai-key";

    const { getOpenAIEmbedding } = await import(
      "@peated/server/lib/openaiEmbeddings"
    );
    vi.mocked(getOpenAIEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy.mockResolvedValue({ rows: [] });

    await findBottleMatchCandidates({
      query: "Springbank Local Barley",
      brand: "Springbank",
      bottler: "Campbeltown Merchant",
      expression: "Local Barley",
      series: null,
      distillery: ["Springbank"],
      category: "single_malt",
      stated_age: null,
      abv: 59.2,
      cask_type: null,
      cask_size: "port_pipe",
      cask_fill: "1st_fill",
      cask_strength: true,
      single_cask: true,
      edition: "Batch 1",
      vintage_year: 2010,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("2010 vintage"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("2024 release"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("59.2% ABV"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("Campbeltown Merchant"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("port_pipe"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("1st_fill"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("cask strength"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("single cask"),
    );
  });

  test("re-ranks local candidates using structured bottle fields", async () => {
    config.OPENAI_API_KEY = undefined;

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 1",
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: 2010,
            releaseYear: 2024,
            caskType: "bourbon",
            score: 0.82,
          },
          {
            bottleId: 2,
            fullName: "Shibui Pure Malt Single Cask",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 1",
            caskStrength: true,
            singleCask: true,
            abv: 59.2,
            vintageYear: 2010,
            releaseYear: 2024,
            caskType: "bourbon",
            score: 0.8,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const candidates = await findBottleMatchCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 12,
      abv: 59.2,
      cask_type: "bourbon",
      cask_strength: true,
      single_cask: true,
      edition: "Batch 1",
      vintage_year: 2010,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]).toMatchObject({
      bottleId: 2,
      caskStrength: true,
      singleCask: true,
      abv: 59.2,
    });
  });

  test("enriches candidates with bottler, series, distillery, and release metadata", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const brand = await fixtures.Entity({
      name: "Independent Label",
      type: ["brand"],
    });
    const bottler = await fixtures.Entity({
      name: "Campbeltown Merchant",
      type: ["bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Ben Nevis",
      type: ["distiller"],
    });
    const series = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Small Batch",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: bottler.id,
      seriesId: series.id,
      distillerIds: [distiller.id],
      name: "Reserve",
      category: "single_malt",
      statedAge: null,
      edition: null,
      caskStrength: null,
      singleCask: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Independent Label Small Batch Reserve Batch 7",
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      statedAge: 12,
      edition: "Batch 7",
      caskStrength: true,
      singleCask: true,
      abv: 57.8,
      vintageYear: 2011,
      releaseYear: 2024,
      caskType: "ruby_port",
      caskSize: "port_pipe",
      caskFill: "1st_fill",
    });

    const [candidate] = await findBottleMatchCandidates({
      query: "Independent Label Small Batch Reserve Batch 7",
      brand: brand.name,
      bottler: bottler.name,
      expression: "Reserve",
      series: series.name,
      distillery: [distiller.name],
      category: "single_malt",
      stated_age: 12,
      abv: 57.8,
      cask_type: "ruby_port",
      cask_size: "port_pipe",
      cask_fill: "1st_fill",
      cask_strength: true,
      single_cask: true,
      edition: "Batch 7",
      vintage_year: 2011,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidate).toMatchObject({
      bottleId: bottle.id,
      brand: brand.name,
      bottler: bottler.name,
      series: series.name,
      distillery: [distiller.name],
      category: "single_malt",
      statedAge: 12,
      edition: "Batch 7",
      caskStrength: true,
      singleCask: true,
      abv: 57.8,
      vintageYear: 2011,
      releaseYear: 2024,
      caskType: "ruby_port",
      caskSize: "port_pipe",
      caskFill: "1st_fill",
    });
    expect(candidate?.source).toEqual(
      expect.arrayContaining(["exact", "release"]),
    );
  });

  test("does not treat edition substring collisions as matching evidence", async () => {
    config.OPENAI_API_KEY = undefined;

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt Batch 10",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 10",
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: 2024,
            caskType: null,
            score: 0.82,
          },
          {
            bottleId: 2,
            fullName: "Shibui Pure Malt Batch 1",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 1",
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: 2024,
            caskType: null,
            score: 0.8,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const candidates = await findBottleMatchCandidates({
      query: "Shibui Pure Malt Batch 1 Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 12,
      abv: 46,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 1",
      vintage_year: null,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]).toMatchObject({
      bottleId: 2,
      edition: "Batch 1",
    });
  });

  test("filters out different-brand local candidates when a same-brand option exists", async () => {
    config.OPENAI_API_KEY = undefined;

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt",
            brand: "Shibui",
            score: 0.82,
          },
          {
            bottleId: 2,
            fullName: "Ichiro's Malt & Grain Single Cask",
            brand: "Ichiro's",
            score: 0.81,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt",
            brand: "Shibui",
          },
        ],
      });

    const candidates = await findBottleMatchCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        bottleId: 1,
        brand: "Shibui",
      }),
    ]);
  });

  test("runs initial local candidate search before classification", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Presearch Candidate",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Presearch Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: null,
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockRejectedValue(
      new Error("Classifier blew up before refining candidates"),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(classifyStorePriceMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        price: expect.objectContaining({ id: price.id }),
        extractedLabel: expect.objectContaining({
          brand: null,
          distillery: [],
        }),
        initialCandidates: expect.arrayContaining([
          expect.objectContaining({
            bottleId: bottle.id,
            source: expect.arrayContaining(["exact"]),
          }),
        ]),
      }),
    );
    expect(proposal.status).toBe("errored");
    expect(proposal.candidateBottles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("does not reevaluate closed proposals during automatic resolution", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const price = await fixtures.StorePrice({
      name: "Already Approved Candidate",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        reviewedById: reviewer.id,
        reviewedAt: new Date("2026-03-10T12:00:00.000Z"),
      })
      .returning();

    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );

    const result = await resolveStorePriceMatchProposal(price.id);

    expect(classifyStorePriceMatch).not.toHaveBeenCalled();
    expect(result.id).toBe(proposal.id);
    expect(result.status).toBe("approved");
    expect(result.reviewedById).toBe(reviewer.id);
  });

  test("force reevaluation reopens closed proposals and clears review metadata", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Retry Candidate",
      imageUrl: null,
    });

    await db.insert(storePriceMatchProposals).values({
      priceId: price.id,
      status: "ignored",
      proposalType: "no_match",
      reviewedById: reviewer.id,
      reviewedAt: new Date("2026-03-10T13:00:00.000Z"),
    });

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Retry Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Retry Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "match_existing",
        confidence: 82,
        rationale: "Local alias evidence is now sufficient.",
        suggestedBottleId: bottle.id,
        candidateBottleIds: [bottle.id],
        proposedBottle: null,
      },
      searchEvidence: [],
      candidateBottles: [
        {
          bottleId: bottle.id,
          alias: "Retry Candidate",
          fullName: bottle.fullName,
          brand: null,
          bottler: null,
          series: null,
          distillery: [],
          category: null,
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 1,
          source: ["exact"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
    });
    const storedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(classifyStorePriceMatch).toHaveBeenCalledOnce();
    expect(proposal.status).toBe("pending_review");
    expect(proposal.reviewedById).toBeNull();
    expect(proposal.reviewedAt).toBeNull();
    expect(proposal.suggestedBottleId).toBe(bottle.id);
    expect(storedProposal).toMatchObject({
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
      suggestedBottleId: bottle.id,
    });
  });

  test("sanitizes proposed bottle draft ids before persisting proposals", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Draft Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Draft Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Draft Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 88,
        rationale: "This listing looks like a new bottle.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Draft Brand Reserve",
          series: {
            id: 42,
            name: "Special Releases",
          },
          category: "single_malt",
          edition: "Batch 7",
          statedAge: 12,
          caskStrength: true,
          singleCask: true,
          abv: 46,
          vintageYear: null,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
          brand: {
            id: 100,
            name: "Draft Brand",
          },
          distillers: [
            {
              id: 200,
              name: "Draft Distillery",
            },
          ],
          bottler: {
            id: 300,
            name: "Draft Bottler",
          },
        },
      },
      searchEvidence: [],
      candidateBottles: [],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.proposedBottle).toMatchObject({
      name: "Reserve",
      series: {
        id: null,
        name: "Special Releases",
      },
      brand: {
        id: null,
        name: "Draft Brand",
      },
      distillers: [
        {
          id: null,
          name: "Draft Distillery",
        },
      ],
      bottler: {
        id: null,
        name: "Draft Bottler",
      },
      statedAge: 12,
      edition: "Batch 7",
      caskStrength: true,
      singleCask: true,
      abv: 46,
      releaseYear: 2024,
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "1st_fill",
    });
    expect(proposal.proposedRelease).toBeNull();
  });

  test("preserves validated entity ids and canonical names on create_new proposals", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const brand = await fixtures.Entity({
      name: "Canonical Brand",
      shortName: "Brand Short",
      type: ["brand"],
    });
    const distiller = await fixtures.Entity({
      name: "Canonical Distillery",
      shortName: "Distillery Short",
      type: ["distiller"],
    });
    const bottler = await fixtures.Entity({
      name: "Canonical Bottler",
      type: ["bottler"],
    });
    await fixtures.EntityAlias({
      entityId: brand.id,
      name: "Brand Alias",
    });
    await fixtures.EntityAlias({
      entityId: bottler.id,
      name: "Bottler Alias",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Validated Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Canonical Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Canonical Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "create_new",
        confidence: 88,
        rationale: "This listing looks like a new bottle.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Canonical Brand Reserve",
          series: {
            id: 42,
            name: "Special Releases",
          },
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: 46,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: brand.id,
            name: "Brand Alias",
          },
          distillers: [
            {
              id: distiller.id,
              name: "Distillery Short",
            },
          ],
          bottler: {
            id: bottler.id,
            name: "Bottler Alias",
          },
        },
      },
      searchEvidence: [],
      candidateBottles: [],
      resolvedEntities: [
        {
          entityId: brand.id,
          name: brand.name,
          shortName: brand.shortName,
          type: brand.type,
          alias: "Brand Alias",
          score: 1,
          source: ["exact"],
        },
        {
          entityId: distiller.id,
          name: distiller.name,
          shortName: distiller.shortName,
          type: distiller.type,
          alias: null,
          score: 1,
          source: ["exact"],
        },
        {
          entityId: bottler.id,
          name: bottler.name,
          shortName: bottler.shortName,
          type: bottler.type,
          alias: "Bottler Alias",
          score: 1,
          source: ["exact"],
        },
      ],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.proposedBottle).toMatchObject({
      name: "Reserve",
      series: {
        id: null,
        name: "Special Releases",
      },
      brand: {
        id: brand.id,
        name: "Canonical Brand",
      },
      distillers: [
        {
          id: distiller.id,
          name: "Canonical Distillery",
        },
      ],
      bottler: {
        id: bottler.id,
        name: "Canonical Bottler",
      },
    });
  });

  test("marks proposals errored when classifier suggests an unknown bottle id", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Unknown Suggested Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Unknown Brand",
      expression: "Reserve",
      series: null,
      distillery: ["Unknown Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "match_existing",
        confidence: 80,
        rationale: "Looks like an existing bottle.",
        suggestedBottleId: 999999,
        candidateBottleIds: [bottle.id, 999999],
        proposedBottle: null,
      },
      searchEvidence: [],
      candidateBottles: [
        {
          bottleId: bottle.id,
          alias: "Unknown Suggested Candidate",
          fullName: bottle.fullName,
          brand: null,
          bottler: null,
          series: null,
          distillery: [],
          category: null,
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          score: 0.95,
          source: ["exact"],
        },
      ],
      resolvedEntities: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("errored");
    expect(proposal.suggestedBottleId).toBeNull();
    expect(proposal.error).toContain("unknown suggested bottle id");
    expect(proposal.candidateBottles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
        }),
      ]),
    );
  });

  test("clears retry processing leases after forced resolution", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;

    const { extractFromText } = await import(
      "@peated/server/agents/whisky/labelExtractor"
    );
    const { classifyStorePriceMatch } = await import(
      "@peated/server/agents/priceMatch"
    );
    const price = await fixtures.StorePrice({
      name: "Retry Lease Candidate",
      imageUrl: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Retry Brand",
      expression: "Retry Lease Candidate",
      series: null,
      distillery: null,
      category: "single_malt",
      stated_age: null,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyStorePriceMatch).mockResolvedValue({
      decision: {
        action: "no_match",
        confidence: 35,
        rationale: "Still no confident match.",
        suggestedBottleId: null,
        candidateBottleIds: [],
        proposedBottle: null,
      },
      searchEvidence: [],
      candidateBottles: [],
      resolvedEntities: [],
    });

    await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(updatedProposal).toMatchObject({
      status: "pending_review",
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
  });

  test("approval fanout skips proposals that are currently processing", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const firstPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Fanout Candidate",
      volume: 750,
    });
    const secondPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Fanout Candidate",
      volume: 1000,
    });
    const [reviewableProposal, processingProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: firstPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
        {
          priceId: secondPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
          processingToken: "lease-token",
          processingQueuedAt: new Date(Date.now() - 60_000),
          processingExpiresAt: new Date(Date.now() + 10 * 60_000),
        },
      ])
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: reviewableProposal.id,
      bottleId: bottle.id,
      reviewedById: user.id,
    });

    const updatedReviewableProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, reviewableProposal.id),
      });
    const updatedProcessingProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, processingProposal.id),
      });

    expect(updatedReviewableProposal).toMatchObject({
      status: "approved",
      suggestedBottleId: bottle.id,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
    expect(updatedProcessingProposal).toMatchObject({
      status: "pending_review",
      suggestedBottleId: null,
      processingToken: "lease-token",
    });
  });

  test("stores a bottle observation when approving a store price match", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 7",
      releaseYear: 2024,
    });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Observation Candidate",
      url: "https://example.com/observation-candidate",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        creationTarget: "bottle_and_release",
        extractedLabel: {
          brand: "Observation Brand",
          bottler: null,
          expression: "Reserve",
          series: null,
          distillery: ["Observation Distillery"],
          category: "single_malt",
          stated_age: 12,
          abv: 55.1,
          release_year: 2024,
          vintage_year: null,
          cask_type: "bourbon",
          cask_size: "barrel",
          cask_fill: "1st_fill",
          cask_strength: true,
          single_cask: true,
          edition: "Batch 7",
        },
        proposedBottle: {
          name: "Reserve",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 12,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: null,
            name: "Observation Brand",
          },
          distillers: [
            {
              id: null,
              name: "Observation Distillery",
            },
          ],
          bottler: null,
        },
        proposedRelease: {
          edition: "Batch 7",
          statedAge: null,
          abv: 55.1,
          caskStrength: true,
          singleCask: true,
          vintageYear: null,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
          description: null,
          tastingNotes: null,
          imageUrl: null,
        },
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      releaseId: release.id,
      reviewedById: reviewer.id,
    });

    const observation = await db.query.bottleObservations.findFirst({
      where: (bottleObservations, { eq }) =>
        eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });

    expect(observation).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      sourceType: "store_price",
      sourceKey: `store_price:${price.id}`,
      sourceName: price.name,
      sourceUrl: price.url,
      externalSiteId: price.externalSiteId,
      rawText: price.name,
      createdById: reviewer.id,
      parsedIdentity: expect.objectContaining({
        brand: "Observation Brand",
        edition: "Batch 7",
        cask_strength: true,
      }),
      facts: expect.objectContaining({
        proposalType: "create_new",
        creationTarget: "bottle_and_release",
        releaseFacts: expect.objectContaining({
          edition: "Batch 7",
          abv: 55.1,
          caskStrength: true,
          singleCask: true,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
        }),
      }),
    });
  });
});
