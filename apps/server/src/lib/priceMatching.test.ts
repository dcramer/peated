import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import {
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
          score: 0.95,
          source: ["exact"],
        },
      ],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("match_existing");
    expect(proposal.confidence).toBe(88);
  });

  test("caps local-only create_new confidence below the auto-create threshold", async ({
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
          description: null,
        },
      },
      searchEvidence: [],
      candidateBottles: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.confidence).toBe(89);
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
          description: null,
        },
      },
      searchEvidence: [
        {
          query: 'site:woodencork.com "Spirit Category Candidate"',
          results: [
            {
              title: "Spirit Category Candidate",
              url: "https://woodencork.example/spirit-category-candidate",
              description: "Retailer listing",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [],
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal.status).toBe("pending_review");
    expect(proposal.confidence).toBe(89);
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
          description: null,
        },
      },
      searchEvidence: [
        {
          query: 'site:woodencork.com "Auto Create Candidate"',
          results: [
            {
              title: "Auto Create Candidate",
              url: "https://woodencork.example/auto-create",
              description: "Retailer listing",
              extraSnippets: [],
            },
          ],
        },
      ],
      candidateBottles: [],
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

  test("includes release and vintage years in structured candidate search text", async () => {
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
      expression: "Local Barley",
      series: null,
      distillery: ["Springbank"],
      category: "single_malt",
      stated_age: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
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
          score: 1,
          source: ["exact"],
        },
      ],
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
          description: null,
        },
      },
      searchEvidence: [],
      candidateBottles: [],
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
          score: 0.95,
          source: ["exact"],
        },
      ],
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
});
