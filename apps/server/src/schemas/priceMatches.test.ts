import { describe, expect, test } from "vitest";
import { z } from "zod";

import { StorePriceMatchDecisionSchema } from "./priceMatches";

describe("StorePriceMatchDecisionSchema", () => {
  test("uses fully required proposedBottle fields for structured outputs", () => {
    const jsonSchema = z.toJSONSchema(
      StorePriceMatchDecisionSchema,
    ) as unknown as {
      anyOf?: Array<{
        properties?: Record<string, unknown>;
        required?: string[];
      }>;
      oneOf?: Array<{
        properties?: Record<string, unknown>;
        required?: string[];
      }>;
    };

    const decisionSchemas = jsonSchema.oneOf ?? jsonSchema.anyOf ?? [];
    const createNewSchema = decisionSchemas.find(
      (schema) =>
        schema.properties &&
        "action" in schema.properties &&
        (schema.properties.action as { const?: string }).const === "create_new",
    ) as
      | {
          properties?: {
            proposedBottle?: {
              properties?: Record<string, unknown>;
              required?: string[];
            };
          };
        }
      | undefined;
    const proposedBottle = createNewSchema?.properties?.proposedBottle;
    const series = proposedBottle?.properties?.series as
      | {
          anyOf?: Array<{
            type?: string;
            properties?: Record<string, unknown>;
            required?: string[];
          }>;
        }
      | undefined;
    const brand = proposedBottle?.properties?.brand as
      | {
          properties?: Record<string, unknown>;
          required?: string[];
        }
      | undefined;
    const distillers = proposedBottle?.properties?.distillers as
      | {
          items?: {
            properties?: Record<string, unknown>;
            required?: string[];
          };
        }
      | undefined;

    expect(proposedBottle).toBeDefined();
    expect((proposedBottle?.required ?? []).sort()).toEqual(
      Object.keys(proposedBottle?.properties ?? {}).sort(),
    );

    const seriesObject = series?.anyOf?.find(
      (schema) => schema.type === "object",
    );
    expect(seriesObject).toBeDefined();
    expect((seriesObject?.required ?? []).sort()).toEqual(
      Object.keys(seriesObject?.properties ?? {}).sort(),
    );

    expect((brand?.required ?? []).sort()).toEqual(
      Object.keys(brand?.properties ?? {}).sort(),
    );

    expect((distillers?.items?.required ?? []).sort()).toEqual(
      Object.keys(distillers?.items?.properties ?? {}).sort(),
    );
  });

  test("requires suggested bottle ids for match_existing and correction", () => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "match_existing",
        confidence: 91,
        rationale: null,
        candidateBottleIds: [1],
        proposedBottle: null,
      }).success,
    ).toBe(false);

    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "correction",
        confidence: 91,
        rationale: null,
        candidateBottleIds: [1],
        proposedBottle: null,
      }).success,
    ).toBe(false);
  });

  test("rejects suggested bottle ids for create_new and no_match", () => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "create_new",
        confidence: 91,
        rationale: null,
        suggestedBottleId: 1,
        candidateBottleIds: [],
        proposedBottle: {
          name: "Example Bottle",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
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
            name: "Example Brand",
          },
          distillers: [],
          bottler: null,
        },
      }).success,
    ).toBe(false);

    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "no_match",
        confidence: 91,
        rationale: null,
        suggestedBottleId: 1,
        candidateBottleIds: [],
        proposedBottle: null,
      }).success,
    ).toBe(false);
  });

  test("requires a proposed bottle only for create_new", () => {
    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "create_new",
        confidence: 91,
        rationale: null,
        candidateBottleIds: [],
        proposedBottle: null,
      }).success,
    ).toBe(false);

    expect(
      StorePriceMatchDecisionSchema.safeParse({
        action: "match_existing",
        confidence: 91,
        rationale: null,
        suggestedBottleId: 1,
        candidateBottleIds: [1],
        proposedBottle: {
          name: "Should Not Be Here",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
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
            name: "Example Brand",
          },
          distillers: [],
          bottler: null,
        },
      }).success,
    ).toBe(false);
  });

  test("rejects fractional ids in classifier output", () => {
    const result = StorePriceMatchDecisionSchema.safeParse({
      action: "create_new",
      confidence: 91,
      rationale: null,
      suggestedBottleId: null,
      candidateBottleIds: [],
      proposedBottle: {
        name: "Example Bottle",
        series: {
          id: 0.92,
          name: "Example Series",
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
          id: 1,
          name: "Example Brand",
        },
        distillers: [
          {
            id: 0.92,
            name: "Example Distillery",
          },
        ],
        bottler: null,
      },
    });

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected classifier output validation to fail");
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["proposedBottle", "series", "id"],
        }),
        expect.objectContaining({
          path: ["proposedBottle", "distillers", 0, "id"],
        }),
      ]),
    );
  });
});
