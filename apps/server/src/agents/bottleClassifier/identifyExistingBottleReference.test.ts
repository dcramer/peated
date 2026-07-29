import config from "@peated/server/config";
import { identifyExistingBottleReference } from "./service";

describe("identifyExistingBottleReference", () => {
  const originalOpenAiApiKey = config.OPENAI_API_KEY;

  afterEach(() => {
    config.OPENAI_API_KEY = originalOpenAiApiKey;
  });

  test("uses the exact alias preflight without full classifier reasoning", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      name: "Uigeadail",
    });
    const referenceName = bottle.fullName;

    const result = await identifyExistingBottleReference({
      reference: {
        name: referenceName,
        url: null,
        imageUrl: null,
      },
      extractedIdentity: {
        brand: "Ardbeg",
        bottler: null,
        expression: "Uigeadail",
        series: null,
        distillery: null,
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
      },
    });

    expect(result).toMatchObject({
      status: "classified",
      decision: {
        action: "match",
        matchedBottleId: bottle.id,
      },
      artifacts: {
        candidates: [
          {
            bottleId: bottle.id,
            source: expect.arrayContaining(["exact"]),
          },
        ],
      },
    });
    if (result.status !== "classified") {
      throw new Error("Expected an exact alias classification.");
    }
    expect(result.decision).not.toHaveProperty("matchedReleaseId");
    expect(result.decision).not.toHaveProperty("parentBottleId");
    expect(result.decision).not.toHaveProperty("proposedRelease");
    expect(result.artifacts.candidates[0]).not.toHaveProperty("releaseId");
    expect(result.artifacts.candidates[0]).not.toHaveProperty("kind");
  });

  test("can skip exact alias preflight for synthesized references", async ({
    fixtures,
  }) => {
    config.OPENAI_API_KEY = undefined;
    const bottle = await fixtures.Bottle({
      name: "Uigeadail",
    });

    const result = await identifyExistingBottleReference(
      {
        reference: {
          name: bottle.fullName,
          url: null,
          imageUrl: null,
        },
        extractedIdentity: {
          brand: "Ardbeg",
          bottler: null,
          expression: "Uigeadail",
          series: null,
          distillery: null,
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
        },
      },
      {
        allowExactAliasPreflight: false,
      },
    );

    expect(result).toMatchObject({
      status: "classified",
      decision: {
        action: "no_match",
        matchedBottleId: null,
      },
    });
  });
});
