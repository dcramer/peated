import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, test } from "vitest";
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
});
