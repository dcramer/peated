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
        matchedReleaseId: null,
      },
      artifacts: {
        candidates: [
          {
            bottleId: bottle.id,
            releaseId: null,
            source: expect.arrayContaining(["exact"]),
          },
        ],
      },
    });
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
        matchedReleaseId: null,
      },
    });
  });
});
