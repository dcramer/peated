import { afterEach, describe, expect, test, vi } from "vitest";
import { classifyBottleReference } from "./classifyBottleReference";

vi.mock("@peated/server/lib/bottleReferenceCandidates", () => ({
  extractBottleReferenceIdentity: vi.fn(),
  findBottleReferenceCandidates: vi.fn(),
}));

vi.mock("./runBottleClassifierAgent", async () => {
  const actual = await vi.importActual("./runBottleClassifierAgent");
  return {
    ...actual,
    runBottleClassifierAgent: vi.fn(),
  };
});

describe("classifyBottleReference", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("auto ignores obvious non-whisky references when extraction fails", async () => {
    const { extractBottleReferenceIdentity, findBottleReferenceCandidates } =
      await import("@peated/server/lib/bottleReferenceCandidates");
    const { runBottleClassifierAgent } = await import(
      "./runBottleClassifierAgent"
    );

    vi.mocked(extractBottleReferenceIdentity).mockResolvedValue(null);

    const result = await classifyBottleReference({
      reference: {
        name: "Tito's Handmade Vodka",
      },
    });

    expect(result).toMatchObject({
      status: "ignored",
      artifacts: {
        extractedIdentity: null,
      },
    });
    expect(findBottleReferenceCandidates).not.toHaveBeenCalled();
    expect(runBottleClassifierAgent).not.toHaveBeenCalled();
  });

  test("downgrades unsupported non-exact existing matches inside the classifier", async () => {
    const { runBottleClassifierAgent } = await import(
      "./runBottleClassifierAgent"
    );

    vi.mocked(runBottleClassifierAgent).mockResolvedValue({
      decision: {
        action: "match_existing",
        confidence: 0.82,
        rationale: "Closest local candidate.",
        suggestedBottleId: 7,
        suggestedReleaseId: null,
        parentBottleId: null,
        creationTarget: null,
        candidateBottleIds: [7],
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: {
          brand: "Wild Turkey",
          bottler: null,
          expression: "Rare Breed Rye",
          series: null,
          distillery: [],
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
        },
        searchEvidence: [],
        candidates: [
          {
            bottleId: 7,
            releaseId: null,
            kind: "bottle",
            alias: null,
            fullName: "Wild Turkey Rare Breed Barrel Proof",
            bottleFullName: "Wild Turkey Rare Breed Barrel Proof",
            brand: "Wild Turkey",
            bottler: null,
            series: null,
            distillery: [],
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
            score: 0.6,
            source: ["vector"],
          },
        ],
        resolvedEntities: [],
      },
    });

    const result = await classifyBottleReference({
      reference: {
        name: "Wild Turkey Rare Breed Rye",
        url: "https://example.com/products/rare-breed-rye",
      },
      extractedIdentity: {
        brand: "Wild Turkey",
        bottler: null,
        expression: "Rare Breed Rye",
        series: null,
        distillery: [],
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
      },
      initialCandidates: [
        {
          bottleId: 7,
          releaseId: null,
          kind: "bottle",
          alias: null,
          fullName: "Wild Turkey Rare Breed Barrel Proof",
          bottleFullName: "Wild Turkey Rare Breed Barrel Proof",
          brand: "Wild Turkey",
          bottler: null,
          series: null,
          distillery: [],
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
          score: 0.6,
          source: ["vector"],
        },
      ],
    });

    expect(result.status).toBe("classified");
    if (result.status !== "classified") {
      throw new Error("Expected a classified result");
    }
    expect(result.decision).toMatchObject({
      action: "no_match",
      suggestedBottleId: null,
    });
  });

  test("treats invalid reference URLs as absent metadata", async () => {
    const { runBottleClassifierAgent } = await import(
      "./runBottleClassifierAgent"
    );

    vi.mocked(runBottleClassifierAgent).mockResolvedValue({
      decision: {
        action: "no_match",
        confidence: 0.82,
        rationale: "No safe local match.",
        suggestedBottleId: null,
        suggestedReleaseId: null,
        parentBottleId: null,
        creationTarget: null,
        candidateBottleIds: [],
        proposedBottle: null,
        proposedRelease: null,
      },
      artifacts: {
        extractedIdentity: null,
        searchEvidence: [],
        candidates: [],
        resolvedEntities: [],
      },
    });

    await classifyBottleReference({
      reference: {
        name: "Wild Turkey Rare Breed Bourbon",
        url: "not-a-url",
        imageUrl: "/images/wild-turkey-rare-breed.jpg",
      },
      extractedIdentity: null,
      initialCandidates: [],
    });

    expect(runBottleClassifierAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: expect.objectContaining({
          url: null,
          imageUrl: null,
        }),
      }),
    );
  });
});
