import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { storePriceMatchProposals } from "@peated/server/db/schema";
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
