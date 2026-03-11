import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { OpenAIBottleDetailsValidationSchema } from "../worker/jobs/generateBottleDetails";
import { OpenAICountryDetailsSchema } from "../worker/jobs/generateCountryDetails";
import { OpenAIEntityDetailsValidationSchema } from "../worker/jobs/generateEntityDetails";
import { OpenAIRegionDetailsSchema } from "../worker/jobs/generateRegionDetails";

describe("openai structured output schemas", () => {
  test("compile to strict json schema without optional fields", () => {
    expect(() =>
      zodTextFormat(
        OpenAIEntityDetailsValidationSchema,
        "generate_entity_details",
      ),
    ).not.toThrow();
    expect(() =>
      zodTextFormat(
        OpenAIBottleDetailsValidationSchema,
        "generate_bottle_details",
      ),
    ).not.toThrow();
    expect(() =>
      zodTextFormat(OpenAICountryDetailsSchema, "generate_country_details"),
    ).not.toThrow();
    expect(() =>
      zodTextFormat(OpenAIRegionDetailsSchema, "generate_region_details"),
    ).not.toThrow();
  });

  test("does not emit unsupported uri formats for generated entity websites", () => {
    const jsonSchema = z.toJSONSchema(
      OpenAIEntityDetailsValidationSchema,
    ) as unknown as {
      properties?: {
        website?: {
          anyOf?: Array<{ format?: string }>;
        };
      };
    };

    expect(
      jsonSchema.properties?.website?.anyOf?.some(
        (schema) => schema.format === "uri",
      ),
    ).toBe(false);
  });
});
