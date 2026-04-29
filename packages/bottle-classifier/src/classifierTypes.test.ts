import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
} from "./classifierTypes";

describe("BottleClassifierAgentDecisionSchema", () => {
  test("uses a flat structured-output schema at the root", () => {
    const jsonSchema = z.toJSONSchema(BottleClassifierAgentDecisionSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
      anyOf?: unknown[];
      oneOf?: unknown[];
      additionalProperties?: boolean;
    };

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.additionalProperties).toBe(false);
    expect(jsonSchema.oneOf).toBeUndefined();
    expect(jsonSchema.anyOf).toBeUndefined();
    expect(jsonSchema.properties?.decision).toBeUndefined();
    expect((jsonSchema.required ?? []).sort()).toEqual(
      Object.keys(jsonSchema.properties ?? {}).sort(),
    );
  });

  test("parses first-class existing-bottle repair decisions", () => {
    const decision = BottleClassificationDecisionSchema.parse({
      action: "repair_bottle",
      confidence: 91,
      rationale: "Bottle identity matches, but distillery metadata is wrong.",
      candidateBottleIds: [123],
      matchedBottleId: 123,
      proposedBottle: {
        name: "Bodega Cask",
        brand: {
          id: 456,
          name: "The Whistler",
        },
        distillers: [
          {
            id: 789,
            name: "Boann Distillery",
          },
        ],
      },
    });

    expect(decision).toMatchObject({
      action: "repair_bottle",
      matchedBottleId: 123,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedRelease: null,
      proposedBottle: {
        category: null,
        distillers: [
          {
            name: "Boann Distillery",
          },
        ],
      },
    });
  });
});
