import { describe, expect, test } from "vitest";
import { z } from "zod";
import { BottleClassifierAgentDecisionSchema } from "./schemas";

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
});
