import { describe, expect, test } from "vitest";
import { z } from "zod";

import { StorePriceMatchDecisionSchema } from "./priceMatches";

describe("StorePriceMatchDecisionSchema", () => {
  test("uses fully required proposedBottle fields for structured outputs", () => {
    const jsonSchema = z.toJSONSchema(
      StorePriceMatchDecisionSchema,
    ) as unknown as {
      properties: {
        proposedBottle: {
          anyOf: Array<{
            type?: string;
            properties?: Record<string, unknown>;
            required?: string[];
            items?: {
              properties?: Record<string, unknown>;
              required?: string[];
            };
          }>;
        };
      };
    };

    const proposedBottle = jsonSchema.properties.proposedBottle.anyOf.find(
      (schema) => schema.type === "object",
    );
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
